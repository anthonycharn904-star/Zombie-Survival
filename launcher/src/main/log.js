'use strict';
/* Journal simple : %APPDATA%\Zombie Survival\logs\launcher.log (1 Mo max, puis rotation). */
const fs = require('fs');
const path = require('path');

module.exports = function createLog(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* journal facultatif */ }
  const file = path.join(dir, 'launcher.log');
  try { if (fs.statSync(file).size > 1000000) fs.renameSync(file, `${file}.1`); } catch (e) { /* pas encore de journal */ }
  const log = (msg) => {
    const line = `${new Date().toISOString()} ${msg}\n`;
    try { fs.appendFileSync(file, line); } catch (e) { /* disque plein ou verrouillé */ }
    if (process.env.ZS_DEBUG) process.stdout.write(line);
  };
  log.file = file;
  log.dir = dir;
  return log;
};
