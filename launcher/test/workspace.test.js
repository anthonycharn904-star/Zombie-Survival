'use strict';
/* Atelier des Mod Tools (cartes de l'auteur) et cartes dans le paquet du jeu. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Workspace } = require('../src/main/workspace');
const gamepack = require('../src/main/gamepack');

const SOURCE = path.join(__dirname, '..', '..', 'game', 'zombie-survival.html');
const LIBS = path.join(__dirname, '..', 'gamelibs');
const mapText = (id, name, extra = {}) => JSON.stringify({ format: 1, id, name, updated: '2026-10-04T08:00:00.000Z', grid: ['########', '#......#', '#......#', '#......#', '#......#', '#......#', '#......#', '########'], ...extra }, null, 1);

function tmpDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

test('atelier : enregistrer, lister, relire, garder les versions, supprimer', () => {
  const dir = tmpDir('zs-ws-');
  try {
    const ws = new Workspace(dir);
    assert.deepEqual(ws.listMaps(), []);
    ws.saveMap('cave', mapText('cave', 'La cave'));
    ws.saveMap('cave', mapText('cave', 'La cave v2'));
    ws.saveMap('usine', mapText('usine', 'Usine'));
    const list = ws.listMaps();
    assert.deepEqual(list.map((m) => [m.id, m.name]), [['cave', 'La cave v2'], ['usine', 'Usine']]);
    assert.equal(list[0].updated, '2026-10-04T08:00:00.000Z');
    assert.match(ws.readMap('cave'), /La cave v2/);
    assert.equal(fs.readdirSync(path.join(dir, 'versions', 'cave')).length, 1, 'version précédente gardée');
    for (let i = 0; i < 8; i++) ws.saveMap('cave', mapText('cave', `v${i}`));
    assert.equal(fs.readdirSync(path.join(dir, 'versions', 'cave')).length, 5, 'cinq versions au plus');
    assert.equal(ws.deleteMap('cave'), true);
    assert.deepEqual(ws.listMaps().map((m) => m.id), ['usine']);
    assert.equal(fs.readdirSync(path.join(dir, 'corbeille')).length, 1, 'carte supprimée gardée dans la corbeille');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('atelier : identifiants et contenus refusés', () => {
  const dir = tmpDir('zs-ws-');
  try {
    const ws = new Workspace(dir);
    for (const bad of ['../x', 'A', 'a b', '', 'x'.repeat(41), '..', 'con/x']) assert.throws(() => ws.saveMap(bad, mapText('x', 'x')), /Identifiant/, bad);
    assert.throws(() => ws.saveMap('ok', '{pas du json'), /illisible/);
    assert.throws(() => ws.saveMap('ok', '{"name":"sans grille"}'), /grille/);
    assert.throws(() => ws.readMap('absente'), /introuvable/);
    assert.throws(() => ws.saveTexture('pas_u', '{}'), /Identifiant/);
    assert.throws(() => ws.saveTexture('u_ok', JSON.stringify({ data: 'data:text/html;base64,AAAA' })), /Image invalide/);
    assert.throws(() => ws.setPublishSet({ maps: [] }), /au moins une carte/);
    assert.equal(fs.existsSync(path.join(dir, 'maps')), false, 'rien écrit');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('atelier : copies de secours, images et modèles importés', () => {
  const dir = tmpDir('zs-ws-');
  try {
    const ws = new Workspace(dir);
    assert.equal(ws.readRecovery('cave'), null);
    ws.writeRecovery('cave', mapText('cave', 'brouillon'));
    const r = ws.readRecovery('cave');
    assert.match(r.text, /brouillon/);
    assert.ok(Date.parse(r.at) > 0);
    ws.writeRecovery('cave', null);
    assert.equal(ws.readRecovery('cave'), null);
    const tex = JSON.stringify({ name: 'Mur', data: 'data:image/png;base64,iVBORw0KGgo=', size: [2, 2], rough: 0.8, fit: false });
    ws.saveTexture('u_mur', tex);
    assert.deepEqual(ws.listTextures(), [{ id: 'u_mur', text: tex }]);
    ws.deleteTexture('u_mur');
    assert.deepEqual(ws.listTextures(), []);
    const mod = JSON.stringify({ name: 'Tonneau', data: 'data:model/gltf-binary;base64,Z2xURgIAAAA=', scale: 0.01, offset: [0, 0, 0], box: [-0.3, 0, -0.3, 0.3, 0.9, 0.3], solid: true });
    ws.saveModel('u_tonneau', mod);
    assert.deepEqual(ws.listModels(), [{ id: 'u_tonneau', text: mod }]);
    assert.throws(() => ws.saveModel('u_x', JSON.stringify({ data: 'data:image/png;base64,AAAA', box: [] })), /Modèle invalide/);
    assert.throws(() => ws.saveModel('tonneau', mod), /Identifiant/);
    ws.deleteModel('u_tonneau');
    assert.deepEqual(ws.listModels(), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('publication : cartes de l’atelier, du jeu installé et intégrées', () => {
  const dir = tmpDir('zs-ws-');
  const inst = tmpDir('zs-inst-');
  try {
    const ws = new Workspace(dir);
    // sans liste : celle du jeu installé
    fs.mkdirSync(path.join(inst, 'maps'), { recursive: true });
    fs.writeFileSync(path.join(inst, 'maps', 'index.json'), JSON.stringify({ maps: ['bunker7', 'usine'] }));
    fs.writeFileSync(path.join(inst, 'maps', 'usine.json'), mapText('usine', 'Usine (jeu)'));
    let plan = ws.publishPlan(inst);
    assert.deepEqual(plan.index, ['bunker7', 'usine']);
    assert.deepEqual(plan.files.map((f) => [f.id, f.from]), [['bunker7', 'intégrée'], ['usine', 'jeu installé']]);
    // la version de l'atelier remplace celle du jeu ; une carte inconnue est signalée
    ws.saveMap('usine', mapText('usine', 'Usine (atelier)'));
    ws.saveMap('cave', mapText('cave', 'Cave'));
    ws.setPublishSet({ maps: ['cave', 'usine', 'bunker7', 'fantome'] });
    plan = ws.publishPlan(inst);
    assert.deepEqual(plan.index, ['cave', 'usine', 'bunker7']);
    assert.deepEqual(plan.missing, ['fantome']);
    assert.equal(plan.files.find((f) => f.id === 'usine').name, 'Usine (atelier)');
    // aucune liste ni jeu installé : la carte intégrée
    const ws2 = new Workspace(tmpDir('zs-ws2-'));
    assert.deepEqual(ws2.publishPlan(null).index, ['bunker7']);
    fs.rmSync(ws2.dir, { recursive: true, force: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(inst, { recursive: true, force: true });
  }
});

test('paquet du jeu : dossier maps/ remplacé par les cartes publiées', () => {
  const tmp = tmpDir('zs-pack-');
  try {
    // jeu installé : paquet avec une ancienne carte
    const { files } = gamepack.collectPackage({ htmlPath: SOURCE, libsDir: LIBS, version: '1.1.0', maps: { index: ['bunker7', 'vieille'], files: [{ id: 'vieille', data: mapText('vieille', 'Vieille') }] } });
    const instDir = path.join(tmp, 'inst');
    gamepack.writeFolder(files, instDir);
    assert.ok(fs.existsSync(path.join(instDir, 'maps', 'vieille.json')));
    // republication du jeu installé avec d'autres cartes : version réécrite, anciennes cartes retirées
    const out = gamepack.collectPackage({ folderPath: instDir, version: '1.1.1', maps: { index: ['cave', 'bunker7'], files: [{ id: 'cave', data: Buffer.from(mapText('cave', 'Cave')) }] } });
    const names = out.files.map((f) => f.name).sort();
    assert.ok(names.includes('maps/cave.json'));
    assert.ok(!names.includes('maps/vieille.json'));
    assert.deepEqual(JSON.parse(out.files.find((f) => f.name === 'maps/index.json').data), { maps: ['cave', 'bunker7'], files: ['cave'] });
    assert.equal(gamepack.readGameVersion(out.files.find((f) => f.name === 'index.html').data.toString('utf8')), '1.1.1');
    assert.equal(JSON.parse(out.files.find((f) => f.name === 'game.json').data).version, '1.1.1');
    // sans option maps : le dossier du jeu est repris tel quel
    const same = gamepack.collectPackage({ folderPath: instDir, version: '1.1.2' });
    assert.ok(same.files.some((f) => f.name === 'maps/vieille.json'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('jeu : l’éditeur de cartes est disponible dans le moteur (EDITOR_API)', () => {
  const html = fs.readFileSync(SOURCE, 'utf8');
  assert.match(html, /const EDITOR_API = [1-9]\d*;/);
  assert.match(html, /window\.ZS = \{/);
  // les Mod Tools ne sont pas dans le jeu des joueurs
  assert.doesNotMatch(html, /modtools\/core\.js/);
});
