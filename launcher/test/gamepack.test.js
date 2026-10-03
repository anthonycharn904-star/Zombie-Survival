'use strict';
/* Paquetage hors ligne du jeu (utilisé par la compilation et par l'outil de publication). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const gamepack = require('../src/main/gamepack');
const { extractZip } = require('../src/main/updater');

const SOURCE = path.join(__dirname, '..', '..', 'game', 'zombie-survival.html');
const LIBS = path.join(__dirname, '..', 'gamelibs');
const html = fs.readFileSync(SOURCE, 'utf8');

test('source du jeu : numéro de version lisible', () => {
  assert.match(gamepack.readGameVersion(html) || '', /^\d+\.\d+\.\d+$/);
});

test('version hors ligne : plus aucune ressource internet, version réécrite', () => {
  const out = gamepack.rewriteHtml(html, '7.8.9');
  assert.doesNotMatch(out, /cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(out, /<script src="lib\/three\.min\.js"><\/script>/);
  assert.equal((out.match(/<link rel="stylesheet" href="fonts\/fonts\.css">/g) || []).length, 1);
  assert.equal(gamepack.readGameVersion(out), '7.8.9');
  // le paquetage est idempotent : repasser un fichier déjà paqueté ne change rien
  assert.equal(gamepack.rewriteHtml(out, '7.8.9'), out);
});

test('un fichier HTML qui n\'est pas le jeu est refusé', () => {
  assert.throws(() => gamepack.rewriteHtml('<!doctype html><title>autre</title>', '1.0.0'), /Three\.js/);
});

test('archive du jeu : écrite puis extraite à l\'identique', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-pack-'));
  try {
    const { files, version } = gamepack.collectPackage({ htmlPath: SOURCE, libsDir: LIBS, notes: ['n'] });
    assert.equal(version, gamepack.readGameVersion(html));
    const names = files.map((f) => f.name);
    for (const need of ['index.html', 'lib/three.min.js', 'fonts/fonts.css', 'game.json']) assert.ok(names.includes(need), need);
    const zip = path.join(tmp, 'jeu.zip');
    await gamepack.writeZip(files, zip);
    await extractZip(zip, path.join(tmp, 'out'));
    for (const f of files) assert.deepEqual(fs.readFileSync(path.join(tmp, 'out', ...f.name.split('/'))), f.data, f.name);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
