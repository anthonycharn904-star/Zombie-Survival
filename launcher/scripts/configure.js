'use strict';
/* Réécrit config/default.json : adresse du manifeste latest.json et clé publique
   qui vérifie les mises à jour.

   Usage : npm run configure -- pseudo/depot cle-publique.pem

   Seule la partie publique de la clé est écrite. Si on lui donne la clé privée
   par erreur, le script en extrait la clé publique et n'écrit jamais la clé privée. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { githubLatestUrl, fingerprint } = require('../src/main/publisher');

const [repo, keyFile] = process.argv.slice(2);
function fail(msg) {
  console.error(msg);
  console.error('Usage : npm run configure -- pseudo/depot cle-publique.pem');
  process.exit(1);
}
if (!repo || !keyFile) fail('Arguments manquants.');
const updateUrl = githubLatestUrl(repo);
if (!updateUrl) fail(`Dépôt invalide : « ${repo} » (format attendu : pseudo/depot).`);

let pem;
try { pem = fs.readFileSync(keyFile, 'utf8'); } catch (e) { fail(`Lecture impossible : ${keyFile}`); }
let key;
try { key = crypto.createPublicKey(pem); } catch (e) { fail(`Ce fichier ne contient pas de clé lisible : ${keyFile}`); }
if (key.asymmetricKeyType !== 'ed25519') fail(`Clé de type ${key.asymmetricKeyType} : une clé Ed25519 est attendue.`);
if (/PRIVATE KEY/.test(pem)) {
  console.warn('Attention : ce fichier est la clé PRIVÉE. Seule sa partie publique est écrite dans la configuration.');
  console.warn('Ne mettez jamais la clé privée dans le dépôt ni dans un message.');
}
const publicKey = key.export({ type: 'spki', format: 'pem' });

const target = path.join(__dirname, '..', 'config', 'default.json');
fs.writeFileSync(target, `${JSON.stringify({ updateUrl, publicKey }, null, 2)}\n`);
console.log(`Configuration écrite : ${target}`);
console.log(`  Manifeste : ${updateUrl}`);
console.log(`  Empreinte de la clé publique : ${fingerprint(publicKey)}`);
