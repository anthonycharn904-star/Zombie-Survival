'use strict';
/* Maquettes du launcher : captures d'écran des quatre directions, dans le Chromium « sans tête » de Playwright,
   en 2D (aucun WebGL, aucun rendu 3D). Il faut d'abord assembler les maquettes.

     python3 maquettes/launcher/assembler.py [<dossier>]
     node maquettes/launcher/capture.js [<dossier>] [--directions A,B,C]

   Écrit dans <dossier>/captures/ : une image par direction et par vue (fenêtre de 1 280 × 720, à l'échelle 1),
   une planche par direction et la planche de comparaison. Retire DISPLAY et WAYLAND_DISPLAY et trouve seul le
   Chromium de Playwright (ZS_CHROMIUM pour en imposer un autre). */
const path = require('path'), fs = require('fs'), os = require('os');
const ICI = __dirname, REPO = path.join(ICI, '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const argv = process.argv.slice(2);
const OUT = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : path.join(ICI, 'sortie'));
const CAP = path.join(OUT, 'captures');
const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const TOUTES = { A: 'A-militaire', B: 'B-aaa-moderne', C: 'C-nouvelle-generation', D: 'D-hybride' };
const DIRS = (val('--directions') || 'A,B,C,D').split(',').map((k) => TOUTES[k.trim()]).filter(Boolean);
const NOMS = { 'A-militaire': 'A · Militaire cinématographique', 'B-aaa-moderne': 'B · Launcher AAA moderne', 'C-nouvelle-generation': 'C · Nouvelle génération', 'D-hybride': 'D · Hybride A+B' };
// fenêtre redimensionnable (D) : l'accueil à d'autres tailles
const TAILLES_EN_PLUS = { 'D-hybride': [{ nom: '9-accueil-1600x900', titre: 'Accueil · fenêtre de 1 600 × 900', taille: '1600x900' }, { nom: '10-accueil-1080x660', titre: 'Accueil · fenêtre de 1 080 × 660 (taille actuelle)', taille: '1080x660' },
  { nom: '11-accueil-fond-bunker7', titre: 'Accueil · fond Bunker 7 (réglage « Fond de l’accueil »)', taille: '1280x720', reglages: { fond: 'bunker' } },
  { nom: '12-accueil-eclair', titre: 'Accueil · un éclair au sol (une image de l’animation)', taille: '1280x720', reglages: { fond: 'marais' }, eclair: true }] };
const VUES = [
  { nom: '1-accueil', titre: 'Accueil · prêt', section: 'accueil', etat: { phase: 'pret' } },
  { nom: '2-telechargement', titre: 'Mise à jour en cours (62 %)', section: 'accueil', etat: { phase: 'telechargement', pct: 0.62 } },
  { nom: '3-actualites', titre: 'Actualités', section: 'actus', etat: { phase: 'pret' } },
  { nom: '4-mises-a-jour', titre: 'Notes et historique · mise à jour disponible', section: 'maj', etat: { phase: 'maj' } },
  { nom: '5-installation', titre: 'Installation', section: 'installation', etat: { phase: 'pret' } },
  { nom: '6-mod-tools', titre: 'Mod Tools (mode auteur)', section: 'modtools', etat: { phase: 'pret' } },
  { nom: '7-parametres', titre: 'Paramètres', section: 'reglages', etat: { phase: 'pret' } },
  { nom: '8-erreur', titre: 'Erreur de téléchargement', section: 'accueil', etat: { phase: 'erreur' } },
];
fs.mkdirSync(CAP, { recursive: true });
delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;

function chromiumPath() {
  if (process.env.ZS_CHROMIUM) return process.env.ZS_CHROMIUM;
  const pw = path.join(os.homedir(), '.cache', 'ms-playwright');
  try {
    for (const d of fs.readdirSync(pw).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      const p = path.join(pw, d, 'chrome-linux', 'headless_shell');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* pas de cache Playwright */ }
  return '/opt/pw-browsers/chromium';
}
const attendre = (page) => page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {}))));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
});

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--disable-gpu'] });
  const erreurs = [];
  for (const d of DIRS) {
    const fichier = path.join(OUT, d + '.html');
    if (!fs.existsSync(fichier)) { console.error('absent :', fichier, '(lancer assembler.py)'); process.exit(2); }
    const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
    page.on('pageerror', (e) => erreurs.push(`${d} : ${e.message}`));
    await page.goto('file://' + fichier + '?capture');
    await page.evaluate(() => ZSM.maquette({ taille: '1280x720', panneau: false, animations: false }));
    for (const v of VUES) {
      await page.evaluate(([s, e]) => { ZSM.aller(s); ZSM.poser(e); }, [v.section, v.etat]);
      await attendre(page);
      await page.waitForTimeout(120);
      await page.locator('#zsm-fenetre').screenshot({ path: path.join(CAP, `${d}-${v.nom}.png`), animations: 'disabled' });
    }
    for (const t of TAILLES_EN_PLUS[d] || []) {
      const [w, h] = t.taille.split('x').map(Number);
      await page.setViewportSize({ width: w + 120, height: h + 100 });
      await page.evaluate(([taille, reglages]) => { ZSM.maquette({ taille }); Object.assign(ZSM.etat.reglages, reglages || {}); ZSM.aller('accueil'); ZSM.poser({ phase: 'pret' }); }, [t.taille, t.reglages]);
      await attendre(page); await page.waitForTimeout(150);
      if (t.eclair) await page.evaluate(() => window.D_FOND && D_FOND.scene() && D_FOND.scene().image(7.3, true));
      await page.locator('#zsm-fenetre').screenshot({ path: path.join(CAP, `${d}-${t.nom}.png`), animations: 'disabled' });
    }
    await page.close();
    console.log('captures', d);
  }
  // planches : une par direction, puis la comparaison des accueils et des téléchargements
  const tete = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 22px 26px 26px; background: #0b0c0d; color: #e8dfc8; font: 500 16px 'Barlow Condensed', 'Arial Narrow', sans-serif; width: 1748px; }
    h1 { margin: 0 0 4px; font: 700 34px 'Barlow Condensed', sans-serif; letter-spacing: .04em; text-transform: uppercase; }
    p { margin: 0 0 14px; color: #b9b2a2; } .g { display: grid; gap: 16px; } figure { margin: 0; }
    img { display: block; width: 100%; height: auto; border-radius: 4px; box-shadow: 0 0 0 1px rgba(255,255,255,.12); }
    figcaption { margin-top: 5px; font-weight: 600; } h2 { margin: 8px 0 0; font-size: 20px; letter-spacing: .12em; text-transform: uppercase; color: #c9bd9f; }</style></head><body>`;
  const fig = (f, c) => `<figure><img src="${f}.png"><figcaption>${c}</figcaption></figure>`;
  const planches = [];
  for (const d of DIRS) {
    const html = tete + `<h1>Launcher · ${NOMS[d]}</h1><p>Maquette (fonctions simulées) · fenêtre de 1 280 × 720 · captures 2D du 31 octobre 2026.</p>
      <div class="g" style="grid-template-columns:1fr 1fr">${VUES.concat(TAILLES_EN_PLUS[d] || []).map((v) => fig(`${d}-${v.nom}`, v.titre)).join('')}</div></body></html>`;
    planches.push([`planche-${d}`, html]);
  }
  if (['A-militaire', 'B-aaa-moderne', 'D-hybride'].every((d) => DIRS.includes(d))) {
    const ABD = ['A-militaire', 'B-aaa-moderne', 'D-hybride'];
    const html = tete + `<h1>Launcher · A + B → D</h1><p>La maquette hybride D reprend l'architecture de B et l'identité de A ; mêmes données, mêmes états simulés.</p>
      <div class="g" style="grid-template-columns:repeat(3,1fr)">
      ${ABD.map((d) => fig(`${d}-1-accueil`, `${NOMS[d]} · accueil`)).join('')}
      ${ABD.map((d) => fig(`${d}-2-telechargement`, 'Téléchargement')).join('')}
      ${ABD.map((d) => fig(`${d}-4-mises-a-jour`, 'Notes et historique')).join('')}
      ${ABD.map((d) => fig(`${d}-3-actualites`, 'Actualités')).join('')}</div></body></html>`;
    planches.push(['planche-hybride', html]);
  }
  if (['A-militaire', 'B-aaa-moderne', 'C-nouvelle-generation'].every((d) => DIRS.includes(d))) {
    const DIRS = ['A-militaire', 'B-aaa-moderne', 'C-nouvelle-generation'];
    const html = tete + `<h1>Launcher · trois directions</h1><p>Mêmes données, mêmes états simulés ; de gauche à droite : ${DIRS.map((d) => NOMS[d]).join(' · ')}.</p>
      <div class="g" style="grid-template-columns:repeat(${DIRS.length},1fr)">
      ${DIRS.map((d) => fig(`${d}-1-accueil`, `${NOMS[d]} · accueil`)).join('')}
      ${DIRS.map((d) => fig(`${d}-2-telechargement`, 'Téléchargement')).join('')}
      ${DIRS.map((d) => fig(`${d}-4-mises-a-jour`, 'Notes et historique')).join('')}</div></body></html>`;
    planches.push(['planche-comparaison', html]);
  }
  for (const [nom, html] of planches) {
    fs.writeFileSync(path.join(CAP, nom + '.html'), html);
    const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
    await page.goto('file://' + path.join(CAP, nom + '.html'));
    await attendre(page);
    await page.screenshot({ path: path.join(CAP, nom + '.png'), fullPage: true });
    await page.close();
  }
  await browser.close();
  if (erreurs.length) console.log('ERREURS DE PAGE\n' + erreurs.join('\n'));
  console.log(`${DIRS.length * VUES.length} captures et ${planches.length} planches en ${((Date.now() - t0) / 1000).toFixed(0)} s dans ${CAP}`);
})().catch((e) => { console.error(e); process.exit(1); });
