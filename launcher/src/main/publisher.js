'use strict';
/* Outil de publication : fabrique une version prête à mettre en ligne.
   Sortie : un dossier vX.Y.Z contenant
     - zombie-survival-X.Y.Z.zip  (le jeu hors ligne)
     - latest.json                (manifeste signé avec la clé privée de l'auteur)
     - le setup du launcher, si une nouvelle version du launcher est jointe. */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const gamepack = require('./gamepack');
const { parseVersion, compareVersions } = require('./updater');
const { WEB_BASE } = require('./github');
const { historyBefore } = require('./history');

function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return {
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}
function publicFromPrivate(privatePem) {
  return crypto.createPublicKey(crypto.createPrivateKey(privatePem)).export({ type: 'spki', format: 'pem' });
}
function fingerprint(publicPem) {
  const der = crypto.createPublicKey(publicPem).export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
}
function sameKey(a, b) {
  try { return fingerprint(a) === fingerprint(b); } catch (e) { return false; }
}
async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    fs.createReadStream(file).on('data', (d) => hash.update(d)).on('end', resolve).on('error', reject);
  });
  return hash.digest('hex');
}
function signManifest(manifest, privatePem) {
  const signed = JSON.stringify(manifest, null, 2);
  const key = crypto.createPrivateKey(privatePem);
  const sig = crypto.sign(null, Buffer.from(signed, 'utf8'), key).toString('base64');
  return { format: 1, key: fingerprint(publicFromPrivate(privatePem)), signed, sig };
}
function githubBase(repo, webBase = WEB_BASE) {
  if (!repo) return null;
  const m = String(repo).trim().match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  if (!m) throw new Error('Dépôt GitHub attendu sous la forme pseudo/depot.');
  return `${webBase}/${m[1]}/${m[2]}/releases/download/v{version}/`;
}
function githubLatestUrl(repo, webBase = WEB_BASE) {
  const m = String(repo || '').trim().match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  return m ? `${webBase}/${m[1]}/${m[2]}/releases/latest/download/latest.json` : null;
}

/* opts : { source: { htmlPath | folderPath }, version, notes, news, outDir, privatePem, libsDir,
            repo?, webBase?, launcher?: { setupPath, version, notes }, previousLauncher?, minLauncher?,
            maps?: { index, files } (cartes du paquet, voir gamepack.collectPackage),
            history?: [{ version, date, notes }] (versions déjà publiées ; seules les antérieures
            à `version` sont jointes, voir history.js) } */
async function createRelease(opts) {
  if (!opts.privatePem) throw new Error("Aucune clé de signature : générez-en une d'abord.");
  const notes = (opts.notes || []).map((n) => String(n).trim()).filter(Boolean);
  const { files, version } = gamepack.collectPackage({ ...opts.source, version: opts.version, libsDir: opts.libsDir, notes, maps: opts.maps });
  if (!parseVersion(version)) throw new Error(`Numéro de version invalide : ${version} (format attendu : 1.2.3).`);
  const base = githubBase(opts.repo, opts.webBase);
  const ref = (name) => (base ? base.replace('{version}', version) + encodeURIComponent(name) : name);
  const dir = path.join(opts.outDir, `v${version}`);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
  const zipName = `zombie-survival-${version}.zip`;
  const zipPath = path.join(dir, zipName);
  await gamepack.writeZip(files, zipPath);
  const date = new Date().toISOString();
  const manifest = {
    format: 1,
    published: date,
    game: { version, file: ref(zipName), size: (await fsp.stat(zipPath)).size, sha256: await sha256File(zipPath), notes, date },
  };
  if (opts.minLauncher) manifest.game.minLauncher = opts.minLauncher;
  const upload = [zipName];
  if (opts.launcher && opts.launcher.setupPath) {
    const lv = opts.launcher.version;
    if (!parseVersion(lv)) throw new Error(`Version du launcher invalide : ${lv}`);
    const setupName = `Zombie-Survival-Setup-${lv}.exe`;
    const setupPath = path.join(dir, setupName);
    await fsp.copyFile(opts.launcher.setupPath, setupPath);
    manifest.launcher = {
      version: lv, file: ref(setupName), size: (await fsp.stat(setupPath)).size, sha256: await sha256File(setupPath),
      notes: (opts.launcher.notes || []).map(String).filter(Boolean),
    };
    upload.push(setupName);
  } else if (opts.previousLauncher) {
    // Garde l'annonce de la dernière version du launcher pour les joueurs en retard.
    const prev = opts.previousLauncher;
    if (/^https?:/.test(prev.file)) manifest.launcher = prev;
    else if (prev.localPath && fs.existsSync(prev.localPath)) {
      const name = path.basename(prev.localPath);
      await fsp.copyFile(prev.localPath, path.join(dir, name));
      manifest.launcher = { ...prev, file: name };
      delete manifest.launcher.localPath;
      upload.push(name);
    }
  }
  if (Array.isArray(opts.news) && opts.news.length) manifest.news = opts.news;
  // Notes des versions précédentes : le launcher les montre dans « Historique des mises à jour ».
  const history = historyBefore(version, opts.history || []);
  if (history.length) manifest.history = history;
  await fsp.writeFile(path.join(dir, 'latest.json'), JSON.stringify(signManifest(manifest, opts.privatePem), null, 2));
  upload.unshift('latest.json');
  return { dir, version, manifest, upload };
}

function nextPatch(v) {
  const p = parseVersion(v);
  return p ? `${p[0]}.${p[1]}.${p[2] + 1}` : '1.0.0';
}

module.exports = {
  generateKeyPair, publicFromPrivate, fingerprint, sameKey, sha256File, signManifest, createRelease,
  githubBase, githubLatestUrl, nextPatch, compareVersions,
};
