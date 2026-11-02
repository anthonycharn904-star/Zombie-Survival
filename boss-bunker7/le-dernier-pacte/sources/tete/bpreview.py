# Aperçu rapide du modèle SDF (sans textures) : python3 bpreview.py [h_mm] [triangles] [sortie.bin]
import sys, os, time, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmodel as HM
from mesh import *

h = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
target = int(sys.argv[2]) if len(sys.argv) > 2 else 80000
dest = sys.argv[3] if len(sys.argv) > 3 else 'travail/prev.bin'
t0 = time.time()
FN = getattr(HM, os.environ.get('SDF', 'head_sdf_coarse'))     # head_sdf_coarse (rapide) ou head_sdf (marques)
df, bmin, hh = sdf_grid(FN, HM.BOUNDS[0], HM.BOUNDS[1], h, coarse=4)
v, f = march(df, bmin, hh)
del df
v, f = keep_largest(v, f)
v, f = decimate(v, f, target)
n = mesh_normals(v, f)
write_preview(dest, v, f, n, scale=0.001, origin=HM.HEAD_ORIGIN, extra={'eyeX': HM.EYE_X, 'eyeR': HM.EYE_R, 'origin': list(HM.HEAD_ORIGIN)})
print('ok', len(v), len(f), f'{time.time()-t0:.0f}s')
