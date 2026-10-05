'use strict';
/* Mises à jour du jeu et du launcher. Module Node pur (aucune dépendance à
   Electron) pour pouvoir le tester seul.

   Principe :
   1. On télécharge latest.json à une adresse fixe (GitHub Releases ou dossier local).
   2. Le contenu est signé (Ed25519) : sans la clé privée de l'auteur, impossible
      de fabriquer une mise à jour acceptée par le launcher.
   3. Chaque fichier annoncé a une taille et une empreinte SHA-256 vérifiées
      après téléchargement.
   4. Le jeu est extrait dans un dossier temporaire puis activé d'un coup ; la
      version précédente est gardée pour revenir en arrière. */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { fileURLToPath } = require('url');
const yauzl = require('yauzl');
const { mergeHistory } = require('./history');

class UpdateError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.code = code;
    if (cause) this.cause = cause;
  }
}

const VERSION_RE = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;
function parseVersion(v) {
  const m = VERSION_RE.exec(String(v == null ? '' : v).trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) throw new UpdateError('VERSION', `Numéro de version invalide : ${!x ? a : b}`);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

const HEX64 = /^[a-f0-9]{64}$/;
function checkEntry(e, label) {
  const bad = (why) => { throw new UpdateError('MANIFEST_INVALID', `Fichier de mise à jour invalide (${label} : ${why}).`); };
  if (!e || typeof e !== 'object') bad('absent');
  if (!parseVersion(e.version)) bad('version');
  if (typeof e.file !== 'string' || !e.file || e.file.length > 2048) bad('fichier');
  if (!Number.isSafeInteger(e.size) || e.size <= 0) bad('taille');
  if (typeof e.sha256 !== 'string' || !HEX64.test(e.sha256)) bad('empreinte');
  if (e.notes !== undefined && (!Array.isArray(e.notes) || e.notes.some((n) => typeof n !== 'string'))) bad('notes');
  if (e.minLauncher !== undefined && !parseVersion(e.minLauncher)) bad('minLauncher');
}

/* Vérifie la signature et la structure de latest.json ; renvoie le manifeste. */
function verifyManifest(raw, publicKeyPem) {
  let outer;
  try { outer = JSON.parse(raw); } catch (e) { throw new UpdateError('MANIFEST_INVALID', 'Le fichier de mise à jour est illisible.', e); }
  if (!outer || typeof outer.signed !== 'string' || typeof outer.sig !== 'string') {
    throw new UpdateError('UNSIGNED', "Le fichier de mise à jour n'est pas signé : il a été refusé.");
  }
  let key;
  try { key = crypto.createPublicKey(publicKeyPem); } catch (e) { throw new UpdateError('CONFIG', 'La clé publique du launcher est invalide.', e); }
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(outer.signed, 'utf8'), key, Buffer.from(outer.sig, 'base64')); } catch (e) { ok = false; }
  if (!ok) throw new UpdateError('BAD_SIGNATURE', 'La signature de la mise à jour est invalide : elle a été refusée.');
  let m;
  try { m = JSON.parse(outer.signed); } catch (e) { throw new UpdateError('MANIFEST_INVALID', 'Le fichier de mise à jour est illisible.', e); }
  if (!m || m.format !== 1) throw new UpdateError('MANIFEST_INVALID', 'Format de mise à jour non pris en charge par ce launcher.');
  checkEntry(m.game, 'jeu');
  if (m.launcher !== undefined && m.launcher !== null) checkEntry(m.launcher, 'launcher');
  if (m.news !== undefined) {
    if (!Array.isArray(m.news)) throw new UpdateError('MANIFEST_INVALID', 'Fichier de mise à jour invalide (actualités).');
    m.news = m.news.filter((n) => n && typeof n.title === 'string').slice(0, 20)
      .map((n) => ({ title: n.title.slice(0, 160), text: typeof n.text === 'string' ? n.text.slice(0, 2000) : '', date: typeof n.date === 'string' ? n.date.slice(0, 40) : '' }));
  }
  // Notes des versions précédentes (launcher 1.2.6 et plus) : entrées invalides ignorées, jamais bloquant.
  if (m.history !== undefined) m.history = mergeHistory(Array.isArray(m.history) ? m.history : []);
  return m;
}

function netError(e, timedOut) {
  if (timedOut) return new UpdateError('TIMEOUT', 'Le serveur de mises à jour ne répond pas.', e);
  return new UpdateError('NETWORK', 'Impossible de joindre le serveur de mises à jour.', e);
}
function httpError(status) {
  if (status === 404) return new UpdateError('NOT_FOUND', "Aucune publication trouvée à l'adresse de mise à jour.");
  return new UpdateError('HTTP', `Le serveur de mises à jour a répondu ${status}.`);
}

async function fetchText(url, { fetchImpl, timeoutMs = 15000 }) {
  if (url.startsWith('file:')) {
    try { return await fsp.readFile(fileURLToPath(url), 'utf8'); } catch (e) {
      throw new UpdateError(e.code === 'ENOENT' ? 'NOT_FOUND' : 'DISK', `Fichier de mise à jour introuvable : ${fileURLToPath(url)}`, e);
    }
  }
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  try {
    let res;
    try { res = await fetchImpl(url, { signal: ctrl.signal, cache: 'no-store', redirect: 'follow' }); } catch (e) { throw netError(e, timedOut); }
    if (!res.ok) throw httpError(res.status);
    try { return await res.text(); } catch (e) { throw netError(e, timedOut); }
  } finally { clearTimeout(timer); }
}

/* Télécharge url vers dest en vérifiant taille et SHA-256 au fil de l'eau. */
async function downloadFile(url, dest, { size, sha256, onProgress, signal, fetchImpl, idleMs = 30000 }) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  const hash = crypto.createHash('sha256');
  let received = 0, last = 0;
  const emit = (force) => {
    const now = Date.now();
    if (onProgress && (force || now - last > 120)) { last = now; onProgress({ received, total: size }); }
  };
  const ctrl = new AbortController();
  let timedOut = false;
  let idle = null;
  const arm = () => { clearTimeout(idle); idle = setTimeout(() => { timedOut = true; ctrl.abort(); }, idleMs); };
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) throw new UpdateError('CANCELLED', 'Téléchargement annulé.');
    signal.addEventListener('abort', onAbort);
  }
  try {
    let source;
    if (url.startsWith('file:')) {
      const p = fileURLToPath(url);
      if (!fs.existsSync(p)) throw new UpdateError('NOT_FOUND', `Fichier introuvable : ${p}`);
      source = fs.createReadStream(p);
    } else {
      arm();
      let res;
      try { res = await fetchImpl(url, { signal: ctrl.signal, redirect: 'follow', cache: 'no-store' }); } catch (e) { throw netError(e, timedOut); }
      if (!res.ok || !res.body) throw httpError(res.status);
      source = Readable.fromWeb(res.body);
    }
    const meter = new Transform({
      transform(chunk, enc, cb) {
        received += chunk.length;
        if (received > size) { cb(new UpdateError('CHECKSUM', 'Le fichier reçu est plus gros que prévu : téléchargement refusé.')); return; }
        hash.update(chunk);
        if (idle) arm();
        emit(false);
        cb(null, chunk);
      },
    });
    await pipeline(source, meter, fs.createWriteStream(part));
  } catch (e) {
    await fsp.rm(part, { force: true }).catch(() => {});
    if (signal && signal.aborted) throw new UpdateError('CANCELLED', 'Téléchargement annulé.');
    if (e instanceof UpdateError) throw e;
    throw netError(e, timedOut);
  } finally {
    clearTimeout(idle);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
  emit(true);
  if (received !== size || hash.digest('hex') !== sha256) {
    await fsp.rm(part, { force: true }).catch(() => {});
    throw new UpdateError('CHECKSUM', 'Le fichier téléchargé est corrompu (empreinte différente). Réessayez.');
  }
  await fsp.rm(dest, { force: true });
  await renameRetry(part, dest);
  return dest;
}

/* Windows : un antivirus peut verrouiller un fichier quelques instants. */
async function renameRetry(from, to, tries = 6) {
  for (let i = 0; ; i++) {
    try { await fsp.rename(from, to); return; } catch (e) {
      if (i >= tries - 1 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
}

/* Extraction sûre : refuse les chemins absolus, « .. », les archives géantes. */
async function extractZip(zipPath, destDir, { maxBytes = 512 * 1024 * 1024, maxEntries = 5000 } = {}) {
  const root = path.resolve(destDir);
  await fsp.mkdir(root, { recursive: true });
  let zip;
  try {
    zip = await new Promise((res, rej) => yauzl.open(zipPath, { lazyEntries: true, validateEntrySizes: true }, (err, z) => (err ? rej(err) : res(z))));
  } catch (e) { throw new UpdateError('ZIP', "L'archive du jeu est illisible.", e); }
  let total = 0, count = 0;
  await new Promise((resolve, reject) => {
    let done = false;
    const fail = (e) => {
      if (done) return;
      done = true;
      try { zip.close(); } catch (x) { /* déjà fermé */ }
      reject(e instanceof UpdateError ? e : new UpdateError('ZIP', "L'archive du jeu est invalide.", e));
    };
    zip.on('error', fail);
    zip.on('end', () => { if (!done) { done = true; resolve(); } });
    zip.on('entry', async (entry) => {
      try {
        if (++count > maxEntries) throw new UpdateError('ZIP', 'Archive refusée : trop de fichiers.');
        const name = entry.fileName;
        const segs = name.split('/');
        if (!name || name.includes('\\') || name.startsWith('/') || /^[a-zA-Z]:/.test(name) || segs.includes('..')) {
          throw new UpdateError('ZIP', `Archive refusée : chemin interdit (${name}).`);
        }
        const target = path.resolve(root, ...segs.filter(Boolean));
        if (target !== root && !target.startsWith(root + path.sep)) throw new UpdateError('ZIP', `Archive refusée : chemin interdit (${name}).`);
        if (name.endsWith('/')) {
          await fsp.mkdir(target, { recursive: true });
        } else {
          total += entry.uncompressedSize;
          if (total > maxBytes) throw new UpdateError('ZIP', 'Archive refusée : contenu trop volumineux.');
          await fsp.mkdir(path.dirname(target), { recursive: true });
          const rs = await new Promise((res, rej) => zip.openReadStream(entry, (err, s) => (err ? rej(err) : res(s))));
          await pipeline(rs, fs.createWriteStream(target));
        }
        zip.readEntry();
      } catch (e) { fail(e); }
    });
    zip.readEntry();
  });
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

class Updater {
  constructor({ dataDir, bundledDir, updateUrl, publicKey, fetchImpl, log, timeoutMs = 15000 }) {
    this.timeoutMs = timeoutMs;
    this.dataDir = dataDir;
    this.gameDir = path.join(dataDir, 'game');
    this.versionsDir = path.join(this.gameDir, 'versions');
    this.stateFile = path.join(this.gameDir, 'state.json');
    this.cacheDir = path.join(dataDir, 'cache');
    this.bundledDir = bundledDir;
    this.updateUrl = updateUrl;
    this.publicKey = publicKey;
    this.fetchImpl = fetchImpl || ((...a) => globalThis.fetch(...a));
    this.log = log || (() => {});
  }

  readState() { return readJson(this.stateFile) || {}; }
  async writeState(state) {
    await fsp.mkdir(this.gameDir, { recursive: true });
    const tmp = `${this.stateFile}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(state, null, 2));
    await renameRetry(tmp, this.stateFile);
  }
  versionDir(v) { return path.join(this.versionsDir, v); }
  hasVersion(v) { return !!v && parseVersion(v) && fs.existsSync(path.join(this.versionDir(v), 'index.html')); }

  getInstalled() {
    const s = this.readState();
    if (!this.hasVersion(s.current)) return null;
    const info = readJson(path.join(this.versionDir(s.current), 'game.json')) || {};
    return {
      version: s.current,
      dir: this.versionDir(s.current),
      previous: this.hasVersion(s.previous) ? s.previous : null,
      installedAt: s.installedAt || null,
      notes: Array.isArray(info.notes) ? info.notes : [],
    };
  }
  bundledInfo() {
    if (!this.bundledDir) return null;
    const info = readJson(path.join(this.bundledDir, 'game.json'));
    if (!info || !parseVersion(info.version) || !fs.existsSync(path.join(this.bundledDir, 'index.html'))) return null;
    return info;
  }

  /* Premier lancement : installe la version livrée avec le launcher. */
  async ensureBundled() {
    const b = this.bundledInfo();
    const inst = this.getInstalled();
    if (b && (!inst || compareVersions(b.version, inst.version) > 0)) {
      await fsp.mkdir(this.versionsDir, { recursive: true });
      const tmp = path.join(this.versionsDir, `.${b.version}-bundle-${Date.now()}`);
      await fsp.cp(this.bundledDir, tmp, { recursive: true });
      await this.activate(tmp, b.version);
      this.log(`Version livrée installée : ${b.version}`);
    }
    return this.getInstalled();
  }

  /* Adresse d'un fichier annoncé. Les références sont relatives à latest.json ou absolues
     (GitHub). Pour une source locale (test d'une publication avant mise en ligne), un fichier
     absent du web mais présent à côté de latest.json est pris sur place : l'empreinte SHA-256
     signée garantit qu'il s'agit bien du même fichier. */
  resolve(file) {
    const abs = new URL(file, this.updateUrl);
    if (this.updateUrl.startsWith('file:') && /^https?:$/.test(abs.protocol)) {
      const local = new URL(path.posix.basename(abs.pathname), this.updateUrl);
      try { if (fs.existsSync(fileURLToPath(local))) return local.href; } catch (e) { /* adresse locale invalide */ }
    }
    return abs.href;
  }

  async fetchManifest() {
    if (!this.updateUrl) throw new UpdateError('CONFIG', "Aucune adresse de mise à jour n'est configurée.");
    const raw = await fetchText(this.updateUrl, { fetchImpl: this.fetchImpl, timeoutMs: this.timeoutMs });
    return verifyManifest(raw, this.publicKey);
  }

  async installGame(manifest, { onProgress = () => {}, signal } = {}) {
    const g = manifest.game;
    const zip = path.join(this.cacheDir, `zombie-survival-${g.version}.zip`);
    onProgress({ phase: 'download', received: 0, total: g.size });
    await downloadFile(this.resolve(g.file), zip, {
      size: g.size, sha256: g.sha256, signal, fetchImpl: this.fetchImpl,
      onProgress: (p) => onProgress({ phase: 'download', ...p }),
    });
    onProgress({ phase: 'install', received: g.size, total: g.size });
    await this.installFromZip(zip, g.version);
    await fsp.rm(zip, { force: true });
    this.log(`Jeu mis à jour : ${g.version}`);
    return this.getInstalled();
  }

  async installFromZip(zipPath, version) {
    await fsp.mkdir(this.versionsDir, { recursive: true });
    const tmp = path.join(this.versionsDir, `.${version}-${process.pid}-${Date.now()}`);
    try {
      await extractZip(zipPath, tmp);
      if (!fs.existsSync(path.join(tmp, 'index.html'))) throw new UpdateError('ZIP', "L'archive ne contient pas le jeu (index.html manquant).");
      const info = readJson(path.join(tmp, 'game.json'));
      if (info && info.version && info.version !== version) throw new UpdateError('ZIP', "La version contenue dans l'archive ne correspond pas à celle annoncée.");
      await this.activate(tmp, version);
    } catch (e) {
      await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
      if (e instanceof UpdateError) throw e;
      throw new UpdateError('DISK', `Installation impossible : ${e.message}`, e);
    }
  }

  async activate(tmpDir, version) {
    const target = this.versionDir(version);
    const prev = this.readState();
    if (fs.existsSync(target)) {
      const trash = path.join(this.versionsDir, `.trash-${version}-${Date.now()}`);
      await renameRetry(target, trash);
      await fsp.rm(trash, { recursive: true, force: true }).catch(() => {});
    }
    await renameRetry(tmpDir, target);
    const previous = prev.current && prev.current !== version ? prev.current : (prev.previous !== version ? prev.previous || null : null);
    await this.writeState({ current: version, previous, installedAt: new Date().toISOString() });
    await this.cleanup();
  }

  /* Garde la version active et la précédente ; supprime le reste. */
  async cleanup() {
    const s = this.readState();
    let entries = [];
    try { entries = await fsp.readdir(this.versionsDir); } catch (e) { return; }
    for (const name of entries) {
      if (name === s.current || name === s.previous) continue;
      await fsp.rm(path.join(this.versionsDir, name), { recursive: true, force: true }).catch(() => {});
    }
  }

  async rollback() {
    const s = this.readState();
    if (!this.hasVersion(s.previous)) throw new UpdateError('NO_PREVIOUS', "Aucune version précédente n'est disponible.");
    await this.writeState({ current: s.previous, previous: s.current, installedAt: new Date().toISOString() });
    this.log(`Retour à la version ${s.previous}`);
    return this.getInstalled();
  }

  async downloadLauncher(manifest, { onProgress = () => {}, signal } = {}) {
    const l = manifest.launcher;
    const name = path.basename(new URL(this.resolve(l.file)).pathname) || `launcher-${l.version}.exe`;
    const dest = path.join(this.cacheDir, name);
    await downloadFile(this.resolve(l.file), dest, {
      size: l.size, sha256: l.sha256, signal, fetchImpl: this.fetchImpl,
      onProgress: (p) => onProgress({ phase: 'download', ...p }),
    });
    return dest;
  }
}

module.exports = { Updater, UpdateError, verifyManifest, compareVersions, parseVersion, downloadFile, extractZip };
