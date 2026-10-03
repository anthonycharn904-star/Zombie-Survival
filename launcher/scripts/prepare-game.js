'use strict';
/* Prépare launcher/game/ : la version hors ligne du jeu livrée avec le launcher
   (copiée dans resources/game-bundle à la compilation, utilisée telle quelle par
   « npm start »). Source : ../game/zombie-survival.html, la version navigateur.
   Même code que l'outil de publication (src/main/gamepack.js).

   Usage : node scripts/prepare-game.js [chemin/vers/zombie-survival.html] */
const path = require('path');
const gamepack = require('../src/main/gamepack');

const ROOT = path.join(__dirname, '..');
const source = path.resolve(process.argv[2] || process.env.ZS_GAME_HTML || path.join(ROOT, '..', 'game', 'zombie-survival.html'));
const outDir = path.join(ROOT, 'game');
const libsDir = path.join(ROOT, 'gamelibs');

try {
  const { files, version } = gamepack.collectPackage({
    htmlPath: source,
    libsDir,
    notes: ['Version livrée avec le launcher'],
  });
  gamepack.writeFolder(files, outDir);
  console.log(`Jeu ${version} préparé dans ${path.relative(process.cwd(), outDir) || outDir} (${files.length} fichiers, source : ${source})`);
} catch (e) {
  console.error(`Préparation du jeu impossible : ${e.message}`);
  process.exit(1);
}
