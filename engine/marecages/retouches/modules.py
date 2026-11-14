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
#
# Demande d'Anthony du 14 novembre 2026 (« Ok pour éléments et barques ») : les textures des barques (95 % du temps de
# leur création, 2,8 s pour les onze en qualité haute) se calculent de même par morceaux ; barque.js reste celui du kit.
#   - vnoise, hullTexture et woodTexture deviennent des générateurs (vnoisePas, hullTexturePas, woodTexturePas) qui
#     rendent la main après chaque ligne ; les fonctions d'avant les déroulent d'un trait ;
#   - create accepte des textures faites (option textures) ; l'API donne le générateur des quatre textures d'une barque
#     (Barque.texturesSteps(THREE, opts), mêmes options que create).
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
 ('barque.js', 'textures par morceaux : bruit',
  "  function vnoise(w, h, oct, R) {\n    const out = new Float32Array(w * h); let tot = 0;\n",
  "  function pasSync(g) { for (;;) { const r = g.next(); if (r.done) return r.value; } }   // Marécages (14 novembre 2026)\n"
  "  function vnoise(w, h, oct, R) { return pasSync(vnoisePas(w, h, oct, R)); }\n"
  "  function* vnoisePas(w, h, oct, R) {\n    const out = new Float32Array(w * h); let tot = 0;\n"),
 ('barque.js', 'textures par morceaux : bruit, lignes',
  "          out[y * w + x] += amp * ((a + (b - a) * sx2) * (1 - sy2) + (c + (d - c) * sx2) * sy2);\n        }\n      }\n",
  "          out[y * w + x] += amp * ((a + (b - a) * sx2) * (1 - sy2) + (c + (d - c) * sx2) * sy2);\n        }\n        if ((y & 7) === 7) yield;\n      }\n"),
 ('barque.js', 'textures par morceaux : coque',
  "  function hullTexture(THREE, R, paint, px) {\n",
  "  function hullTexture(THREE, R, paint, px) { return pasSync(hullTexturePas(THREE, R, paint, px)); }\n  function* hullTexturePas(THREE, R, paint, px) {\n"),
 ('barque.js', 'textures par morceaux : coque, bruit',
  "    const n1 = vnoise(W, H, [[6, 3, 1], [24, 12, 0.5], [96, 48, 0.25]], R), n2 = vnoise(W, H, [[3, 2, 1], [12, 6, 0.6], [48, 24, 0.3]], R);\n",
  "    const n1 = yield* vnoisePas(W, H, [[6, 3, 1], [24, 12, 0.5], [96, 48, 0.25]], R), n2 = yield* vnoisePas(W, H, [[3, 2, 1], [12, 6, 0.6], [48, 24, 0.3]], R);\n"),
 ('barque.js', 'textures par morceaux : coque, lignes',
  "        const k4 = i * 4; d[k4] = r; d[k4 + 1] = gg; d[k4 + 2] = b; d[k4 + 3] = 255;\n      }\n    }\n",
  "        const k4 = i * 4; d[k4] = r; d[k4 + 1] = gg; d[k4 + 2] = b; d[k4 + 3] = 255;\n      }\n      if ((y & 3) === 3) yield;\n    }\n"),
 ('barque.js', 'textures par morceaux : bois',
  "  function woodTexture(THREE, R, px, tone) {\n",
  "  function woodTexture(THREE, R, px, tone) { return pasSync(woodTexturePas(THREE, R, px, tone)); }\n  function* woodTexturePas(THREE, R, px, tone) {\n"),
 ('barque.js', 'textures par morceaux : bois, bruit',
  "    const n = vnoise(W, H, [[4, 16, 1], [16, 64, 0.4], [64, 128, 0.2]], R), m = vnoise(W, H, [[3, 3, 1], [9, 9, 0.6]], R);\n",
  "    const n = yield* vnoisePas(W, H, [[4, 16, 1], [16, 64, 0.4], [64, 128, 0.2]], R), m = yield* vnoisePas(W, H, [[3, 3, 1], [9, 9, 0.6]], R);\n"),
 ('barque.js', 'textures par morceaux : bois, lignes',
  "    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {\n      const i = y * W + x, u = x / W, v = y / H;\n",
  "    for (let y = 0; y < H; y++) { if ((y & 7) === 7) yield; for (let x = 0; x < W; x++) {\n      const i = y * W + x, u = x / W, v = y / H;\n"),
 ('barque.js', 'textures par morceaux : bois, fin de ligne',
  "      d[k4] = T[0] * k * (1 - 0.35 * wet); d[k4 + 1] = T[1] * k * (1 - 0.3 * wet); d[k4 + 2] = T[2] * k * (1 - 0.28 * wet); d[k4 + 3] = 255;\n    }\n",
  "      d[k4] = T[0] * k * (1 - 0.35 * wet); d[k4 + 1] = T[1] * k * (1 - 0.3 * wet); d[k4 + 2] = T[2] * k * (1 - 0.28 * wet); d[k4 + 3] = 255;\n    } }\n"),
 ('barque.js', 'textures par morceaux : création',
  "    const tex = {\n      hull: hullTexture(THREE, rng(O.seed + 1), O.paint, px),\n",
  "    const tex = O.textures || {   // Marécages : textures faites (ou provisoires) ; sinon, comme avant\n      hull: hullTexture(THREE, rng(O.seed + 1), O.paint, px),\n"),
 ('barque.js', 'textures par morceaux : interface',
  "  const api = { create, createAudio, LENGTH: LEN, VERSION: '1.0.0' };\n",
  "  /* Marécages : les quatre textures d'une barque, par morceaux (mêmes options et mêmes calculs que create) */\n"
  "  function* texturesSteps(THREE, opts) {\n"
  "    const O = Object.assign({ quality: 'medium', seed: 7, paint: 0x4f6356 }, opts || {});\n"
  "    const hi = O.quality === 'high', lo = O.quality === 'low', px = hi ? 1024 : lo ? 256 : 512;\n"
  "    const hull = yield* hullTexturePas(THREE, rng(O.seed + 1), O.paint, px);\n"
  "    const inner = yield* woodTexturePas(THREE, rng(O.seed + 2), px / 2, [96, 86, 72]);\n"
  "    const plank = yield* woodTexturePas(THREE, rng(O.seed + 3), px / 2, [112, 100, 84]);\n"
  "    yield;\n"
  "    return { hull, inner, plank, cowl: cowlTexture(THREE, rng(O.seed + 4)) };\n"
  "  }\n"
  "  const api = { create, createAudio, texturesSteps, LENGTH: LEN, VERSION: '1.0.0' };\n"),
]
