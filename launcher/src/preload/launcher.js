'use strict';
/* Pont entre l'interface du launcher et le processus principal.
   L'interface n'a accès qu'à ces fonctions (pas de Node, pas de fichiers). */
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('zs', {
  status: () => invoke('launcher:status'),
  check: () => invoke('launcher:check'),
  install: () => invoke('launcher:install'),
  cancel: () => invoke('launcher:cancel'),
  play: () => invoke('launcher:play'),
  repair: () => invoke('launcher:repair'),
  rollback: () => invoke('launcher:rollback'),
  updateLauncher: () => invoke('launcher:updateLauncher'),
  openPublisher: () => invoke('launcher:publisher'),
  open: (what) => invoke('launcher:open', what),
  setSetting: (key, value) => invoke('launcher:setting', key, value),
  resetSource: () => invoke('launcher:resetSource'),
  windowAction: (action) => invoke('launcher:window', action),
  openExternal: (url) => invoke('launcher:external', url),
  onStatus: (cb) => {
    const fn = (event, status) => cb(status);
    ipcRenderer.on('launcher:status-changed', fn);
    return () => ipcRenderer.removeListener('launcher:status-changed', fn);
  },
});
