'use strict';
/* Sauvegardes des parties solo (jeu 2.0.7) : écriture atomique, copie, écriture interrompue, fichiers abîmés, contrôles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Sauvegardes, sommeTexte } = require('../src/main/sauvegardes');

function tmpDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
/* Enveloppe comme celle du jeu (section 29). */
function enveloppe(manche, cree = '2026-11-03T20:00:00.000Z') {
  const etat = { base: { map: 'bunker7', round: manche, points: 100 * manche }, mode: 'manche' };
  return JSON.stringify({ format: 1, type: 'manuelle', jeu: { version: '2.0.7' }, carte: { id: 'bunker7' }, cree, apercu: { carte: 'bunker7', manche }, etat, somme: sommeTexte(JSON.stringify(etat)) });
}

test('sauvegardes : écrire, relire, lister, garder la précédente en copie, supprimer', () => {
  const dir = tmpDir('zs-sv-');
  try {
    const s = new Sauvegardes(dir);
    assert.equal(s.lire('bunker7', 'manuelle').erreur, 'absente');
    assert.ok(s.ecrire('bunker7', 'manuelle', enveloppe(5)).ok);
    let r = s.lire('bunker7', 'manuelle');
    assert.ok(r.ok && r.source === 'principale' && JSON.parse(r.texte).apercu.manche === 5);
    assert.ok(s.ecrire('bunker7', 'manuelle', enveloppe(6, '2026-11-03T21:00:00.000Z')).ok);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'bunker7', 'manuelle.json.bak'), 'utf8')).apercu.manche, 5, 'la précédente devient la copie');
    assert.ok(s.ecrire('khamsin', 'manuelle', enveloppe(2, '2026-11-02T10:00:00.000Z')).ok);
    const l = s.liste();
    assert.deepEqual(l.map((x) => `${x.carte}:${x.apercu.manche}`), ['bunker7:6', 'khamsin:2'], 'deux cartes, la plus récente d’abord');
    assert.ok(s.supprimer('bunker7', 'manuelle'));
    assert.equal(s.lire('bunker7', 'manuelle').erreur, 'absente');
    assert.ok(!fs.existsSync(path.join(dir, 'bunker7', 'manuelle.json.bak')));
    assert.ok(s.lire('khamsin', 'manuelle').ok, 'l’autre carte reste');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sauvegardes : écriture interrompue, la précédente reste intacte', () => {
  const dir = tmpDir('zs-sv-');
  try {
    const s = new Sauvegardes(dir);
    assert.ok(s.ecrire('bunker7', 'manuelle', enveloppe(5)).ok);
    // plantage entre l'écriture du temporaire et le renommage : un temporaire à moitié écrit reste sur le disque
    const tmp = path.join(dir, 'bunker7', 'manuelle.json.tmp-999-1');
    fs.writeFileSync(tmp, enveloppe(9).slice(0, 40));
    const r = s.lire('bunker7', 'manuelle');
    assert.ok(r.ok && JSON.parse(r.texte).apercu.manche === 5, 'la sauvegarde d’avant se lit');
    assert.ok(s.ecrire('bunker7', 'manuelle', enveloppe(6)).ok);
    assert.ok(!fs.existsSync(tmp), 'temporaire retiré à l’écriture suivante');
    assert.equal(fs.readdirSync(path.join(dir, 'bunker7')).filter((n) => n.includes('.tmp-')).length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sauvegardes : fichier abîmé, copie, rien d’effacé sur un échec', () => {
  const dir = tmpDir('zs-sv-');
  try {
    const s = new Sauvegardes(dir);
    const f = path.join(dir, 'bunker7', 'manuelle.json');
    s.ecrire('bunker7', 'manuelle', enveloppe(5));
    s.ecrire('bunker7', 'manuelle', enveloppe(6));
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"points":600', '"points":999'));
    let r = s.lire('bunker7', 'manuelle');
    assert.ok(r.ok && r.source === 'copie' && /abîmée/.test(r.avertissement) && JSON.parse(r.texte).apercu.manche === 5, 'principale abîmée : la copie sert');
    // écrire par-dessus une principale abîmée ne remplace pas la copie intacte
    s.ecrire('bunker7', 'manuelle', enveloppe(7));
    assert.equal(JSON.parse(fs.readFileSync(`${f}.bak`, 'utf8')).apercu.manche, 5, 'copie intacte gardée');
    fs.writeFileSync(f, '{"abîmée": true'); fs.writeFileSync(`${f}.bak`, 'x');
    r = s.lire('bunker7', 'manuelle');
    assert.ok(!r.ok && r.erreur === 'illisible', 'les deux abîmées : erreur');
    assert.ok(fs.existsSync(f) && fs.existsSync(`${f}.bak`), 'rien d’effacé');
    assert.equal(s.liste()[0].etat, 'abîmée', 'la liste la signale');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sauvegardes : contrôles (carte, type, taille, contenu)', () => {
  const dir = tmpDir('zs-sv-');
  try {
    const s = new Sauvegardes(dir);
    assert.ok(!s.ecrire('../x', 'manuelle', enveloppe(1)).ok, 'chemin refusé');
    assert.ok(!s.ecrire('bunker7', 'autre', enveloppe(1)).ok, 'type refusé');
    assert.ok(!s.ecrire('bunker7', 'manuelle', 'pas du JSON').ok, 'texte invalide refusé');
    const env = JSON.parse(enveloppe(1)); env.somme = '00000000';
    assert.ok(!s.ecrire('bunker7', 'manuelle', JSON.stringify(env)).ok, 'somme fausse refusée');
    assert.ok(!s.ecrire('bunker7', 'manuelle', 'x'.repeat(4 * 1024 * 1024 + 1)).ok, 'trop grande refusée');
    assert.equal(fs.existsSync(path.join(dir, 'bunker7', 'manuelle.json')), false, 'rien d’écrit');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sauvegardes : accès brut des essais (lire, écrire sans contrôle, effacer, copie)', () => {
  const dir = tmpDir('zs-sv-');
  try {
    const s = new Sauvegardes(dir);
    assert.equal(s.brut('bunker7', 'manuelle'), null);
    assert.ok(s.brut('bunker7', 'manuelle', false, '{"abîmée": true'));
    assert.equal(s.brut('bunker7', 'manuelle'), '{"abîmée": true');
    assert.equal(s.lire('bunker7', 'manuelle').erreur, 'illisible');
    assert.ok(s.brut('bunker7', 'manuelle', true, enveloppe(4)));
    assert.equal(JSON.parse(s.lire('bunker7', 'manuelle').texte).apercu.manche, 4, 'copie écrite par l’accès brut : elle sert');
    assert.ok(s.brut('bunker7', 'manuelle', true, null) && s.brut('bunker7', 'manuelle', true) === null);
    assert.equal(s.brut('../x', 'manuelle'), null, 'chemin refusé');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
