'use strict';
/* Processus principal du launcher Zombie Survival.
   - Fenêtre du launcher (actualités, notes de version, bouton Jouer / Mettre à jour)
   - Fenêtre de jeu : le jeu installé est servi par le protocole zsgame://game/
   - Mises à jour signées du jeu et du launcher (voir updater.js)
   - Outil de publication pour l'auteur (voir publisher.js)
   - Mod Tools (éditeur de cartes) pour l'auteur seulement (voir src/modtools/ et workspace.js) */
const { app, BrowserWindow, ipcMain, protocol, net, shell, dialog, Menu, session, safeStorage, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { Updater, UpdateError, compareVersions, parseVersion } = require('./updater');
const publisher = require('./publisher');
const github = require('./github');
const { readGameVersion } = require('./gamepack');
const { Workspace } = require('./workspace');
const createLog = require('./log');

if (process.env.ZS_USER_DATA) app.setPath('userData', process.env.ZS_USER_DATA);
// PC portables à deux cartes graphiques : le jeu tourne sur la carte la plus puissante.
app.commandLine.appendSwitch('force_high_performance_gpu');

const APP_ROOT = path.join(__dirname, '..', '..');
const RES = app.isPackaged ? process.resourcesPath : APP_ROOT;
const BUNDLE_DIR = path.join(RES, app.isPackaged ? 'game-bundle' : 'game');
const LIBS_DIR = path.join(RES, 'gamelibs');
const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', 'preload');
const MODTOOLS_DIR = path.join(__dirname, '..', 'modtools');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
const APP_ID = 'fr.zombiesurvival.launcher';
const PLACEHOLDER = 'VOTRE-PSEUDO';
const DEFAULT_SETTINGS = { autoCheck: true, autoInstall: true, fullscreen: true, keepLauncherOpen: false };

let log = () => {};
let updater = null;
let config = null;
let settings = { ...DEFAULT_SETTINGS };
let launcherWin = null, gameWin = null, publisherWin = null, modtoolsWin = null;
let modtoolsEngine = null; // { dir, version, source } : jeu servi aux Mod Tools
let authorOk = null;       // clé de l'auteur présente (calculé au démarrage et après chaque changement de clé)
let workspace = null;      // atelier des Mod Tools
let lastManifest = null;
let busy = null; // null | 'check' | 'install' | 'repair' | 'launcher'
let abortCtrl = null;
let phaseAfterPlay = 'ready';
let gameCrash = null;

const status = {
  phase: 'starting', launcherVersion: app.getVersion(), installed: null, remote: null, launcherUpdate: null,
  news: [], progress: null, error: null, settings: null, source: null, author: false,
  justUpdated: process.argv.includes('--updated') ? app.getVersion() : null,
};

protocol.registerSchemesAsPrivileged([
  { scheme: 'zsgame', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

/* ------------------------------------------------------- Réglages --- */
const userFile = (name) => path.join(app.getPath('userData'), name);
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
function loadSettings() { return { ...DEFAULT_SETTINGS, ...(readJson(userFile('settings.json')) || {}) }; }
function loadConfig() {
  const def = readJson(path.join(APP_ROOT, 'config', 'default.json')) || {};
  const user = readJson(userFile('config.json')) || {};
  const cfg = { updateUrl: def.updateUrl || '', publicKey: def.publicKey || '', custom: false, defaultKey: def.publicKey || '' };
  if (typeof user.updateUrl === 'string' && user.updateUrl.trim()) { cfg.updateUrl = user.updateUrl.trim(); cfg.custom = true; }
  if (typeof user.publicKey === 'string' && user.publicKey.includes('BEGIN PUBLIC KEY')) { cfg.publicKey = user.publicKey; cfg.custom = true; }
  cfg.configured = !!cfg.updateUrl && !cfg.updateUrl.includes(PLACEHOLDER) && cfg.publicKey.includes('BEGIN PUBLIC KEY');
  return cfg;
}
function makeUpdater() {
  updater = new Updater({
    dataDir: app.getPath('userData'), bundledDir: BUNDLE_DIR, updateUrl: config.updateUrl, publicKey: config.publicKey,
    fetchImpl: (url, opts) => net.fetch(url, opts), log,
  });
  status.source = {
    url: config.updateUrl, custom: config.custom, configured: config.configured,
    keyFingerprint: safeFingerprint(config.publicKey),
  };
}
function safeFingerprint(pem) { try { return publisher.fingerprint(pem); } catch (e) { return null; } }

/* ----------------------------------------------------------- État --- */
function setStatus(patch) {
  // Pendant une partie, la phase reste « playing » ; la phase calculée est rendue à la fermeture du jeu.
  if (gameWin && patch.phase && patch.phase !== 'playing') {
    phaseAfterPlay = patch.phase;
    patch = { ...patch, phase: 'playing' };
  }
  Object.assign(status, patch);
  for (const w of [launcherWin, publisherWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('launcher:status-changed', status);
  }
}
function pickInstalled(inst) {
  return inst ? { version: inst.version, previous: inst.previous, notes: inst.notes, installedAt: inst.installedAt } : null;
}
function remoteIsNewer() {
  const inst = updater.getInstalled();
  return !!lastManifest && (!inst || compareVersions(lastManifest.game.version, inst.version) > 0);
}
function idlePhase() {
  if (!updater.getInstalled()) return 'error';
  if (remoteIsNewer()) return 'update';
  return lastManifest ? 'ready' : 'offline';
}
function handleError(e, context) {
  const code = (e && e.code) || 'UNKNOWN';
  const message = e instanceof UpdateError ? e.message : `Erreur inattendue : ${e && e.message ? e.message : e}`;
  log(`[${context}] ${code} ${e && e.stack ? e.stack : e}`);
  const installed = pickInstalled(updater.getInstalled());
  if (code === 'CANCELLED') { setStatus({ phase: idlePhase(), progress: null, error: null, installed }); return; }
  const soft = context === 'check' && installed && ['NETWORK', 'TIMEOUT', 'NOT_FOUND', 'HTTP', 'CONFIG'].includes(code);
  setStatus({ phase: soft ? 'offline' : 'error', error: { code, message, context }, progress: null, installed });
}

/* ---------------------------------------------------- Mises à jour --- */
async function checkForUpdates({ auto = false } = {}) {
  if (busy || gameWin) return status;
  if (!config.configured) {
    setStatus({ phase: 'offline', error: { code: 'NOT_CONFIGURED', message: "Mises à jour pas encore configurées : l'adresse de publication est provisoire.", context: 'check' } });
    return status;
  }
  busy = 'check';
  setStatus({ phase: 'checking', error: null });
  try {
    const m = await updater.fetchManifest();
    lastManifest = m;
    writeJson(userFile(path.join('cache', 'last-manifest.json')), { game: m.game, launcher: m.launcher || null, news: m.news || [], published: m.published || null });
    const inst = updater.getInstalled();
    const launcherUpdate = m.launcher && compareVersions(m.launcher.version, app.getVersion()) > 0
      ? { version: m.launcher.version, size: m.launcher.size, notes: m.launcher.notes || [] } : null;
    setStatus({
      remote: { version: m.game.version, size: m.game.size, notes: m.game.notes || [], date: m.game.date || m.published || null },
      news: m.news || [], launcherUpdate, installed: pickInstalled(inst), checkedAt: Date.now(),
      phase: remoteIsNewer() ? 'update' : 'ready', error: null,
    });
    log(`Vérification : en ligne ${m.game.version}, installée ${inst ? inst.version : 'aucune'}${launcherUpdate ? `, launcher ${launcherUpdate.version} annoncé` : ''}`);
    busy = null;
    // Mises à jour automatiques : d'abord le launcher (il redémarre et reprend la vérification), puis le jeu.
    const free = auto && settings.autoInstall && !gameWin && !modtoolsWin && !publisherWin;
    if (free && launcherUpdate && mayAutoUpdateLauncher(launcherUpdate.version)) { await installLauncherUpdate(); return status; }
    if (remoteIsNewer() && auto && settings.autoInstall && !gameWin && !modtoolsWin) await installUpdate();
  } catch (e) {
    busy = null;
    handleError(e, 'check');
  }
  return status;
}

async function installUpdate({ force = false } = {}) {
  if (busy || gameWin || modtoolsWin || !lastManifest) return status;
  const g = lastManifest.game;
  if (!force && !remoteIsNewer()) return status;
  if (g.minLauncher && compareVersions(app.getVersion(), g.minLauncher) < 0) {
    setStatus({ phase: 'error', error: { code: 'LAUNCHER_TOO_OLD', message: `Cette version du jeu demande le launcher ${g.minLauncher} ou plus récent : installez d'abord la mise à jour du launcher.`, context: 'install' } });
    return status;
  }
  busy = 'install';
  abortCtrl = new AbortController();
  setStatus({ phase: 'downloading', error: null, progress: { phase: 'download', received: 0, total: g.size, target: g.version } });
  try {
    const inst = await updater.installGame(lastManifest, {
      signal: abortCtrl.signal,
      onProgress: (p) => setStatus({ phase: p.phase === 'install' ? 'installing' : 'downloading', progress: { ...p, target: g.version } }),
    });
    setStatus({ phase: 'ready', installed: pickInstalled(inst), progress: null, error: null });
  } catch (e) {
    handleError(e, 'install');
  } finally {
    busy = null;
    abortCtrl = null;
  }
  return status;
}

async function repair() {
  if (busy || gameWin) return status;
  const inst = updater.getInstalled();
  if (lastManifest && (!inst || compareVersions(lastManifest.game.version, inst.version) >= 0)) return installUpdate({ force: true });
  busy = 'repair';
  setStatus({ phase: 'installing', error: null, progress: null });
  try {
    const st = updater.readState();
    await updater.writeState({});
    const restored = await updater.ensureBundled();
    if (!restored && st.current) await updater.writeState(st);
    setStatus({ phase: idlePhase(), installed: pickInstalled(updater.getInstalled()) });
  } catch (e) { handleError(e, 'repair'); } finally { busy = null; }
  return status;
}

async function rollback() {
  if (busy || gameWin) return status;
  try {
    const inst = await updater.rollback();
    setStatus({ installed: pickInstalled(inst), phase: idlePhase(), error: null });
  } catch (e) { handleError(e, 'rollback'); }
  return status;
}

/* Installation automatique d'un nouveau launcher : une tentative par version et par
   tranche de 6 heures, pour ne jamais tourner en boucle si l'installateur échoue. */
function mayAutoUpdateLauncher(version) {
  const file = userFile(path.join('cache', 'launcher-autoupdate.json'));
  const last = readJson(file);
  if (last && last.version === version && Date.now() - (Date.parse(last.at) || 0) < 6 * 3600 * 1000) {
    log(`Launcher ${version} : installation automatique déjà tentée (${last.at}), bouton laissé au joueur`);
    return false;
  }
  try { writeJson(file, { version, at: new Date().toISOString() }); } catch (e) { return false; }
  return true;
}

async function installLauncherUpdate() {
  if (busy || gameWin || !lastManifest || !lastManifest.launcher) return status;
  const l = lastManifest.launcher;
  busy = 'launcher';
  abortCtrl = new AbortController();
  setStatus({ phase: 'downloading', error: null, progress: { phase: 'launcher', received: 0, total: l.size, target: l.version } });
  try {
    const setup = await updater.downloadLauncher(lastManifest, {
      signal: abortCtrl.signal,
      onProgress: (p) => setStatus({ progress: { ...p, phase: 'launcher', target: l.version } }),
    });
    log(`Launcher ${l.version} téléchargé : ${setup}`);
    if (process.platform === 'win32') {
      setStatus({ phase: 'restarting', progress: null });
      // Mêmes options qu'electron-updater : installation silencieuse puis relance du launcher.
      const child = spawn(setup, ['--updated', '/S', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      setTimeout(() => app.quit(), 500);
    } else {
      shell.showItemInFolder(setup);
      setStatus({ phase: idlePhase(), progress: null });
    }
  } catch (e) {
    handleError(e, 'launcher');
  } finally {
    busy = null;
    abortCtrl = null;
  }
  return status;
}

/* --------------------------------------------------------- Fenêtres --- */
function harden(win, allowPrefix) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!allowPrefix || !url.startsWith(allowPrefix)) e.preventDefault();
  });
}
function createLauncherWindow() {
  launcherWin = new BrowserWindow({
    width: 1080, height: 660, resizable: false, maximizable: false, fullscreenable: false, frame: false,
    show: false, backgroundColor: '#07090a', title: 'Zombie Survival', icon: ICON,
    webPreferences: { preload: path.join(PRELOAD, 'launcher.js'), contextIsolation: true, sandbox: true, spellcheck: false },
  });
  harden(launcherWin);
  launcherWin.loadFile(path.join(RENDERER, 'launcher', 'index.html'));
  launcherWin.once('ready-to-show', () => launcherWin.show());
  launcherWin.on('closed', () => {
    launcherWin = null;
    if (!gameWin && !modtoolsWin) app.quit();
  });
}
function play() {
  if (gameWin) { gameWin.focus(); return status; }
  const inst = updater.getInstalled();
  if ((busy && busy !== 'check') || !inst) return status;
  phaseAfterPlay = busy === 'check' ? 'checking' : idlePhase();
  gameCrash = null;
  gameWin = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540, show: false, backgroundColor: '#000000',
    title: `Zombie Survival ${inst.version}`, autoHideMenuBar: true, icon: ICON,
    webPreferences: {
      preload: path.join(PRELOAD, 'game.js'), contextIsolation: true, sandbox: true, spellcheck: false,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required',
    },
  });
  harden(gameWin, 'zsgame://game/');
  gameWin.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      e.preventDefault();
      gameWin.setFullScreen(!gameWin.isFullScreen());
    } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      gameWin.webContents.toggleDevTools();
    }
  });
  gameWin.webContents.on('render-process-gone', (e, details) => {
    log(`Jeu arrêté : ${details.reason} (code ${details.exitCode})`);
    if (details.reason !== 'clean-exit') {
      gameCrash = details.reason;
      if (gameWin && !gameWin.isDestroyed()) gameWin.close();
    }
  });
  gameWin.once('ready-to-show', () => {
    if (settings.fullscreen) gameWin.setFullScreen(true); else gameWin.maximize();
    gameWin.show();
    gameWin.focus();
  });
  gameWin.on('closed', () => {
    gameWin = null;
    log('Partie fermée');
    if (!launcherWin) { if (!modtoolsWin) app.quit(); return; }
    launcherWin.show();
    launcherWin.focus();
    if (gameCrash) {
      const reason = gameCrash;
      gameCrash = null;
      setStatus({ phase: 'error', error: { code: 'GAME_CRASH', context: 'game', message: `Le jeu s'est arrêté brutalement (${reason}). Relancez-le ; si cela se répète, utilisez « Réparer le jeu » dans les réglages.` } });
    } else {
      setStatus({ phase: busy === 'check' ? 'checking' : phaseAfterPlay === 'checking' ? idlePhase() : phaseAfterPlay });
      // retour au launcher : nouvelle vérification, installée seule si une mise à jour est sortie entre-temps
      if (settings.autoCheck && config.configured) setTimeout(() => { if (!gameWin) checkForUpdates({ auto: true }).catch(() => {}); }, 1500);
    }
  });
  gameWin.loadURL('zsgame://game/index.html');
  log(`Lancement du jeu ${inst.version}`);
  setStatus({ phase: 'playing' });
  if (!settings.keepLauncherOpen && launcherWin) launcherWin.hide();
  return status;
}
function openPublisher() {
  if (publisherWin) { publisherWin.focus(); return; }
  publisherWin = new BrowserWindow({
    width: 940, height: 780, minWidth: 780, minHeight: 600, show: false, backgroundColor: '#07090a',
    title: 'Zombie Survival — Publication', autoHideMenuBar: true, icon: ICON,
    webPreferences: { preload: path.join(PRELOAD, 'publisher.js'), contextIsolation: true, sandbox: true, spellcheck: false },
  });
  harden(publisherWin);
  publisherWin.loadFile(path.join(RENDERER, 'publisher', 'index.html'));
  publisherWin.once('ready-to-show', () => publisherWin.show());
  publisherWin.on('closed', () => { publisherWin = null; });
}

/* ---------------------------------------------------------- Mod Tools --- */
/* Réservés à l'auteur : la clé privée de publication présente sur ce PC doit correspondre
   à la clé publique intégrée au launcher (config/default.json, dans l'application ; un
   config.json de l'utilisateur ne compte pas). Le code est public : quelqu'un peut se
   construire son propre launcher et son propre éditeur, mais ne peut rien publier pour
   les joueurs de ce launcher sans la clé privée. */
function authorMode(refresh = false) {
  if (authorOk !== null && !refresh) return authorOk;
  let ok = false;
  try {
    const pem = readPrivateKey();
    ok = !!pem && !!config.defaultKey && publisher.sameKey(publisher.publicFromPrivate(pem), config.defaultKey);
  } catch (e) { ok = false; }
  authorOk = ok;
  if (status.author !== ok) setStatus({ author: ok });
  return ok;
}
function editorApiOf(dir) {
  try {
    const m = /const EDITOR_API = (\d+);/.exec(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'));
    return m ? parseInt(m[1], 10) : 0;
  } catch (e) { return 0; }
}
/* Jeu servi aux Mod Tools : la version la plus récente (installée ou livrée) qui contient l'éditeur. */
function editorEngine() {
  const cands = [];
  const inst = updater.getInstalled();
  if (inst) cands.push({ dir: inst.dir, version: inst.version, source: 'installed' });
  const b = updater.bundledInfo();
  if (b) cands.push({ dir: BUNDLE_DIR, version: b.version, source: 'bundled' });
  return cands.filter((c) => editorApiOf(c.dir) >= 1).sort((a, c) => compareVersions(c.version, a.version))[0] || null;
}
function getWorkspace() {
  if (!workspace) workspace = new Workspace(userFile('modtools'));
  return workspace;
}
function openModtools() {
  if (!authorMode(true)) throw new Error("Les Mod Tools sont réservés à l'auteur du jeu : sa clé de publication n'est pas sur ce PC.");
  if (modtoolsWin) {
    if (modtoolsWin.isMinimized()) modtoolsWin.restore();
    modtoolsWin.show();
    modtoolsWin.focus();
    return true;
  }
  const eng = editorEngine();
  if (!eng) throw new Error("Aucune version du jeu sur ce PC ne contient l'éditeur de cartes (jeu 1.1.0 ou plus récent). Utilisez « Réparer le jeu ».");
  modtoolsEngine = eng;
  getWorkspace();
  modtoolsWin = new BrowserWindow({
    width: 1600, height: 940, minWidth: 1180, minHeight: 700, show: false, backgroundColor: '#0b0d0e',
    title: 'Mod Tools — Zombie Survival', autoHideMenuBar: true, icon: ICON,
    webPreferences: {
      preload: path.join(PRELOAD, 'modtools.js'), contextIsolation: true, sandbox: true, spellcheck: false,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required',
    },
  });
  const win = modtoolsWin;
  harden(win, 'zsgame://editor/');
  // fermeture : la page demande d'abord s'il faut enregistrer (sauf si elle ne répond plus)
  win.on('close', (e) => {
    if (win.allowClose) return;
    e.preventDefault();
    win.webContents.send('mt:close-request');
  });
  win.on('unresponsive', () => { win.allowClose = true; });
  win.on('responsive', () => { win.allowClose = false; });
  win.webContents.on('render-process-gone', (e, d) => { log(`Mod Tools arrêtés : ${d.reason}`); win.allowClose = true; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    else if (input.control && input.shift && input.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); win.focus(); });
  win.on('closed', () => {
    modtoolsWin = null;
    modtoolsEngine = null;
    log('Mod Tools fermés');
    if (!launcherWin && !gameWin) app.quit();
  });
  win.loadURL('zsgame://editor/index.html');
  log(`Mod Tools ouverts (jeu ${eng.version}, ${eng.source === 'installed' ? 'installé' : 'livré'})`);
  return true;
}

/* -------------------------------------------- Protocole et permissions --- */
const MIME = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function serveFile(root, rel) {
  const base = path.resolve(root);
  const file = path.resolve(base, `.${rel}`);
  if (!file.startsWith(base + path.sep)) return new Response('Interdit', { status: 403 });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('Introuvable', { status: 404 });
  return net.fetch(pathToFileURL(file).href);
}
/* zsgame://game/   : le jeu installé (fenêtre de jeu)
   zsgame://editor/ : le jeu servi aux Mod Tools + /modtools/ (fichiers de l'éditeur, dans
                      l'application) — seulement quand la fenêtre des Mod Tools est ouverte. */
function registerGameProtocol() {
  protocol.handle('zsgame', (req) => {
    try {
      const u = new URL(req.url);
      let rel = decodeURIComponent(u.pathname);
      if (!rel || rel === '/') rel = '/index.html';
      if (u.hostname === 'game') {
        const inst = updater.getInstalled();
        if (!inst) return new Response('Introuvable', { status: 404 });
        return serveFile(inst.dir, rel);
      }
      if (u.hostname === 'editor') {
        if (!modtoolsWin || !modtoolsEngine || !authorMode()) return new Response('Interdit', { status: 403 });
        if (rel.startsWith('/modtools/')) {
          const name = rel.slice('/modtools/'.length);
          if (!/^[a-z0-9_-]+\.(js|css)$/.test(name)) return new Response('Introuvable', { status: 404 });
          const file = path.join(MODTOOLS_DIR, name);
          if (!fs.existsSync(file)) return new Response('Introuvable', { status: 404 });
          // dans l'archive de l'application : lu avec fs (net.fetch ne lit pas l'asar)
          return new Response(fs.readFileSync(file), { headers: { 'content-type': MIME[path.extname(name)], 'cache-control': 'no-store' } });
        }
        return serveFile(modtoolsEngine.dir, rel);
      }
      return new Response('Introuvable', { status: 404 });
    } catch (e) {
      return new Response('Erreur', { status: 500 });
    }
  });
}
function setupPermissions() {
  const allowed = new Set(['pointerLock', 'fullscreen', 'keyboardLock']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => allowed.has(permission));
}

/* -------------------------------------------- Clé de publication --- */
const keyDir = () => userFile('publisher');
function readPrivateKey() {
  const enc = path.join(keyDir(), 'signing-key.bin'), plain = path.join(keyDir(), 'signing-key.pem');
  try {
    if (fs.existsSync(enc) && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(fs.readFileSync(enc));
    if (fs.existsSync(plain)) return fs.readFileSync(plain, 'utf8');
  } catch (e) { log(`Lecture de la clé impossible : ${e.message}`); }
  return null;
}
function writePrivateKey(pem) {
  fs.mkdirSync(keyDir(), { recursive: true });
  const enc = path.join(keyDir(), 'signing-key.bin'), plain = path.join(keyDir(), 'signing-key.pem');
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(enc, safeStorage.encryptString(pem));
    fs.rmSync(plain, { force: true });
  } else {
    fs.writeFileSync(plain, pem, { mode: 0o600 });
  }
}
/* Jeton GitHub de l'auteur (mise en ligne en un clic) : chiffré par Windows comme la clé. */
const tokenFiles = () => ({ enc: path.join(keyDir(), 'github-token.bin'), plain: path.join(keyDir(), 'github-token.txt') });
function readGithubToken() {
  const { enc, plain } = tokenFiles();
  try {
    if (fs.existsSync(enc) && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(fs.readFileSync(enc));
    if (fs.existsSync(plain)) return fs.readFileSync(plain, 'utf8').trim();
  } catch (e) { log('Lecture du jeton GitHub impossible'); }
  return null;
}
function writeGithubToken(token) {
  fs.mkdirSync(keyDir(), { recursive: true });
  const { enc, plain } = tokenFiles();
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(enc, safeStorage.encryptString(token));
    fs.rmSync(plain, { force: true });
  } else {
    fs.writeFileSync(plain, token, { mode: 0o600 });
  }
}
function forgetGithubToken() {
  const { enc, plain } = tokenFiles();
  fs.rmSync(enc, { force: true });
  fs.rmSync(plain, { force: true });
}
/* Version du jeu inscrite dans un fichier HTML (null si illisible). */
function htmlGameVersion(file) {
  try { return file && fs.existsSync(file) ? readGameVersion(fs.readFileSync(file, 'utf8')) : null; } catch (e) { return null; }
}

function publisherState() {
  const pem = readPrivateKey();
  const pub = pem ? publisher.publicFromPrivate(pem) : null;
  const ps = readJson(path.join(keyDir(), 'settings.json')) || {};
  const inst = updater.getInstalled();
  const fileSource = ps.gameSource && ps.gameSource !== 'installed' ? ps.gameSource : null;
  const gh = ps.github || null;
  const linked = !!readGithubToken();
  const last = ps.lastGameVersion || (inst || {}).version || '1.0.0';
  // numéro proposé : la suite de la dernière publication, ou la version du jeu installé si elle est plus récente
  let suggested = publisher.nextPatch(last);
  if (inst && parseVersion(inst.version) && compareVersions(inst.version, last) > 0 && compareVersions(inst.version, suggested) > 0) suggested = inst.version;
  let maps = null;
  try {
    const plan = getWorkspace().publishPlan(inst && inst.dir);
    maps = { list: plan.files.map((f) => ({ id: f.id, name: f.name, from: f.from })), missing: plan.missing, custom: !!getWorkspace().getPublishSet() };
  } catch (e) { maps = { list: [], missing: [], error: e.message }; }
  return {
    installed: inst ? { version: inst.version, editor: editorApiOf(inst.dir) >= 1 } : null, maps, author: authorMode(),
    hasKey: !!pem, publicKey: pub, fingerprint: pub ? publisher.fingerprint(pub) : null,
    launcherFingerprint: safeFingerprint(config.defaultKey), activeFingerprint: safeFingerprint(config.publicKey),
    keyMatchesLauncher: !!pub && publisher.sameKey(pub, config.defaultKey),
    encrypted: safeStorage.isEncryptionAvailable(),
    repo: ps.repo || '', outDir: ps.outDir || path.join(app.getPath('documents'), 'Zombie Survival - Publications'),
    gameSource: ps.gameSource || '', lastGameVersion: ps.lastGameVersion || null, suggestedVersion: suggested, installedVersion: inst ? inst.version : null,
    gameSourceExists: fileSource ? fs.existsSync(fileSource) : null, gameSourceVersion: htmlGameVersion(fileSource),
    lastLauncher: carriedLauncher(ps), launcherVersion: app.getVersion(), latestUrl: publisher.githubLatestUrl(ps.repo),
    github: { linked, login: linked && gh ? gh.login || null : null, repo: linked && gh ? gh.repo || null : null, encrypted: safeStorage.isEncryptionAvailable(), tokenUrl: 'https://github.com/settings/personal-access-tokens/new' },
    lastOnline: ps.lastOnline || null,
  };
}

/* Fabrique la publication signée (dossier vX.Y.Z) à partir du formulaire de l'outil. */
async function createPublication(form, repoOverride) {
  const pem = readPrivateKey();
  if (!pem) throw new Error("Générez ou importez d'abord une clé de signature.");
  const inst = updater.getInstalled();
  const useInstalled = !!form && form.gameSource === 'installed';
  if (useInstalled && !inst) throw new Error('Aucun jeu installé à republier.');
  if (!form || (!useInstalled && (!form.gameSource || !fs.existsSync(form.gameSource)))) throw new Error('Choisissez le fichier du jeu.');
  // garde-fou : ne pas republier par erreur un code plus ancien que le jeu installé
  if (!useInstalled && inst && !form.allowOlder) {
    const fv = htmlGameVersion(form.gameSource);
    if (fv && compareVersions(fv, inst.version) < 0) {
      throw new Error(`Le fichier choisi contient le jeu ${fv}, plus ancien que le jeu installé (${inst.version}) : ce serait republier un ancien jeu sous un nouveau numéro. Choisissez « Le jeu installé », ou un fichier plus récent.`);
    }
  }
  // le numéro publié ne peut pas être plus petit que la version du code publié
  const codeVersion = useInstalled ? inst.version : htmlGameVersion(form.gameSource);
  if (codeVersion && parseVersion(form.version) && compareVersions(form.version, codeVersion) < 0) {
    throw new Error(`Numéro ${form.version} trop petit : le jeu publié est déjà en version ${codeVersion}. Les launchers qui l'ont ne verraient pas la mise à jour. Choisissez ${codeVersion} ou plus.`);
  }
  const plan = getWorkspace().publishPlan(inst && inst.dir);
  if (plan.missing.length) throw new Error(`Cartes introuvables : ${plan.missing.join(', ')}. Corrigez la liste dans les Mod Tools (Cartes).`);
  const ps = publisherState();
  if (ps.lastGameVersion && parseVersion(form.version) && compareVersions(form.version, ps.lastGameVersion) <= 0 && !form.allowSame) {
    throw new Error(`La version ${form.version} n'est pas plus récente que la dernière publiée (${ps.lastGameVersion}).`);
  }
  const repo = repoOverride || form.repo || null;
  const news = form.newsTitle ? [{ title: form.newsTitle, text: form.newsText || '', date: new Date().toISOString().slice(0, 10) }] : [];
  const notes = String(form.notes || '').split('\n');
  const result = await publisher.createRelease({
    source: useInstalled ? { folderPath: inst.dir } : { htmlPath: form.gameSource }, version: form.version, notes,
    maps: { index: plan.index, files: plan.files.filter((f) => f.data) },
    news, outDir: form.outDir || ps.outDir, privatePem: pem, libsDir: LIBS_DIR, repo,
    launcher: form.setupPath ? { setupPath: form.setupPath, version: form.launcherVersion, notes: String(form.launcherNotes || '').split('\n') } : null,
    previousLauncher: form.setupPath ? null : ps.lastLauncher,
  });
  savePublisherSettings({
    repo: repo || '', outDir: form.outDir || ps.outDir, gameSource: form.gameSource, lastGameVersion: result.version,
    lastLauncher: result.manifest.launcher ? { ...result.manifest.launcher, localPath: /^https?:/.test(result.manifest.launcher.file) ? undefined : path.join(result.dir, result.manifest.launcher.file) } : ps.lastLauncher,
  });
  log(`Publication ${result.version} créée dans ${result.dir} (cartes : ${plan.index.join(', ')})`);
  return {
    dir: result.dir, version: result.version, upload: result.upload, gameSize: result.manifest.game.size, launcher: result.manifest.launcher || null, repo: repo || '',
    notes: notes.map((n) => n.trim()).filter(Boolean),
  };
}

/* Met en ligne le dossier d'une publication déjà créée (premier essai ou reprise). */
async function uploadPublication({ dir, version, upload, notes }) {
  const token = readGithubToken();
  if (!token) throw new Error("Reliez d'abord le launcher à GitHub (étape « Mise en ligne »).");
  if (typeof dir !== 'string' || !fs.existsSync(path.join(dir, 'latest.json'))) throw new Error('Publication introuvable sur ce PC.');
  const ps = readJson(path.join(keyDir(), 'settings.json')) || {};
  const repo = (ps.github && ps.github.repo) || ps.repo;
  const gh = github.createClient({ token });
  const access = await gh.access(repo);
  const send = (p) => { if (publisherWin && !publisherWin.isDestroyed()) publisherWin.webContents.send('pub:progress', p); };
  log(`Mise en ligne de ${version} sur ${access.repo}…`);
  send({ step: 'created', version, files: upload });
  const r = await gh.publish({ repo: access.repo, branch: access.branch, version, dir, files: upload, notes: notes || [], onProgress: send });
  savePublisherSettings({ lastOnline: { version, at: new Date().toISOString(), release: r.release, verified: r.verified } });
  log(`Version ${version} en ligne (${r.release}) ; adresse des mises à jour ${r.verified ? 'vérifiée' : `pas encore à jour : ${r.detail}`}`);
  return r;
}
/* Dernier launcher annoncé, repris dans les publications suivantes tant qu'aucun autre n'est joint.
   Abandonné s'il est plus ancien que le launcher qui publie (installateur de test d'une version
   provisoire, par exemple) ou si son fichier local a disparu. */
function carriedLauncher(ps) {
  const l = ps.lastLauncher;
  if (!l || !parseVersion(l.version) || compareVersions(l.version, app.getVersion()) < 0) return null;
  if (!/^https?:/.test(l.file || '') && !(l.localPath && fs.existsSync(l.localPath))) return null;
  return l;
}
function savePublisherSettings(patch) {
  const file = path.join(keyDir(), 'settings.json');
  writeJson(file, { ...(readJson(file) || {}), ...patch });
}

/* ---------------------------------------------------------- IPC --- */
function from(win, event) { return !!win && !win.isDestroyed() && event.sender === win.webContents; }
function handle(channel, wins, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!wins().some((w) => from(w, event))) throw new Error('Appel refusé');
    return fn(...args);
  });
}
function setupIpc() {
  const L = () => [launcherWin];
  const P = () => [publisherWin];
  const LP = () => [launcherWin, publisherWin];
  handle('launcher:status', LP, () => status);
  handle('launcher:check', L, () => checkForUpdates());
  handle('launcher:install', L, () => installUpdate());
  handle('launcher:cancel', L, () => { if (abortCtrl) abortCtrl.abort(); return true; });
  handle('launcher:play', L, () => play());
  handle('launcher:repair', L, () => repair());
  handle('launcher:rollback', L, () => rollback());
  handle('launcher:updateLauncher', L, () => installLauncherUpdate());
  handle('launcher:publisher', L, () => { openPublisher(); return true; });
  handle('launcher:modtools', L, () => openModtools());
  handle('launcher:open', L, (what) => {
    const target = what === 'logs' ? log.dir : what === 'game' && updater.getInstalled() ? updater.getInstalled().dir : app.getPath('userData');
    return shell.openPath(target);
  });
  handle('launcher:setting', L, (k, v) => {
    if (!(k in DEFAULT_SETTINGS) || typeof v !== 'boolean') return settings;
    settings[k] = v;
    writeJson(userFile('settings.json'), settings);
    setStatus({ settings: { ...settings } });
    return settings;
  });
  handle('launcher:resetSource', L, () => {
    fs.rmSync(userFile('config.json'), { force: true });
    config = loadConfig();
    makeUpdater();
    lastManifest = null;
    setStatus({ remote: null, launcherUpdate: null, news: [] });
    return checkForUpdates();
  });
  handle('launcher:window', L, (action) => {
    if (action === 'minimize') launcherWin.minimize();
    else if (action === 'close') launcherWin.close();
    return true;
  });
  handle('launcher:external', LP, (url) => {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) shell.openExternal(url);
    return true;
  });
  ipcMain.on('game:quit', (event) => { if (from(gameWin, event)) gameWin.close(); });
  ipcMain.on('game:fullscreen', (event) => { if (from(gameWin, event)) gameWin.setFullScreen(!gameWin.isFullScreen()); });

  // ---- Mod Tools (réservés à l'auteur : vérifié à chaque appel)
  const M = () => [modtoolsWin];
  const mt = (channel, fn) => handle(channel, M, (...args) => {
    if (!authorMode()) throw new Error("Mod Tools réservés à l'auteur du jeu.");
    return fn(...args);
  });
  mt('mt:info', () => ({ launcherVersion: app.getVersion(), engine: modtoolsEngine ? { version: modtoolsEngine.version, source: modtoolsEngine.source } : null, workspace: getWorkspace().dir }));
  mt('mt:listMaps', () => getWorkspace().listMaps());
  mt('mt:readMap', (id) => getWorkspace().readMap(id));
  mt('mt:saveMap', (id, text) => getWorkspace().saveMap(id, text));
  mt('mt:deleteMap', (id) => getWorkspace().deleteMap(id));
  mt('mt:readRecovery', (id) => getWorkspace().readRecovery(id));
  mt('mt:writeRecovery', (id, text) => getWorkspace().writeRecovery(id, text));
  mt('mt:listTextures', () => getWorkspace().listTextures());
  mt('mt:saveTexture', (id, text) => getWorkspace().saveTexture(id, text));
  mt('mt:deleteTexture', (id) => getWorkspace().deleteTexture(id));
  mt('mt:listModels', () => getWorkspace().listModels());
  mt('mt:saveModel', (id, text) => getWorkspace().saveModel(id, text));
  mt('mt:deleteModel', (id) => getWorkspace().deleteModel(id));
  mt('mt:importModel', async () => {
    const r = await dialog.showOpenDialog(modtoolsWin, { title: 'Importer un modèle 3D', properties: ['openFile'], filters: [{ name: 'Modèle glTF binaire', extensions: ['glb'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const f = r.filePaths[0];
    if (fs.statSync(f).size > 16 * 1024 * 1024) throw new Error('Modèle trop grand (16 Mo au plus). Réduisez ses textures ou son nombre de polygones.');
    return { name: path.basename(f), dataUrl: `data:model/gltf-binary;base64,${fs.readFileSync(f).toString('base64')}` };
  });
  mt('mt:getPublishSet', () => getWorkspace().getPublishSet());
  mt('mt:setPublishSet', (v) => getWorkspace().setPublishSet(v));
  mt('mt:importMap', async () => {
    const r = await dialog.showOpenDialog(modtoolsWin, { title: 'Importer une carte', properties: ['openFile'], filters: [{ name: 'Carte Zombie Survival', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const f = r.filePaths[0];
    if (fs.statSync(f).size > 40 * 1024 * 1024) throw new Error('Fichier trop grand (40 Mo au plus).');
    return { name: path.basename(f), text: fs.readFileSync(f, 'utf8') };
  });
  mt('mt:exportMap', async (id, text) => {
    if (typeof text !== 'string') throw new Error('Carte vide.');
    const safe = /^[a-z0-9_-]{1,40}$/.test(id) ? id : 'carte';
    const r = await dialog.showSaveDialog(modtoolsWin, { title: 'Exporter la carte', defaultPath: path.join(app.getPath('documents'), `${safe}.json`), filters: [{ name: 'Carte Zombie Survival', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, text);
    return r.filePath;
  });
  mt('mt:importImage', async () => {
    const r = await dialog.showOpenDialog(modtoolsWin, { title: 'Importer une image (texture)', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const f = r.filePaths[0];
    if (fs.statSync(f).size > 25 * 1024 * 1024) throw new Error('Image trop grande (25 Mo au plus).');
    const ext = path.extname(f).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { name: path.basename(f), dataUrl: `data:${mime};base64,${fs.readFileSync(f).toString('base64')}` };
  });
  mt('mt:openPublisher', () => { openPublisher(); return true; });
  mt('mt:openFolder', () => { fs.mkdirSync(getWorkspace().dir, { recursive: true }); return shell.openPath(getWorkspace().dir); });
  ipcMain.on('mt:title', (event, t) => { if (from(modtoolsWin, event) && typeof t === 'string') modtoolsWin.setTitle(t.slice(0, 140)); });
  ipcMain.on('mt:fullscreen', (event) => { if (from(modtoolsWin, event)) modtoolsWin.setFullScreen(!modtoolsWin.isFullScreen()); });
  ipcMain.on('mt:close', (event) => { if (from(modtoolsWin, event)) { modtoolsWin.allowClose = true; modtoolsWin.close(); } });

  // ---- outil de publication
  handle('pub:state', P, () => publisherState());
  handle('pub:generateKey', P, (confirmReplace) => {
    if (readPrivateKey() && confirmReplace !== true) throw new Error('Une clé existe déjà.');
    const kp = publisher.generateKeyPair();
    writePrivateKey(kp.privatePem);
    log(`Nouvelle clé de signature ${publisher.fingerprint(kp.publicPem)}`);
    authorMode(true);
    return publisherState();
  });
  handle('pub:importKey', P, async () => {
    const r = await dialog.showOpenDialog(publisherWin, { title: 'Importer une clé privée', properties: ['openFile'], filters: [{ name: 'Clé PEM', extensions: ['pem', 'key', 'txt'] }] });
    if (r.canceled || !r.filePaths[0]) return publisherState();
    const pem = fs.readFileSync(r.filePaths[0], 'utf8');
    publisher.publicFromPrivate(pem);
    writePrivateKey(pem);
    authorMode(true);
    return publisherState();
  });
  handle('pub:exportKey', P, async () => {
    const pem = readPrivateKey();
    if (!pem) throw new Error('Aucune clé à exporter.');
    const r = await dialog.showSaveDialog(publisherWin, { title: 'Sauvegarder la clé privée', defaultPath: path.join(app.getPath('documents'), 'zombie-survival-cle-privee.pem'), filters: [{ name: 'Clé PEM', extensions: ['pem'] }] });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, pem, { mode: 0o600 });
    return r.filePath;
  });
  handle('pub:copyPublicKey', P, () => {
    const pem = readPrivateKey();
    if (!pem) return false;
    clipboard.writeText(publisher.publicFromPrivate(pem));
    return true;
  });
  handle('pub:pickGame', P, async () => {
    const r = await dialog.showOpenDialog(publisherWin, { title: 'Fichier du jeu', properties: ['openFile'], filters: [{ name: 'Jeu (HTML)', extensions: ['html', 'htm'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const html = fs.readFileSync(r.filePaths[0], 'utf8');
    return { path: r.filePaths[0], version: require('./gamepack').readGameVersion(html) };
  });
  handle('pub:pickSetup', P, async () => {
    const r = await dialog.showOpenDialog(publisherWin, { title: 'Installateur du launcher', properties: ['openFile'], filters: [{ name: 'Installateur', extensions: ['exe'] }] });
    return r.canceled ? null : r.filePaths[0] || null;
  });
  handle('pub:pickOutDir', P, async () => {
    const r = await dialog.showOpenDialog(publisherWin, { title: 'Dossier des publications', properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0] || null;
  });
  handle('pub:create', P, (form) => createPublication(form));
  // ---- mise en ligne en un clic
  let onlineBusy = false;
  handle('pub:githubLink', P, async (token, repo) => {
    const t = github.checkToken(token);
    const ps = readJson(path.join(keyDir(), 'settings.json')) || {};
    const access = await github.createClient({ token: t }).access(String(repo || ps.repo || '').trim(), { probeWrite: true });
    writeGithubToken(t);
    savePublisherSettings({ repo: access.repo, github: { repo: access.repo, login: access.login, branch: access.branch, at: new Date().toISOString() } });
    log(`Launcher relié à GitHub : ${access.repo}${access.login ? ` (compte ${access.login})` : ''}`);
    return publisherState();
  });
  handle('pub:githubUnlink', P, () => {
    forgetGithubToken();
    savePublisherSettings({ github: null });
    log('Launcher délié de GitHub');
    return publisherState();
  });
  handle('pub:publishOnline', P, async (form) => {
    if (onlineBusy) throw new Error('Une mise en ligne est déjà en cours.');
    onlineBusy = true;
    try {
      const token = readGithubToken();
      if (!token) throw new Error("Reliez d'abord le launcher à GitHub (étape « Mise en ligne »).");
      const ps = readJson(path.join(keyDir(), 'settings.json')) || {};
      // le nom exact du dépôt d'abord : les adresses signées dans latest.json en dépendent
      const access = await github.createClient({ token }).access((ps.github && ps.github.repo) || ps.repo || form.repo);
      const created = await createPublication(form, access.repo);
      try {
        const online = await uploadPublication(created);
        return { ...created, online };
      } catch (e) {
        return { ...created, onlineError: String(e && e.message ? e.message : e) };
      }
    } finally { onlineBusy = false; }
  });
  handle('pub:upload', P, async (r) => {
    if (onlineBusy) throw new Error('Une mise en ligne est déjà en cours.');
    onlineBusy = true;
    try { return await uploadPublication(r || {}); } finally { onlineBusy = false; }
  });
  handle('pub:openUrl', P, (url) => {
    if (typeof url === 'string' && /^https:\/\/github\.com\//.test(url)) { shell.openExternal(url); return true; }
    return false;
  });
  handle('pub:modtools', P, () => openModtools());
  handle('pub:openDir', P, (dir) => (typeof dir === 'string' && fs.existsSync(dir) ? shell.openPath(dir) : false));
  handle('pub:testLocal', P, async (dir) => {
    const pem = readPrivateKey();
    const file = path.join(String(dir || ''), 'latest.json');
    if (!pem || !fs.existsSync(file)) throw new Error('Publication introuvable.');
    writeJson(userFile('config.json'), { updateUrl: pathToFileURL(file).href, publicKey: publisher.publicFromPrivate(pem), note: 'Source de test créée par l’outil de publication. Supprimez ce fichier pour revenir à la source officielle.' });
    config = loadConfig();
    makeUpdater();
    lastManifest = null;
    setStatus({});
    await checkForUpdates();
    if (launcherWin) launcherWin.focus();
    return true;
  });
  handle('pub:openGithub', P, (repo, version) => {
    const m = String(repo || '').match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
    const url = m ? `https://github.com/${m[1]}/${m[2]}/releases/new?tag=v${encodeURIComponent(version)}&title=${encodeURIComponent(`Zombie Survival ${version}`)}` : 'https://github.com/new';
    shell.openExternal(url);
    return url;
  });
}

/* -------------------------------------------------------- Démarrage --- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    if (argv.includes('--publier')) openPublisher();
    if (argv.includes('--modtools')) { try { openModtools(); } catch (e) { log(e.message); } }
    const w = gameWin || launcherWin;
    if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); }
  });
  app.whenReady().then(async () => {
    if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
    log = createLog(userFile('logs'));
    log(`Démarrage du launcher ${app.getVersion()} (${process.platform} ${process.arch}, Electron ${process.versions.electron})`);
    Menu.setApplicationMenu(null);
    settings = loadSettings();
    config = loadConfig();
    makeUpdater();
    setupPermissions();
    registerGameProtocol();
    setupIpc();
    authorMode(true);
    log(`Mode auteur : ${authorOk ? 'oui (Mod Tools disponibles)' : 'non'}`);
    try {
      const inst = await updater.ensureBundled();
      setStatus({ installed: pickInstalled(inst) });
    } catch (e) { handleError(e, 'bundle'); }
    const cached = readJson(userFile(path.join('cache', 'last-manifest.json')));
    if (cached && cached.game) {
      setStatus({ news: cached.news || [], remote: { version: cached.game.version, size: cached.game.size, notes: cached.game.notes || [], date: cached.game.date || cached.published, cached: true } });
    }
    if (!updater.getInstalled() && status.phase !== 'error') {
      setStatus({ phase: 'error', error: { code: 'NO_GAME', context: 'bundle', message: "Le jeu n'est pas installé : vérifiez votre connexion puis cliquez sur Réparer." } });
    }
    setStatus({ settings: { ...settings } });
    createLauncherWindow();
    if (process.argv.includes('--publier')) openPublisher();
    if (process.argv.includes('--modtools')) { try { openModtools(); } catch (e) { log(e.message); } }
    launcherWin.webContents.once('did-finish-load', () => {
      if (settings.autoCheck || !updater.getInstalled()) checkForUpdates({ auto: true });
      else setStatus({ phase: idlePhase() });
    });
  });
  app.on('window-all-closed', () => app.quit());
}
