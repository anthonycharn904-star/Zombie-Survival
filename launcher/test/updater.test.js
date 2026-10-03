'use strict';
/* Vérification des mises à jour : c'est ce qui empêche un tiers de pousser
   un faux jeu ou un faux launcher aux joueurs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyManifest, compareVersions, parseVersion } = require('../src/main/updater');
const { generateKeyPair, signManifest } = require('../src/main/publisher');

const SHA = 'a'.repeat(64);
const manifest = () => ({
  format: 1,
  published: '2026-10-03T08:05:52.021Z',
  game: { version: '1.0.3', file: 'zombie-survival-1.0.3.zip', size: 1234, sha256: SHA, notes: ['Test'] },
});

test('versions : lecture et comparaison', () => {
  assert.deepEqual(parseVersion('1.10.2'), [1, 10, 2]);
  assert.equal(parseVersion('1.0'), null);
  assert.equal(parseVersion('v1.0.0'), null);
  assert.equal(compareVersions('1.0.10', '1.0.9'), 1);
  assert.equal(compareVersions('1.1.0', '1.1.0'), 0);
  assert.equal(compareVersions('0.9.9', '1.0.0'), -1);
  assert.throws(() => compareVersions('abc', '1.0.0'), { code: 'VERSION' });
});

test('manifeste signé : accepté avec la bonne clé', () => {
  const { privatePem, publicPem } = generateKeyPair();
  const raw = JSON.stringify(signManifest(manifest(), privatePem));
  const m = verifyManifest(raw, publicPem);
  assert.equal(m.game.version, '1.0.3');
});

test('manifeste modifié après signature : refusé', () => {
  const { privatePem, publicPem } = generateKeyPair();
  const outer = signManifest(manifest(), privatePem);
  outer.signed = outer.signed.replace('1.0.3', '9.9.9');
  assert.throws(() => verifyManifest(JSON.stringify(outer), publicPem), { code: 'BAD_SIGNATURE' });
});

test('manifeste signé par une autre clé ou non signé : refusé', () => {
  const author = generateKeyPair();
  const attacker = generateKeyPair();
  const forged = JSON.stringify(signManifest(manifest(), attacker.privatePem));
  assert.throws(() => verifyManifest(forged, author.publicPem), { code: 'BAD_SIGNATURE' });
  assert.throws(() => verifyManifest(JSON.stringify(manifest()), author.publicPem), { code: 'UNSIGNED' });
});

test('manifeste signé mais incomplet : refusé', () => {
  const { privatePem, publicPem } = generateKeyPair();
  const bad = manifest();
  bad.game.sha256 = 'pas-une-empreinte';
  assert.throws(() => verifyManifest(JSON.stringify(signManifest(bad, privatePem)), publicPem), { code: 'MANIFEST_INVALID' });
});
