'use strict';
/* Le jeu détecte window.zsLauncher pour afficher « Quitter » dans ses menus. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zsLauncher', {
  quit: () => ipcRenderer.send('game:quit'),
  toggleFullscreen: () => ipcRenderer.send('game:fullscreen'),
  platform: process.platform,
});
