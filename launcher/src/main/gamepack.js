'use strict';
/* Prépare le jeu pour le launcher : la version « navigateur » (un seul fichier
   HTML qui charge Three.js et les polices depuis internet) devient un paquet
   hors ligne : index.html + lib/three.min.js + fonts/. Utilisé à la fois par le
   script de compilation et par l'outil de publication. */
const fs = require('fs');
const path = require('path');
const yazl = require('yazl');

const THREE_RE = /<script[^>]+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/[^"]+"[^>]*><\/script>/i;
const LOCAL_THREE_RE = /<script[^>]+src="lib\/three\.min\.js"[^>]*><\/script>/i;
const FONTS_LINK_RE = /<link[^>]+href="https:\/\/fonts\.googleapis\.com\/[^"]*"[^>]*>/gi;
const PRECONNECT_RE = /<link[^>]+rel="preconnect"[^>]*>\s*/gi;
const VERSION_RE = /const GAME_VERSION = '([^']*)';/;
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

function readGameVersion(html) {
  const m = html.match(VERSION_RE);
  return m ? m[1] : null;
}

function rewriteHtml(html, version) {
  if (!THREE_RE.test(html) && !LOCAL_THREE_RE.test(html)) {
    throw new Error('Ce fichier HTML ne charge pas Three.js : ce n\'est pas le fichier du jeu.');
  }
  let out = html.replace(THREE_RE, '<script src="lib/three.min.js"></script>');
  out = out.replace(PRECONNECT_RE, '');
  let fontsDone = false;
  out = out.replace(FONTS_LINK_RE, () => {
    if (fontsDone) return '';
    fontsDone = true;
    return '<link rel="stylesheet" href="fonts/fonts.css">';
  });
  if (version && VERSION_RE.test(out)) out = out.replace(VERSION_RE, `const GAME_VERSION = '${version}';`);
  return out;
}

function walk(dir, base = dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, base, out);
    else if (ent.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/* Liste des fichiers du paquet : [{ name, data }]
   maps (facultatif) : { index: [ids], files: [{ id, data }] } — remplace le dossier maps/
   du paquet (cartes publiées avec cette version, ordre du menu dans maps/index.json). */
function collectPackage({ htmlPath, folderPath, version, libsDir, notes = [], maps }) {
  const files = [];
  let finalVersion = version;
  if (htmlPath) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    finalVersion = version || readGameVersion(html);
    if (!finalVersion) throw new Error('Numéro de version introuvable : indiquez-le.');
    files.push({ name: 'index.html', data: Buffer.from(rewriteHtml(html, finalVersion), 'utf8') });
    for (const rel of walk(libsDir)) files.push({ name: rel, data: fs.readFileSync(path.join(libsDir, rel)) });
  } else if (folderPath) {
    const rels = walk(folderPath).filter((r) => r !== 'game.json');
    if (!rels.includes('index.html')) throw new Error('Le dossier doit contenir index.html.');
    if (!finalVersion) throw new Error('Indiquez le numéro de version.');
    for (const rel of rels) {
      let data = fs.readFileSync(path.join(folderPath, rel));
      // le numéro affiché par le jeu suit la version publiée
      if (rel === 'index.html') data = Buffer.from(data.toString('utf8').replace(VERSION_RE, `const GAME_VERSION = '${finalVersion}';`), 'utf8');
      files.push({ name: rel, data });
    }
  } else {
    throw new Error('Aucune source de jeu indiquée.');
  }
  if (maps) {
    for (let i = files.length - 1; i >= 0; i--) if (files[i].name.startsWith('maps/')) files.splice(i, 1);
    const ids = (maps.index || []).filter((id) => /^[a-z0-9_-]{1,40}$/.test(id));
    const withFile = [];
    for (const f of maps.files || []) {
      if (!f.data || !/^[a-z0-9_-]{1,40}$/.test(f.id)) continue;
      files.push({ name: `maps/${f.id}.json`, data: Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), 'utf8') });
      withFile.push(f.id);
    }
    // maps : ordre du menu ; files : cartes fournies en fichier (les autres sont intégrées au jeu) ;
    // editor 3 : la liste vient d'un launcher qui connaît Khamsin (le jeu la suit telle quelle)
    files.push({ name: 'maps/index.json', data: Buffer.from(JSON.stringify({ maps: ids, files: withFile, editor: 3 }, null, 2), 'utf8') });
  }
  files.push({
    name: 'game.json',
    data: Buffer.from(JSON.stringify({ name: 'zombie-survival', version: finalVersion, notes }, null, 2), 'utf8'),
  });
  return { files, version: finalVersion };
}

function writeFolder(files, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of files) {
    const target = path.join(dir, ...f.name.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.data);
  }
}

function writeZip(files, zipPath) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const f of files) zip.addBuffer(f.data, f.name, { mtime: FIXED_DATE, mode: 0o100644 });
    zip.end();
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    const out = fs.createWriteStream(zipPath);
    zip.outputStream.pipe(out).on('close', resolve).on('error', reject);
    zip.outputStream.on('error', reject);
  });
}

module.exports = { rewriteHtml, readGameVersion, collectPackage, writeFolder, writeZip, walk };
