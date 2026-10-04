'use strict';
/* Atelier des Mod Tools : les cartes et images de l'auteur, sur son PC.
     <userData>/modtools/maps/<id>.json        cartes
     <userData>/modtools/textures/<id>.json    images importées (u_…)
     <userData>/modtools/models/<id>.json      modèles 3D importés (.glb, u_…)
     <userData>/modtools/publish.json          cartes publiées avec le jeu, dans l'ordre du menu
     <userData>/modtools/recovery/<id>.json    copies de secours (modifications non enregistrées)
     <userData>/modtools/versions/<id>/…       5 dernières versions de chaque carte
     <userData>/modtools/corbeille/…           cartes supprimées */
const fs = require('fs');
const path = require('path');

const MAP_ID = /^[a-z0-9_-]{1,40}$/;
const TEX_ID = /^u_[\w-]{1,40}$/;
const MAX_MAP_BYTES = 40 * 1024 * 1024;
const MAX_TEX_BYTES = 12 * 1024 * 1024;
const MAX_MODEL_BYTES = 24 * 1024 * 1024;
const KEEP_VERSIONS = 5;
/* Cartes intégrées au fichier du jeu (pas de fichier dans maps/ tant qu'on ne les modifie pas). */
const BUILTIN_MAPS = ['bunker7'];

function checkId(id, re, what) {
  if (typeof id !== 'string' || !re.test(id)) throw new Error(`Identifiant de ${what} invalide.`);
  return id;
}
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
function readJsonFile(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

class Workspace {
  constructor(dir) {
    this.dir = dir;
  }
  sub(...p) { return path.join(this.dir, ...p); }
  mapFile(id) { return this.sub('maps', `${checkId(id, MAP_ID, 'carte')}.json`); }

  /* ------------------------------------------------------------- cartes */
  listMaps() {
    const dir = this.sub('maps');
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const name of fs.readdirSync(dir)) {
      const m = /^([a-z0-9_-]{1,40})\.json$/.exec(name);
      if (!m) continue;
      const file = path.join(dir, name);
      let meta = { name: m[1], updated: null };
      try {
        // le début du fichier suffit (nom et date sont en tête) ; sinon lecture complète
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(4096);
        const n = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const head = buf.slice(0, n).toString('utf8');
        const name2 = /"name":\s*("(?:[^"\\]|\\.)*")/.exec(head);
        const upd = /"updated":\s*("(?:[^"\\]|\\.)*")/.exec(head);
        if (name2) meta.name = JSON.parse(name2[1]);
        if (upd) meta.updated = JSON.parse(upd[1]);
        if (!name2) { const o = readJsonFile(file); if (o) meta = { name: o.name || m[1], updated: o.updated || null }; }
      } catch (e) { /* fichier illisible : listé quand même */ }
      const rec = this.sub('recovery', name);
      out.push({ id: m[1], name: meta.name, updated: meta.updated, bytes: fs.statSync(file).size, recovery: fs.existsSync(rec) ? fs.statSync(rec).mtime.toISOString() : null });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  hasMap(id) { return MAP_ID.test(id) && fs.existsSync(this.mapFile(id)); }
  readMap(id) {
    const f = this.mapFile(id);
    if (!fs.existsSync(f)) throw new Error('Carte introuvable dans l’atelier.');
    return fs.readFileSync(f, 'utf8');
  }
  saveMap(id, text) {
    checkId(id, MAP_ID, 'carte');
    if (typeof text !== 'string' || text.length > MAX_MAP_BYTES) throw new Error('Carte trop grande (40 Mo au plus).');
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Carte illisible (JSON invalide).'); }
    if (!o || !Array.isArray(o.grid)) throw new Error('Ce n’est pas une carte (grille absente).');
    const f = this.mapFile(id);
    if (fs.existsSync(f)) {
      // garde les dernières versions
      const vdir = this.sub('versions', id);
      fs.mkdirSync(vdir, { recursive: true });
      fs.copyFileSync(f, path.join(vdir, `${stamp()}.json`));
      const old = fs.readdirSync(vdir).filter((n) => n.endsWith('.json')).sort();
      for (const n of old.slice(0, Math.max(0, old.length - KEEP_VERSIONS))) fs.rmSync(path.join(vdir, n), { force: true });
    }
    writeAtomic(f, text);
    return { ok: true, file: f };
  }
  deleteMap(id) {
    const f = this.mapFile(id);
    if (!fs.existsSync(f)) return false;
    const trash = this.sub('corbeille');
    fs.mkdirSync(trash, { recursive: true });
    fs.renameSync(f, path.join(trash, `${id}-${stamp()}.json`));
    fs.rmSync(this.sub('recovery', `${id}.json`), { force: true });
    return true;
  }
  readRecovery(id) {
    const f = this.sub('recovery', `${checkId(id, MAP_ID, 'carte')}.json`);
    if (!fs.existsSync(f)) return null;
    return { text: fs.readFileSync(f, 'utf8'), at: fs.statSync(f).mtime.toISOString() };
  }
  writeRecovery(id, text) {
    const f = this.sub('recovery', `${checkId(id, MAP_ID, 'carte')}.json`);
    if (!text) { fs.rmSync(f, { force: true }); return true; }
    if (typeof text !== 'string' || text.length > MAX_MAP_BYTES) throw new Error('Copie de secours trop grande.');
    writeAtomic(f, text);
    return true;
  }

  /* ------------------------------------------------------------ images */
  listTextures() {
    const dir = this.sub('textures');
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const name of fs.readdirSync(dir)) {
      const m = /^(u_[\w-]{1,40})\.json$/.exec(name);
      if (!m) continue;
      try { out.push({ id: m[1], text: fs.readFileSync(path.join(dir, name), 'utf8') }); } catch (e) { /* ignorée */ }
    }
    return out;
  }
  saveTexture(id, text) {
    checkId(id, TEX_ID, 'texture');
    if (typeof text !== 'string' || text.length > MAX_TEX_BYTES) throw new Error('Image trop grande.');
    const o = JSON.parse(text);
    if (!o || typeof o.data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(o.data)) throw new Error('Image invalide.');
    writeAtomic(this.sub('textures', `${id}.json`), text);
    return true;
  }
  deleteTexture(id) {
    fs.rmSync(this.sub('textures', `${checkId(id, TEX_ID, 'texture')}.json`), { force: true });
    return true;
  }

  /* ------------------------------------------------------------ modèles */
  listModels() {
    const dir = this.sub('models');
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const name of fs.readdirSync(dir)) {
      const m = /^(u_[\w-]{1,40})\.json$/.exec(name);
      if (!m) continue;
      try { out.push({ id: m[1], text: fs.readFileSync(path.join(dir, name), 'utf8') }); } catch (e) { /* ignoré */ }
    }
    return out;
  }
  saveModel(id, text) {
    checkId(id, TEX_ID, 'modèle');
    if (typeof text !== 'string' || text.length > MAX_MODEL_BYTES) throw new Error('Modèle trop grand (16 Mo au plus).');
    const o = JSON.parse(text);
    if (!o || typeof o.data !== 'string' || !/^data:model\/gltf-binary;base64,/.test(o.data) || !Array.isArray(o.box)) throw new Error('Modèle invalide.');
    writeAtomic(this.sub('models', `${id}.json`), text);
    return true;
  }
  deleteModel(id) {
    fs.rmSync(this.sub('models', `${checkId(id, TEX_ID, 'modèle')}.json`), { force: true });
    return true;
  }

  /* ------------------------------------------------------- publication */
  getPublishSet() {
    const o = readJsonFile(this.sub('publish.json'));
    if (!o || !Array.isArray(o.maps)) return null;
    return { maps: o.maps.filter((id) => typeof id === 'string' && MAP_ID.test(id)), updated: o.updated || null };
  }
  setPublishSet(v) {
    const maps = Array.isArray(v && v.maps) ? [...new Set(v.maps.filter((id) => typeof id === 'string' && MAP_ID.test(id)))].slice(0, 100) : [];
    if (!maps.length) throw new Error('Le jeu doit garder au moins une carte.');
    writeAtomic(this.sub('publish.json'), JSON.stringify({ maps, updated: new Date().toISOString() }, null, 2));
    return true;
  }
  /* Cartes à mettre dans le paquet du jeu : la liste de l'atelier (ou, à défaut, celle du
     jeu installé). Chaque carte vient de l'atelier, sinon du jeu installé ; les cartes
     intégrées au fichier du jeu n'ont pas besoin de fichier.
     Renvoie { index: [ids], files: [{ id, name, data }], missing: [ids] }. */
  publishPlan(installedDir) {
    let ids = (this.getPublishSet() || {}).maps;
    if (!ids || !ids.length) {
      const idx = installedDir ? readJsonFile(path.join(installedDir, 'maps', 'index.json')) : null;
      ids = idx && Array.isArray(idx.maps) ? idx.maps.filter((id) => typeof id === 'string' && MAP_ID.test(id)) : BUILTIN_MAPS.slice();
    }
    const index = [], files = [], missing = [];
    for (const id of ids) {
      const own = this.sub('maps', `${id}.json`);
      const inst = installedDir ? path.join(installedDir, 'maps', `${id}.json`) : null;
      let file = null, from = null;
      if (fs.existsSync(own)) { file = own; from = 'atelier'; } else if (inst && fs.existsSync(inst)) { file = inst; from = 'jeu installé'; }
      if (file) {
        const data = fs.readFileSync(file);
        let name = id;
        try { name = JSON.parse(data.toString('utf8')).name || id; } catch (e) { missing.push(id); continue; }
        files.push({ id, name, from, data });
        index.push(id);
      } else if (BUILTIN_MAPS.includes(id)) {
        index.push(id);
        files.push({ id, name: id === 'bunker7' ? 'Bunker 7' : id, from: 'intégrée', data: null });
      } else missing.push(id);
    }
    if (!index.length) index.push(...BUILTIN_MAPS);
    return { index, files, missing };
  }
}

module.exports = { Workspace, BUILTIN_MAPS, MAP_ID, TEX_ID };
