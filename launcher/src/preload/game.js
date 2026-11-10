'use strict';
/* Le jeu détecte window.zsLauncher pour afficher « Quitter » dans ses menus. */
const { contextBridge, ipcRenderer } = require('electron');

// fermeture de la fenêtre demandée par le launcher : le jeu répond (sauvegarde, confirmation) ; sans réponse prévue
// (jeu plus ancien, ou encore en chargement), la fenêtre se ferme aussitôt (jeu 2.0.7)
let fermeture = null;
ipcRenderer.on('game:close-request', () => { if (fermeture) fermeture(); else ipcRenderer.send('game:quit'); });

contextBridge.exposeInMainWorld('zsLauncher', {
  quit: () => ipcRenderer.send('game:quit'),
  toggleFullscreen: () => ipcRenderer.send('game:fullscreen'),
  platform: process.platform,
  onCloseRequest: (cb) => { if (typeof cb === 'function') fermeture = cb; },
  // sauvegardes des parties (jeu 2.0.7) : fichiers du dossier utilisateur du launcher (écriture atomique, copie)
  sauvegardes: {
    lire: (carte, type) => ipcRenderer.invoke('game:sauve', 'lire', carte, type),
    ecrire: (carte, type, texte) => ipcRenderer.invoke('game:sauve', 'ecrire', carte, type, texte),
    supprimer: (carte, type) => ipcRenderer.invoke('game:sauve', 'supprimer', carte, type),
    liste: () => ipcRenderer.invoke('game:sauve', 'liste'),
    brut: (carte, type, copie, texte) => ipcRenderer.invoke('game:sauve', 'brut', carte, type, texte, copie),
  },
});
