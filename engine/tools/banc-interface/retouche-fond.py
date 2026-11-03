#!/usr/bin/env python3
"""Fond du menu tiré de la maquette d'Anthony (demande du 3 novembre 2026 : « recréer ou copier l'image en arrière-plan
que je t'avais donnée »). La maquette a l'interface peinte dedans (barre du haut, logo, menu, rapport, barre du bas) :
ces zones sont effacées et remplies à partir du décor voisin (remplissage à plusieurs échelles depuis les bords, puis le
grain d'un morceau de décor voisin choisi hors du faisceau), puis l'image est agrandie. Aucun outil de génération
d'images : le décor caché sous l'interface est reconstitué, pas redessiné.

    python3 engine/tools/banc-interface/retouche-fond.py <maquette 1499 × 834> <sortie.jpg> [--largeur 3440] [--zones <contrôle.png>]

Les coordonnées des zones sont celles de la maquette reçue le 3 novembre 2026 (1 499 × 834) ; une autre taille est
ramenée à celle-ci. --zones écrit une image de contrôle où les zones remplies sont cerclées."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

args = sys.argv[1:]
if len(args) < 2:
    sys.exit(__doc__)
SRC, OUT = args[0], args[1]
LARGEUR = int(args[args.index('--largeur') + 1]) if '--largeur' in args else 3440
ZONES = args[args.index('--zones') + 1] if '--zones' in args else None
REF = (1499, 834)

im = Image.open(SRC).convert('RGB')
if im.size != REF:
    im = im.resize(REF, Image.LANCZOS)
img = np.asarray(im, dtype=np.float64) / 255.0
H, W = img.shape[:2]

# zones peintes : (x0, y0, x1, y1) et le rectangle de décor (x0, y0, x1, y1) dont on reprend le grain
ZONES_PEINTES = [
    ((66, 16, 496, 44), (540, 62, 800, 120)),        # barre du haut, texte de gauche (nuages)
    ((1114, 16, 1462, 44), (905, 62, 1045, 120)),    # barre du haut, texte de droite (nuages)
    ((34, 42, 1466, 50), None),                      # barre du haut, filet
    ((70, 54, 530, 276), (540, 62, 800, 200)),       # logo et sa ligne de sous-titre (nuages, sans les rayons du sommet)
    ((66, 288, 472, 420), (540, 62, 800, 200)),      # menu, haut (ciel)
    ((66, 420, 472, 672), None),                     # menu, bas : remplissage lisse (les rides du sable recopiées font des stries)
    ((1056, 64, 1492, 482), (905, 62, 1045, 200)),   # rapport : papier, trombone, photo (nuages)
    ((28, 780, 1472, 793), None),                    # barre du bas, filet
    ((36, 788, 252, 826), (60, 728, 500, 778)),      # barre du bas, logo ZS et version
    ((1306, 788, 1466, 826), (1000, 728, 1300, 778)),  # barre du bas, « Mode hors ligne »
]
masque = np.zeros((H, W), bool)
for (x0, y0, x1, y1), _ in ZONES_PEINTES:
    masque[y0:y1, x0:x1] = True
connu = ~masque

def flou(a, s):
    return np.stack([ndimage.gaussian_filter(a[..., c], s) for c in range(3)], -1)

# 1. remplissage à plusieurs échelles (convolution normalisée) : grandes échelles d'abord, puis les fines là où
# le décor connu est assez proche
estim = None
for s in (96, 48, 24, 12, 6, 3):
    w = ndimage.gaussian_filter(connu.astype(float), s)
    v = flou(img * connu[..., None], s) / np.maximum(w, 1e-6)[..., None]
    if estim is None:
        estim = v
    else:
        conf = np.clip(w / 0.5, 0, 1)[..., None]
        estim = conf * v + (1 - conf) * estim
plein = np.where(masque[..., None], estim, img)

# 2. grain : le détail fin (image moins son flou) d'un morceau de décor voisin, recopié en miroir dans la zone
detail = img - flou(img, 2.5)
for (x0, y0, x1, y1), source in ZONES_PEINTES:
    if source is None:
        continue
    sx0, sy0, sx1, sy1 = source
    sw, sh = sx1 - sx0, sy1 - sy0
    ys, xs = np.mgrid[y0:y1, x0:x1]
    # pliage en miroir (va-et-vient) : pas de couture visible entre deux recopies
    px, py = (xs - x0) % (2 * sw), (ys - y0) % (2 * sh)
    px = np.where(px < sw, px, 2 * sw - 1 - px) + sx0
    py = np.where(py < sh, py, 2 * sh - 1 - py) + sy0
    plein[y0:y1, x0:x1] += 0.6 * detail[py, px]

# 3. raccord : bord des zones fondu sur quelques pixels
doux = ndimage.gaussian_filter(ndimage.binary_dilation(masque, iterations=3).astype(float), 2.0)[..., None]
res = np.clip(img * (1 - doux) + plein * doux, 0, 1)

if ZONES:
    ctl = Image.fromarray((res * 255).round().astype(np.uint8))
    from PIL import ImageDraw
    d = ImageDraw.Draw(ctl)
    for (x0, y0, x1, y1), _ in ZONES_PEINTES:
        d.rectangle([x0, y0, x1, y1], outline=(0, 255, 0))
    ctl.save(ZONES)

# 4. agrandissement (Lanczos), léger renforcement, grain fin pour masquer la mollesse de l'agrandissement
out = Image.fromarray((res * 255).round().astype(np.uint8))
h2 = round(H * LARGEUR / W)
out = out.resize((LARGEUR, h2), Image.LANCZOS)
from PIL import ImageFilter
out = out.filter(ImageFilter.UnsharpMask(radius=2, percent=55, threshold=2))
a = np.asarray(out, dtype=np.float64)
rng = np.random.default_rng(7)
a = np.clip(a + rng.normal(0, 2.2, a.shape[:2])[..., None], 0, 255)
Image.fromarray(a.round().astype(np.uint8)).save(OUT, quality=88, subsampling=0, progressive=True, optimize=True)
print(f'{OUT} : {LARGEUR} × {h2}')
