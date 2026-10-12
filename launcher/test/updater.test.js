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

test('version livrée : installée au premier lancement, réinstallée à numéro égal si son éditeur est plus récent', async () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const { Updater } = require('../src/main/updater');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-upd-bundle-'));
  const game = (dir, version, api, mark) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ version }));
    fs.writeFileSync(path.join(dir, 'index.html'), `<script>const EDITOR_API = ${api};                       // ${mark}</script>`);
  };
  try {
    const bundle = path.join(tmp, 'bundle'), data = path.join(tmp, 'data');
    const logs = [];
    const u = new Updater({ dataDir: data, bundledDir: bundle, updateUrl: '', publicKey: '', log: (m) => logs.push(m) });
    const html = () => fs.readFileSync(path.join(u.getInstalled().dir, 'index.html'), 'utf8');
    // premier lancement : la version livrée (2.0.3, éditeur 5)
    game(bundle, '2.0.3', 5, 'premier');
    assert.equal((await u.ensureBundled()).version, '2.0.3');
    assert.match(html(), /premier/);
    assert.deepEqual(logs, ['Version livrée installée : 2.0.3']);
    // même numéro, même éditeur : rien ne change
    game(bundle, '2.0.3', 5, 'pareil');
    await u.ensureBundled();
    assert.match(html(), /premier/);
    assert.equal(logs.length, 1);
    // même numéro, éditeur plus récent (jeu reconstruit) : réinstallée, le journal dit d'où elle vient
    game(bundle, '2.0.3', 6, 'reconstruit');
    await u.ensureBundled();
    assert.match(html(), /reconstruit/);
    assert.equal(u.getInstalled().version, '2.0.3');
    assert.equal(logs[1], 'Version livrée réinstallée : 2.0.3 (éditeur 6 au lieu de 5)');
    // version installée plus récente (mise à jour en ligne) : la version livrée ne la remplace pas
    game(u.versionDir('2.0.4'), '2.0.4', 6, 'en ligne');
    await u.writeState({ current: '2.0.4', previous: '2.0.3' });
    game(bundle, '2.0.3', 9, 'ancienne');
    await u.ensureBundled();
    assert.equal(u.getInstalled().version, '2.0.4');
    assert.match(html(), /en ligne/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
