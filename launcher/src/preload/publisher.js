'use strict';
/* Pont de l'outil de publication (fenêtre réservée à l'auteur du jeu). */
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('pub', {
  state: () => invoke('pub:state'),
  launcherStatus: () => invoke('launcher:status'),
  generateKey: (confirmReplace) => invoke('pub:generateKey', confirmReplace === true),
  importKey: () => invoke('pub:importKey'),
  exportKey: () => invoke('pub:exportKey'),
  copyPublicKey: () => invoke('pub:copyPublicKey'),
  pickGame: () => invoke('pub:pickGame'),
  pickSetup: () => invoke('pub:pickSetup'),
  pickOutDir: () => invoke('pub:pickOutDir'),
  create: (form) => invoke('pub:create', form),
  openDir: (dir) => invoke('pub:openDir', dir),
  testLocal: (dir) => invoke('pub:testLocal', dir),
  openGithub: (repo, version) => invoke('pub:openGithub', repo, version),
  openExternal: (url) => invoke('launcher:external', url),
  openModtools: () => invoke('pub:modtools'),
  githubLink: (token, repo) => invoke('pub:githubLink', String(token || ''), String(repo || '')),
  githubUnlink: () => invoke('pub:githubUnlink'),
  publishOnline: (form) => invoke('pub:publishOnline', form),
  upload: (r) => invoke('pub:upload', r),
  openUrl: (url) => invoke('pub:openUrl', url),
  onProgress: (cb) => {
    const fn = (event, p) => cb(p);
    ipcRenderer.on('pub:progress', fn);
    return () => ipcRenderer.removeListener('pub:progress', fn);
  },
  onStatus: (cb) => {
    const fn = (event, status) => cb(status);
    ipcRenderer.on('launcher:status-changed', fn);
    return () => ipcRenderer.removeListener('launcher:status-changed', fn);
  },
});
