'use strict';
/* Blocs d'un essai de bout en bout exécutés dans la page du jeu (jeu 2.0.6), sans Electron : utilisable dans
   une session Claude Code (Chromium sans tête, voir mains.js). Ne remplace pas la méthode E2 : pas de launcher,
   pas de Mod Tools, et les actions de Playwright entre deux blocs (clavier, souris, menu) n'ont pas lieu, si
   bien que certains blocs échouent ici quel que soit le jeu (les comparer avec le jeu de référence).

     node engine/tools/e2e-page.js <dossier> <essai>…      ex. : node engine/tools/e2e-page.js /tmp/ep weapons grenade

   Chaque bloc « (await game.evaluate(() => { … })).forEach(report); » ou « await game.evaluate(() => { … }); »
   de launcher/e2e/<essai>.e2e.js devient un script de mains.js, joué dans l'ordre dans la même page ; le bilan
   (vérifications réussies, blocs en erreur) est affiché, et chaque résultat est dans <dossier>/<essai>/. */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const [OUT, ...TESTS] = process.argv.slice(2);
if (!OUT || !TESTS.length) { console.error('usage : node engine/tools/e2e-page.js <dossier> <essai>…'); process.exit(2); }

function extract(file, dir) {
  const L = fs.readFileSync(file, 'utf8').split('\n'), out = [];
  const stop = (l) => /^\s*\}\)\)\.forEach\(report\);\s*$/.test(l) || /^\s*\}\);\s*$/.test(l) || /^\s*\}, [A-Za-z_]+\)\)\.forEach\(report\);\s*$/.test(l);
  const indent = (l) => l.match(/^(\s*)/)[1].length;
  for (let i = 0; i < L.length; i++) {
    const m = L[i].match(/^\s*(\(await game\.evaluate\(|await game\.evaluate\(|const \w+ = await game\.evaluate\()(\(\w*\) => \{)\s*$/);
    if (!m) continue;
    let j = i + 1;
    while (j < L.length && !(stop(L[j]) && indent(L[j]) === indent(L[i]))) j++;
    const withArg = /\}, [A-Za-z_]+\)\)/.test(L[j] || '');
    const fn = `(${m[2]}\n${L.slice(i + 1, j).join('\n')}\n})`;
    const f = path.join(dir, `b${String(out.length + 1).padStart(2, '0')}.js`);
    fs.writeFileSync(f, `const r = await ${withArg ? `${fn}(ZS.version)` : `${fn}()`};\nreturn { data: r === undefined ? null : r };`);
    out.push(f);
    i = j;
  }
  return out;
}

for (const t of TESTS) {
  const dir = path.join(OUT, t), bdir = path.join(dir, 'blocs');
  fs.mkdirSync(bdir, { recursive: true });
  const blocks = extract(path.join(REPO, 'launcher', 'e2e', `${t}.e2e.js`), bdir);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'mains.js'), dir, ...blocks.flatMap((b) => ['--script', b])], { cwd: REPO, encoding: 'utf8', timeout: 1700000 });
  const log = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(path.join(dir, 'journal.txt'), log);
  let ok = 0, tot = 0;
  const fails = [];
  for (const b of blocks) {
    const j = path.join(dir, path.basename(b, '.js') + '.json');
    if (!fs.existsSync(j)) continue;
    const d = JSON.parse(fs.readFileSync(j, 'utf8'));
    if (!Array.isArray(d)) continue;
    for (const x of d) { tot++; if (x.ok) ok++; else fails.push(`${path.basename(b, '.js')} ${x.label}`); }
  }
  const errs = [...new Set((log.match(/^ERREUR (b\d+)/gm) || []).map((s) => s.slice(7)))];
  console.log(`${t} : ${ok}/${tot} vérifications · ${blocks.length} blocs${errs.length ? `, en erreur : ${errs.join(' ')}` : ''}`);
  for (const f of fails) console.log(`   ÉCHEC ${f}`);
}
