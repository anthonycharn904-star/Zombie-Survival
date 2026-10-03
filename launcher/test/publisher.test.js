'use strict';
/* Outil de publication : la version produite doit être acceptée par le launcher. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const publisher = require('../src/main/publisher');
const { verifyManifest } = require('../src/main/updater');

const SOURCE = path.join(__dirname, '..', '..', 'game', 'zombie-survival.html');
const LIBS = path.join(__dirname, '..', 'gamelibs');

test('publication : zip + latest.json signé, accepté par le launcher', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-pub-'));
  try {
    const { privatePem, publicPem } = publisher.generateKeyPair();
    const r = await publisher.createRelease({
      source: { htmlPath: SOURCE }, version: '1.2.3', notes: ['Essai'], outDir: tmp,
      privatePem, libsDir: LIBS, repo: 'anthonycharn904-star/zombie-survival',
    });
    assert.equal(r.version, '1.2.3');
    assert.deepEqual(r.upload, ['latest.json', 'zombie-survival-1.2.3.zip']);
    const m = verifyManifest(fs.readFileSync(path.join(r.dir, 'latest.json'), 'utf8'), publicPem);
    const zip = fs.readFileSync(path.join(r.dir, 'zombie-survival-1.2.3.zip'));
    assert.equal(m.game.size, zip.length);
    assert.equal(m.game.sha256, crypto.createHash('sha256').update(zip).digest('hex'));
    assert.equal(m.game.file, 'https://github.com/anthonycharn904-star/zombie-survival/releases/download/v1.2.3/zombie-survival-1.2.3.zip');
    assert.equal(fs.readdirSync(r.dir).some((n) => /\.pem$/.test(n)), false, 'aucune clé dans le dossier de publication');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('publication : refusée sans clé de signature', async () => {
  await assert.rejects(publisher.createRelease({ source: { htmlPath: SOURCE }, version: '1.2.3', outDir: os.tmpdir(), libsDir: LIBS }), /clé/);
});
