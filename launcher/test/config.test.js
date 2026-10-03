'use strict';
/* Garde-fou : la configuration livrée doit pointer vers le dépôt de publication
   et contenir la clé publique d'Anthony, jamais une clé privée. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { fingerprint } = require('../src/main/publisher');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'default.json'), 'utf8'));

test('config : adresse du manifeste et clé publique attendues', () => {
  assert.equal(cfg.updateUrl, 'https://github.com/anthonycharn904-star/zombie-survival/releases/latest/download/latest.json');
  assert.match(cfg.publicKey, /BEGIN PUBLIC KEY/);
  assert.doesNotMatch(cfg.publicKey, /PRIVATE/);
  assert.equal(fingerprint(cfg.publicKey), '8508-2046-8B30-034A');
});
