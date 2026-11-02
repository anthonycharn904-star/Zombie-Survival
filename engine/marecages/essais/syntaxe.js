// Marécages Maudits : chaque bloc <script> d'un jeu construit est compilé par V8 (vm.Script), sans être exécuté.
// Usage : node essais/syntaxe.js JEU.html
'use strict';
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g;
let m, n = 0, ko = 0;
while ((m = re.exec(html))) {
  n++;
  const ligne = html.slice(0, m.index).split('\n').length;
  try { new vm.Script(m[1], { filename: `bloc ${n} (ligne ${ligne})` }); }
  catch (e) { ko++; console.log(`bloc ${n} (ligne ${ligne}, ${m[1].length} car.) : ${e.name} : ${e.message}`); }
}
console.log(`${n} blocs <script> compilés, ${ko} en erreur`);
process.exit(ko ? 1 : 0);
