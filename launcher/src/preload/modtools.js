'use strict';
/* Pont des Mod Tools : la page (le jeu servi par zsgame://editor/) n'a accès qu'à ces
   fonctions — lecture et écriture des cartes de l'atelier de l'auteur, fenêtres de choix
   de fichiers. Ce preload ajoute aussi les fichiers de l'éditeur à la page. */
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('zsModtools', {
  info: () => invoke('mt:info'),
  listMaps: () => invoke('mt:listMaps'),
  readMap: (id) => invoke('mt:readMap', id),
  saveMap: (id, text) => invoke('mt:saveMap', id, text),
  deleteMap: (id) => invoke('mt:deleteMap', id),
  readRecovery: (id) => invoke('mt:readRecovery', id),
  writeRecovery: (id, text) => invoke('mt:writeRecovery', id, text),
  importMap: () => invoke('mt:importMap'),
  exportMap: (id, text) => invoke('mt:exportMap', id, text),
  importImage: () => invoke('mt:importImage'),
  listTextures: () => invoke('mt:listTextures'),
  saveTexture: (id, text) => invoke('mt:saveTexture', id, text),
  deleteTexture: (id) => invoke('mt:deleteTexture', id),
  listModels: () => invoke('mt:listModels'),
  saveModel: (id, text) => invoke('mt:saveModel', id, text),
  deleteModel: (id) => invoke('mt:deleteModel', id),
  importModel: () => invoke('mt:importModel'),
  getPublishSet: () => invoke('mt:getPublishSet'),
  setPublishSet: (v) => invoke('mt:setPublishSet', v),
  openPublisher: () => invoke('mt:openPublisher'),
  openFolder: () => invoke('mt:openFolder'),
  setTitle: (t) => ipcRenderer.send('mt:title', String(t)),
  toggleFullscreen: () => ipcRenderer.send('mt:fullscreen'),
  close: () => ipcRenderer.send('mt:close'),
  onCloseRequest: (cb) => {
    ipcRenderer.on('mt:close-request', () => cb());
  },
});

/* Fichiers de l'éditeur (servis par le launcher, pas inclus dans le jeu des joueurs). ow-* : cartes
   ouvertes (Khamsin, jeu 2.0.0) ; main.js en dernier (il démarre les Mod Tools). */
const FILES = ['core.js', 'tools.js', 'plan.js', 'view3d.js', 'ui.js', 'ow-core.js', 'ow-tools.js', 'ow-plan.js', 'ow-view.js', 'ow-ui.js', 'main.js'];
window.addEventListener('DOMContentLoaded', () => {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'modtools/modtools.css';
  document.head.appendChild(css);
  for (const f of FILES) {
    const s = document.createElement('script');
    s.src = `modtools/${f}`;
    s.async = false;
    document.head.appendChild(s);
  }
});
