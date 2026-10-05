'use strict';
/* Historique des notes de version : fusion des sources, manifeste signé, publication,
   versions publiées avant le launcher 1.2.6. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const history = require('../src/main/history');
const publisher = require('../src/main/publisher');
const { verifyManifest } = require('../src/main/updater');

const SOURCE = path.join(__dirname, '..', '..', 'game', 'zombie-survival.html');
const LIBS = path.join(__dirname, '..', 'gamelibs');
const BUNDLED = path.join(__dirname, '..', 'config', 'notes-history.json');

test('historique : une entrée par version, la plus récente d’abord, la source la plus sûre l’emporte', () => {
  const merged = history.mergeHistory(
    [{ version: '1.5.0', date: '2026-10-05', notes: ['Rang'] }, { version: '1.4.0', notes: [] }],
    [{ version: '1.4.0', date: '2026-10-04', notes: ['Étages'] }, { version: '1.5.0', notes: ['Ancienne note'] }, { version: '1.10.0', notes: ['Plus récente'] }],
  );
  assert.deepEqual(merged.map((e) => e.version), ['1.10.0', '1.5.0', '1.4.0']);
  assert.deepEqual(merged[1].notes, ['Rang'], 'la première source gagne');
  assert.deepEqual(merged[2], { version: '1.4.0', date: '2026-10-04', notes: ['Étages'] }, 'une source suivante complète date et notes absentes');
});

test('historique : entrées invalides ignorées, textes nettoyés et bornés', () => {
  const long = 'x'.repeat(5000);
  const merged = history.mergeHistory([
    null, 'texte', { version: '1.2' }, { version: 'abc', notes: ['a'] },
    { version: ' 2.0.0 ', date: 42, notes: ['  ok  ', '', 7, long] },
  ], 'pas une liste');
  assert.equal(merged.length, 1);
  assert.equal(merged[0].version, '2.0.0');
  assert.equal(merged[0].date, '');
  assert.deepEqual(merged[0].notes.slice(0, 1), ['ok']);
  assert.equal(merged[0].notes[1].length, history.LIMITS.noteLength);
});

test('historique joint à une publication : seulement les versions antérieures', () => {
  const list = [{ version: '1.5.0', notes: ['a'] }, { version: '1.5.1', notes: ['b'] }, { version: '1.6.0', notes: ['c'] }, { version: '1.4.0', notes: ['d'] }];
  assert.deepEqual(history.historyBefore('1.5.1', list).map((e) => e.version), ['1.5.0', '1.4.0']);
  assert.deepEqual(history.historyBefore('pas une version', list), []);
  const m = { published: '2026-10-05T10:00:00Z', game: { version: '1.5.0', notes: ['Rang'] }, history: [{ version: '1.4.0', notes: ['Étages'] }] };
  assert.deepEqual(history.manifestEntries(m), [{ version: '1.5.0', date: '2026-10-05T10:00:00Z', notes: ['Rang'] }, { version: '1.4.0', notes: ['Étages'] }]);
  assert.deepEqual(history.manifestEntries(null), []);
});

test('publication : l’historique des versions précédentes est signé avec le manifeste et relu par le launcher', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-hist-'));
  try {
    const { privatePem, publicPem } = publisher.generateKeyPair();
    const past = [
      { version: '1.0.2', date: '2026-10-03', notes: ['Première publication'] },
      { version: '1.3.0', date: '2026-10-04', notes: ['Écran Modèles'] },
      { version: '9.0.0', notes: ['Version future : ignorée'] },
      { version: '1.3.1', notes: ['Version republiée : ignorée'] },
    ];
    const r = await publisher.createRelease({ source: { htmlPath: SOURCE }, version: '1.3.1', notes: ['Historique'], outDir: tmp, privatePem, libsDir: LIBS, history: past });
    const m = verifyManifest(fs.readFileSync(path.join(r.dir, 'latest.json'), 'utf8'), publicPem);
    assert.deepEqual(m.history.map((e) => e.version), ['1.3.0', '1.0.2']);
    assert.deepEqual(m.history[0], { version: '1.3.0', date: '2026-10-04', notes: ['Écran Modèles'] });
    assert.deepEqual(history.manifestEntries(m).map((e) => e.version), ['1.3.1', '1.3.0', '1.0.2']);
    // sans historique : pas de champ (manifeste identique aux versions précédentes du launcher)
    const r2 = await publisher.createRelease({ source: { htmlPath: SOURCE }, version: '1.3.2', notes: [], outDir: tmp, privatePem, libsDir: LIBS });
    assert.equal(verifyManifest(fs.readFileSync(path.join(r2.dir, 'latest.json'), 'utf8'), publicPem).history, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('manifeste : un historique abîmé est ignoré sans bloquer la mise à jour', () => {
  const { privatePem, publicPem } = publisher.generateKeyPair();
  const base = { format: 1, game: { version: '1.0.0', file: 'a.zip', size: 1, sha256: 'a'.repeat(64) } };
  const sign = (extra) => JSON.stringify(publisher.signManifest({ ...base, ...extra }, privatePem));
  assert.deepEqual(verifyManifest(sign({ history: 'n’importe quoi' }), publicPem).history, []);
  assert.deepEqual(verifyManifest(sign({ history: [{ version: '0.9.0', notes: ['a', 3] }, { notes: [] }] }), publicPem).history, [{ version: '0.9.0', date: '', notes: ['a'] }]);
});

test('versions publiées avant le launcher 1.2.6 : 1.0.2, 1.2.1, 1.3.0, 1.4.0 et 1.5.0, datées et avec leurs notes', () => {
  const doc = JSON.parse(fs.readFileSync(BUNDLED, 'utf8'));
  const merged = history.mergeHistory(doc.versions);
  assert.deepEqual(merged.map((e) => e.version), ['1.5.0', '1.4.0', '1.3.0', '1.2.1', '1.0.2']);
  for (const e of merged) {
    assert.ok(Number.isFinite(Date.parse(e.date)), `date de la ${e.version}`);
    assert.ok(e.notes.length > 0, `notes de la ${e.version}`);
  }
  assert.equal(merged.length, doc.versions.length, 'aucune entrée perdue au nettoyage');
});
