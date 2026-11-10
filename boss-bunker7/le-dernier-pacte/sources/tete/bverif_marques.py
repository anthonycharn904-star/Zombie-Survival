# Contrôle des marques : topologie du sceau (7 branches exactement, un seul anneau, aucun croisement), placement
# sur le crâne et le haut du front, cicatrice de la tempe droite à la mâchoire, agrafes. Image du dessin 2D.
# python3 bverif_marques.py [image.png]
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmarques as BM
from skimage.morphology import skeletonize
from scipy import ndimage
from PIL import Image

ok_all = True
def ok(c, label, x=None):
    global ok_all
    print(('ok    ' if c else 'ÉCHEC ') + label + ('' if x is None else '  ' + str(x)))
    ok_all &= bool(c)

# --- dessin 2D : squelette → extrémités et jonctions
img = BM.design_raster(px=0.2)
lab, ncomp = ndimage.label(img, structure=np.ones((3, 3)))
sizes = ndimage.sum(img, lab, range(1, ncomp + 1))
main = lab == (1 + int(np.argmax(sizes)))
sk = skeletonize(main)
nb = ndimage.convolve(sk.astype(int), np.ones((3, 3), int), mode='constant') - 1
ends = sk & (nb == 1)
junc = sk & (nb >= 3)
jl, nj = ndimage.label(junc, structure=np.ones((3, 3)))
holes = ndimage.label(~main, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])[1] - 1
ok(len(BM.ARMS) == 7, 'sept branches déclarées', len(BM.ARMS))
ok(int(ends.sum()) == 7, 'squelette du dessin : 7 extrémités libres (une par branche)', int(ends.sum()))
ok(nj == 7, 'squelette : 7 jonctions sur l\'anneau', nj)
ok(holes == 1, 'un seul anneau fermé (aucune autre boucle, aucun croisement de branches)', holes)
ok(ncomp - 1 == sum(a['dots'] for a in BM.ARMS), 'points brûlés séparés du tracé', (ncomp - 1, sum(a['dots'] for a in BM.ARMS)))
ang = sorted(a['h'] % 360 for a in BM.ARMS)
gaps = np.diff(ang + [ang[0] + 360])
ok(gaps.std() > 6.0 and len(set(a['L'] for a in BM.ARMS)) == 7, 'pas de symétrie de rotation (écarts angulaires et longueurs différents)', (np.round(gaps, 0).tolist(), [a['L'] for a in BM.ARMS]))
signs = [int(np.sign(a['k'])) for a in BM.ARMS]; dsg = [int(np.sign(a['dep'])) for a in BM.ARMS]
ok(0 < sum(s > 0 for s in signs) < 7 and 0 < sum(s > 0 for s in dsg) < 7, 'courbures et départs de sens opposés (pas de « roue » tournante)', (signs, dsg))
# aucun tronçon rectiligne (pas de trait de rune) : rotation cumulée |dθ| sur toute fenêtre de 20 mm
straight = []
for pts, w, t, i in BM.SEAL_LINES2D[1:]:
    d = np.diff(pts, axis=0); a = np.unwrap(np.arctan2(d[:, 1], d[:, 0]))
    turn = np.r_[0.0, np.cumsum(np.abs(np.diff(a)))]
    win = int(20.0 / 0.12)
    straight.append(float(np.degrees(np.min(turn[win:] - turn[:-win]))) if len(turn) > win else 99.0)
ok(min(straight) > 2.0, 'aucune branche rectiligne (rotation cumulée > 2° sur toute fenêtre de 20 mm)', np.round(straight, 1).tolist())

# --- placement 3D
P = BM.SEAL.P
allp = np.vstack([P, BM.DOT_C])
fr = allp[allp[:, 2] > -20.0]
ok(fr[:, 1].min() > 50.0 and allp[:, 1].min() > 30.0, 'sceau sur le crâne et le haut du front (devant : y > 50 mm ; partout : au-dessus des oreilles)', (round(float(fr[:, 1].min()), 1), round(float(allp[:, 1].min()), 1)))
front = P[P[:, 2] > 0]
ok(len(front) > 0 and front[:, 1].min() < 90.0, 'des branches descendent sur le haut du front', round(float(front[:, 1].min()), 1) if len(front) else None)
for i in range(1, 8):
    Pi = P[BM.SEAL.ID == i]
    print(f'   branche {i} : bout ({Pi[-1, 0]:.0f}, {Pi[-1, 1]:.0f}, {Pi[-1, 2]:.0f}) mm')
# branches qui ne se croisent pas en 3D
dmin = 99.0
for i in range(1, 8):
    for j in range(i + 1, 8):
        A = P[(BM.SEAL.ID == i) & (BM.SEAL.T > 0.08)]; B = P[(BM.SEAL.ID == j) & (BM.SEAL.T > 0.08)]
        from scipy.spatial import cKDTree
        dmin = min(dmin, float(cKDTree(B).query(A)[0].min()))
ok(dmin > 4.0, 'branches bien séparées sur le crâne (distance mini hors anneau)', round(dmin, 1))
S = BM.SCAR.P
ok(S[:, 0].max() < -20.0, 'cicatrice entièrement du côté droit (x < 0)', round(float(S[:, 0].max()), 1))
ok(S[0, 1] > 35.0 and S[-1, 1] < -95.0, 'de la tempe (y ≈ +50) à la mâchoire (y ≈ −110)', (np.round(S[0], 0).tolist(), np.round(S[-1], 0).tolist()))
L = BM.STAPLES['L']; n = len(BM.STAPLES['C'])
ok(n >= 18, 'agrafes', f'{n} agrafes sur {L:.0f} mm (pas ≈ {L / max(n - 1, 1):.1f} mm)')
print('\nmarques conformes.' if ok_all else '\nÉCHEC(S).')

# --- image du dessin (contrôle visuel) : rouge-orangé sur fond sombre, branches numérotées
out = sys.argv[1] if len(sys.argv) > 1 else 'travail/sceau_2d.png'
im = np.zeros(img.shape + (3,), np.uint8); im[:] = (22, 20, 24)
im[img] = (255, 120, 40)
im[sk] = (255, 230, 160)
Image.fromarray(im).resize((900, 900), Image.LANCZOS).save(out)
print('image :', out)
