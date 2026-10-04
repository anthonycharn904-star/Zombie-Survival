'use strict';
/* Mise en ligne en un clic : déroulé complet contre un faux GitHub. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const publisher = require('../src/main/publisher');
const { verifyManifest } = require('../src/main/updater');
const { createClient, request } = require('../src/main/github');
const { fakeGitHub } = require('../e2e/fake-github');

const SOURCE = path.join(__dirname, '..', '..', 'game', 'zombie-survival.html');
const LIBS = path.join(__dirname, '..', 'gamelibs');
const TOKEN = 'github_pat_essai_0123456789abcdef';

async function makeRelease(gh, version, tmp, privatePem) {
  return publisher.createRelease({
    source: { htmlPath: SOURCE }, version, notes: ['- Première ligne', 'Deuxième ligne'], outDir: tmp,
    privatePem, libsDir: LIBS, repo: gh.repo, webBase: gh.base,
  });
}
const client = (gh, token = TOKEN) => createClient({ token, apiBase: gh.base, webBase: gh.base });

test('liaison : nom exact du dépôt, branche, compte ; jeton refusé ; pas de droit d’écriture ; dépôt privé', async () => {
  const gh = await fakeGitHub();
  try {
    const a = await client(gh).access('anthony/zombie-survival');
    assert.deepEqual(a, { repo: 'Anthony/Zombie-Survival', branch: 'main', login: 'Anthony' });
    await assert.rejects(client(gh, 'github_pat_faux_0123456789abcdef').access(gh.repo), /refuse le jeton/);
    gh.state.push = false;
    await assert.rejects(client(gh).access(gh.repo), /pas y écrire/);
    gh.state.push = true;
    // compte propriétaire, mais jeton en lecture seule : refusé grâce au brouillon d'essai
    gh.state.tokenWrite = false;
    await assert.rejects(client(gh).access(gh.repo, { probeWrite: true }), /ne peut pas publier/);
    gh.state.tokenWrite = true;
    await client(gh).access(gh.repo, { probeWrite: true });
    assert.equal(gh.state.releases.length, 0, 'brouillon de vérification supprimé');
    assert.equal(gh.state.deleted, 1);
    gh.state.isPrivate = true;
    await assert.rejects(client(gh).access(gh.repo), /privé/);
    assert.throws(() => createClient({ token: 'mot de passe', apiBase: gh.base }), /jeton/);
  } finally { await gh.close(); }
});

test('publication en ligne : brouillon pendant l’envoi, latest.json en dernier, puis visible à l’adresse fixe', async () => {
  const gh = await fakeGitHub();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-gh-'));
  try {
    const { privatePem, publicPem } = publisher.generateKeyPair();
    // une version déjà en ligne
    const r1 = await makeRelease(gh, '1.2.1', tmp, privatePem);
    const o1 = await client(gh).publish({ repo: gh.repo, version: r1.version, dir: r1.dir, files: r1.upload, notes: ['Essai'] });
    assert.equal(o1.verified, true);
    // la suivante : les fichiers partent pendant que la version est en brouillon (invisible des launchers)
    const r2 = await makeRelease(gh, '1.2.2', tmp, privatePem);
    const steps = new Set();
    const o2 = await client(gh).publish({
      repo: gh.repo, version: r2.version, dir: r2.dir, files: r2.upload, notes: ['- Nouveau'],
      onProgress: (p) => { steps.add(p.step); },
    });
    assert.equal(o2.verified, true, o2.detail);
    assert.ok(steps.has('prepare') && steps.has('upload') && steps.has('publish') && steps.has('verify'));
    const ups = gh.state.uploads.slice(-2);
    assert.deepEqual(ups.map((u) => u.name), ['zombie-survival-1.2.2.zip', 'latest.json']);
    assert.ok(ups.every((u) => u.draft), 'fichiers envoyés pendant le brouillon');
    const rel = gh.state.releases.find((x) => x.tag_name === 'v1.2.2');
    assert.equal(rel.draft, false);
    assert.equal(rel.body, '- Nouveau');
    // ce que reçoit un launcher : manifeste signé, jeu téléchargeable à l'adresse annoncée
    const got = await request('GET', `${gh.base}/${gh.repo}/releases/latest/download/latest.json`);
    const m = verifyManifest(got.body.toString('utf8'), publicPem);
    assert.equal(m.game.version, '1.2.2');
    assert.equal(m.game.file, `${gh.base}/${gh.repo}/releases/download/v1.2.2/zombie-survival-1.2.2.zip`);
    const zip = await request('GET', m.game.file);
    assert.equal(zip.status, 200);
    assert.equal(zip.body.length, m.game.size);
    // déjà en ligne : refus clair
    await assert.rejects(client(gh).publish({ repo: gh.repo, version: '1.2.2', dir: r2.dir, files: r2.upload }), /déjà en ligne/);
  } finally {
    await gh.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('coupure pendant l’envoi : rien de visible, puis reprise du brouillon', async () => {
  const gh = await fakeGitHub();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-gh-'));
  try {
    const { privatePem } = publisher.generateKeyPair();
    const r = await makeRelease(gh, '1.3.0', tmp, privatePem);
    gh.state.failNext = 'latest.json';
    await assert.rejects(client(gh).publish({ repo: gh.repo, version: r.version, dir: r.dir, files: r.upload }), /500/);
    const draft = gh.state.releases.find((x) => x.tag_name === 'v1.3.0');
    assert.equal(draft.draft, true, 'la version reste en brouillon');
    const none = await request('GET', `${gh.base}/${gh.repo}/releases/latest/download/latest.json`);
    assert.equal(none.status, 404, 'aucune version visible des launchers');
    const o = await client(gh).publish({ repo: gh.repo, version: r.version, dir: r.dir, files: r.upload });
    assert.equal(o.verified, true);
    assert.equal(gh.state.releases.filter((x) => x.tag_name === 'v1.3.0').length, 1, 'pas de doublon');
    assert.deepEqual(draft.assets.map((a) => a.name).sort(), ['latest.json', 'zombie-survival-1.3.0.zip']);
  } finally {
    await gh.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
