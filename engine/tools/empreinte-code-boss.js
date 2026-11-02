'use strict';
/* Empreinte du code d'accès du boss de Bunker 7 (jeu 2.0.7, étape 8 du suivi : SUIVI-BOSS-B7.md).
   Le code ne s'écrit nulle part en clair (décision d'Anthony du 1er novembre 2026) : ni dans le dépôt, ni dans un
   document, ni dans la conversation. On le tape ici sans qu'il s'affiche ; l'outil n'écrit que son empreinte, que le jeu
   garde (B7_CODE_EMPREINTE, engine/src/HB-boss-acces.js). Même calcul que le digi pass : FNV-1a 32 bits, salé
   (« zs-boss-b7: » devant le code) ; b7CodeEmpreinte, dans le jeu, doit rester identique.

     node engine/tools/empreinte-code-boss.js        puis taper les 4 chiffres et Entrée
*/
const SEL = 'zs-boss-b7:';
function empreinte(code) {
  let h = 0x811c9dc5;
  for (const ch of SEL + code) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
function finir(code) {
  if (!/^\d{4}$/.test(code)) { console.error('\nIl faut exactement 4 chiffres (le clavier du digi pass n’en prend pas plus).'); process.exit(1); }
  console.log(`\nEmpreinte : 0x${empreinte(code).toString(16).padStart(8, '0')}`);
  process.exit(0);
}
if (!process.stdin.isTTY) {                       // entrée redirigée (essais) : une ligne
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { s += d; });
  process.stdin.on('end', () => finir(s.trim()));
} else {
  process.stdout.write('Code du boss (4 chiffres, il ne s’affiche pas) : ');
  let code = '';
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (k) => {
    for (const c of k) {
      if (c === '\u0003') { process.stdout.write('\n'); process.exit(130); }   // Ctrl+C
      if (c === '\r' || c === '\n') { process.stdin.setRawMode(false); finir(code); return; }
      if (c === '\u007f' || c === '\b') { if (code) { code = code.slice(0, -1); process.stdout.write('\b \b'); } continue; }
      if (/\d/.test(c) && code.length < 4) { code += c; process.stdout.write('*'); }
    }
  });
}
