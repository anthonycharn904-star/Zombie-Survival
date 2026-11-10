# Étape 1 de la cuisson : maillage bas-poly + UV + rastérisation des texels (surface fine).
# python3 bbake.py [h_mm] [triangles] [taille_texture]
import sys, os, time, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmodel as HM
from mesh import *
from bake_lib import *
import xatlas
from bmanifold import fix_nonmanifold

h = float(sys.argv[1]) if len(sys.argv) > 1 else 0.6
TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 15000
TS = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
OUT = os.environ.get('BAKE_OUT', 'travail/stage')
os.makedirs(OUT, exist_ok=True)
t0 = time.time()

# 1) maillage
df, bmin, hh = sdf_grid(HM.head_sdf_coarse, HM.BOUNDS[0], HM.BOUNDS[1], h, coarse=4)     # volume sans marques fines
v, f = march(df, bmin, hh)
del df
v, f = keep_largest(v, f)
v, f = decimate(v, f, TRIS)
v = project_to_surface(HM.head_sdf_coarse, v, iters=2)
v, f, n_open, n_nm = fix_nonmanifold(v, f)          # coins des paupières pincés par la décimation
assert n_open == 0 and n_nm == 0, (n_open, n_nm)
vn = mesh_normals(v, f)
print(f'maillage : {len(v)} sommets, {len(f)} triangles ({time.time()-t0:.0f}s)')

# 2) UV — le visage (et l'intérieur de la bouche) reçoit plus de texels
face = np.clip((v[:, 2] + 20.0) / 40.0, 0, 1) * np.clip((v[:, 1] + 130.0) / 40.0, 0, 1) * np.clip((100.0 - v[:, 1]) / 30.0, 0, 1)
w_face = 1.0 + 0.45 * face
vs = v * w_face[:, None]
atlas = xatlas.Atlas()
atlas.add_mesh(vs.astype(np.float32), f.astype(np.uint32), vn.astype(np.float32))
co = xatlas.ChartOptions(); co.max_iterations = 4; co.normal_deviation_weight = 2.0; co.max_cost = 3.0
po = xatlas.PackOptions(); po.resolution = TS; po.padding = 6; po.bilinear = True; po.bruteForce = False
atlas.generate(co, po)
vmap, fi, uv = atlas[0]
V = v[vmap]; N = vn[vmap]; FI = fi.astype(np.int64); UV = uv.astype(np.float64)
print(f'UV : {len(V)} sommets après coutures, {atlas.chart_count} cartes, utilisation {atlas.utilization:.2f} ({time.time()-t0:.0f}s)')

# 3) rastérisation
tri_id, bary = raster(UV, FI, TS, TS)
Pt, mask = texel_attrs(tri_id, bary, FI, V)
Nt, _ = texel_attrs(tri_id, bary, FI, N)
Nt /= np.linalg.norm(Nt, axis=1, keepdims=True)
tri = tri_id[mask]
T, B = cotangent_frames(V, UV, FI, tri, Nt)
print(f'texels couverts : {mask.sum()/1e6:.2f} M ({time.time()-t0:.0f}s)')

# 4) surface fine : projection sur la SDF complète (sceau, cicatrice, agrafes) et normale exacte
Ph = Pt.copy()
for _ in range(2):
    d = eval_points(HM.head_sdf, Ph.astype(np.float32))
    g = sdf_normals(HM.head_sdf, Ph, e=0.12)
    Ph = Ph - g * d[:, None]
Nh = sdf_normals(HM.head_sdf, Ph, e=0.12)
bad = (Nh * Nt).sum(1) < 0.2
Nh[bad] = Nt[bad]; Ph[bad] = Pt[bad]
print(f'surface fine ({bad.sum()} texels repliés) ({time.time()-t0:.0f}s)')
np.savez_compressed(f'{OUT}/stage.npz', V=V, N=N, FI=FI, UV=UV, tri_id=tri_id, bary=bary, Pt=Pt, Ph=Ph, Nh=Nh, Nt=Nt, T=T, B=B, mask=mask)
if os.path.exists(f'{OUT}/ao.npy'): os.remove(f'{OUT}/ao.npy')
print('étape sauvegardée', OUT, f'({time.time()-t0:.0f}s)')
