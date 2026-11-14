# Marécages Maudits : retouches des modules autonomes du kit (orig/), écrites pour l'intégration.
# Décision d'Anthony du 13 novembre 2026 (« Par morceaux en jeu ») : la Mère-Vase ne coûte plus ses 4 s au chargement du
# marais ; les textures de sa peau (91 % du temps de sa création en qualité haute) se calculent par morceaux pendant la
# partie, sans gel. Le fichier orig/mere-vase.js reste celui du kit (empreinte contrôlée par etape.py) ; ces retouches
# sont appliquées à son insertion, chacune trouvée exactement une fois, sinon la construction s'arrête.
#
# Ce qu'elles font, sans rien changer à ce qui est calculé :
#   - makeSkinTextures devient un générateur (makeSkinTexturesPas) qui rend la main après chaque ligne de pixels (et
#     toutes les 64 verrues) ; makeSkinTextures le déroule d'un trait, comme avant ;
#   - makeMaterials et create acceptent des textures de peau déjà faites (option skinTextures de create) ;
#   - l'API du module donne le générateur (MereVase.skinTexturesSteps).
# Données seulement : (module, nom, ancien, nouveau).
PATCHES = [
 ('mere-vase.js', 'peau par morceaux : générateur',
  "  function makeSkinTextures(THREE, q) {\n    const W = q === 'high' ? 2048 : q === 'medium' ? 1024 : 512, H = W / 2;\n",
  "  function* makeSkinTexturesPas(THREE, q) {   // Marécages (13 novembre 2026) : par morceaux, une ligne à la fois\n    const W = q === 'high' ? 2048 : q === 'medium' ? 1024 : 512, H = W / 2;\n"),
 ('mere-vase.js', 'peau par morceaux : hauteur',
  "        height[j * W + i] = hgt;\n      }\n    }\n",
  "        height[j * W + i] = hgt;\n      }\n      yield;\n    }\n"),
 ('mere-vase.js', 'peau par morceaux : verrues',
  "    for (const w of warts) {\n",
  "    let nWart = 0;\n    for (const w of warts) {\n      if ((++nWart & 63) === 0) yield;\n"),
 ('mere-vase.js', 'peau par morceaux : couleur',
  "        glow[k] = gl * 120; glow[k + 1] = gl * 255; glow[k + 2] = gl * 190; glow[k + 3] = 255;\n      }\n    }\n",
  "        glow[k] = gl * 120; glow[k + 1] = gl * 255; glow[k + 2] = gl * 190; glow[k + 3] = 255;\n      }\n      yield;\n    }\n"),
 ('mere-vase.js', 'peau par morceaux : normales',
  "        nrm[k] = (-dx / l * 0.5 + 0.5) * 255; nrm[k + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[k + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[k + 3] = 255;\n      }\n    }\n",
  "        nrm[k] = (-dx / l * 0.5 + 0.5) * 255; nrm[k + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[k + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[k + 3] = 255;\n      }\n      yield;\n    }\n"),
 ('mere-vase.js', 'peau par morceaux : matières',
  "  function makeMaterials(THREE, q, lin) {\n    const skinT = makeSkinTextures(THREE, q), mouthT = makeMouthTextures(THREE, q);\n",
  "  function makeSkinTextures(THREE, q) { const g = makeSkinTexturesPas(THREE, q); for (;;) { const r = g.next(); if (r.done) return r.value; } }\n"
  "  function makeMaterials(THREE, q, lin, skinPre) {   // Marécages : skinPre, des textures de peau déjà faites (ou provisoires)\n"
  "    const skinT = skinPre || makeSkinTextures(THREE, q), mouthT = makeMouthTextures(THREE, q);\n"),
 ('mere-vase.js', 'peau par morceaux : création',
  "    const M = makeMaterials(THREE, q, lin);\n",
  "    const M = makeMaterials(THREE, q, lin, O.skinTextures);\n"),
 ('mere-vase.js', 'peau par morceaux : interface',
  "  const api = { create, CLIPS: Object.keys(CLIPS), LENGTH: LEN, VERSION: '1.2.1' };\n",
  "  const api = { create, skinTexturesSteps: makeSkinTexturesPas, CLIPS: Object.keys(CLIPS), LENGTH: LEN, VERSION: '1.2.1' };   // Marécages : le générateur de la peau\n"),
]
