# Étape 2 de la cuisson : textures de la tête (albédo, normales, ORM = occlusion/rugosité/métal, émission).
import sys, os, time, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmodel as HM
import bskin as SK
from mesh import eval_points
from bake_lib import *

OUT = os.environ.get('BAKE_OUT', 'travail/stage')
TEX = os.path.join(OUT, 'tex')
S = np.load(f'{OUT}/stage.npz')
mask = S['mask']; H, W = mask.shape
Ph, Nh, Nt, T, B = S['Ph'], S['Nh'], S['Nt'], S['T'], S['B']
V, N, FI, UV = S['V'], S['N'], S['FI'], S['UV']
t0 = time.time()

# --- occlusion ambiante depuis la SDF
AO_CACHE = f'{OUT}/ao.npy'
if os.path.exists(AO_CACHE) and os.environ.get('AO_REDO') is None:
    ao = np.load(AO_CACHE)
else:
    occ = np.zeros(len(Ph), np.float32)
    tot = 0.0
    for i, dist in enumerate([0.6, 1.2, 2.4, 4.8, 9.6]):
        q = (Ph + Nh * dist).astype(np.float32)
        dd = eval_points(HM.head_sdf, q)
        w = 0.75 ** i
        occ += w * np.clip((dist - dd) / dist, 0, 1)
        tot += w
    ao = np.clip(1.0 - 1.15 * occ / tot, 0.0, 1.0).astype(np.float32)
    np.save(AO_CACHE, ao)
print(f'AO ({time.time()-t0:.0f}s)')

alb, hgt, rough, em, metal, M = SK.skin_maps(Ph.astype(np.float32), Nh.astype(np.float32), ao)
print(f'cartes ({time.time()-t0:.0f}s)')

# --- normales : SDF fine + relief fin (gradient de la hauteur en espace texture)
himg = dilate(to_image(mask, hgt, H, W), mask)[:, :, 0]
hu = (np.roll(himg, -1, 1) - np.roll(himg, 1, 1)) * (W / 2.0)
hv = (np.roll(himg, -1, 0) - np.roll(himg, 1, 0)) * (H / 2.0)
I = FI[S['tri_id'][mask]]
p0, p1, p2 = V[I[:, 0]], V[I[:, 1]], V[I[:, 2]]
t0_, t1_, t2_ = UV[I[:, 0]], UV[I[:, 1]], UV[I[:, 2]]
e1, e2 = p1 - p0, p2 - p0
Nf = np.cross(e1, e2); A2 = np.linalg.norm(Nf, axis=1); Nf /= A2[:, None]
gu = (np.cross(e2, Nf) * (t1_ - t0_)[:, 0:1] + np.cross(Nf, e1) * (t2_ - t0_)[:, 0:1]) / A2[:, None]
gv = (np.cross(e2, Nf) * (t1_ - t0_)[:, 1:2] + np.cross(Nf, e1) * (t2_ - t0_)[:, 1:2]) / A2[:, None]
n_fin = Nh - hu[mask][:, None] * gu - hv[mask][:, None] * gv
n_fin /= np.linalg.norm(n_fin, axis=1, keepdims=True)
nrm = encode_normals(n_fin, T, B, Nt)
print(f'normales ({time.time()-t0:.0f}s)')

os.makedirs(TEX, exist_ok=True)
save(dilate(to_image(mask, alb, H, W), mask), f'{TEX}/tete_albedo.webp', quality=90)
save(dilate(to_image(mask, nrm, H, W, 0.5), mask), f'{TEX}/tete_normales.jpg', quality=92)
orm = np.stack([ao * 0.85 + 0.15, rough, metal], 1)          # R occlusion, G rugosité, B métal (agrafes)
orm_img = dilate(to_image(mask, orm, H, W), mask)
orm_img = orm_img.reshape(H // 2, 2, W // 2, 2, 3).mean((1, 3))
save(orm_img, f'{TEX}/tete_orm.webp', quality=90)
em_img = dilate(to_image(mask, em, H, W), mask)
save(em_img, f'{TEX}/tete_emission.webp', quality=88)
for k in ('albedo.webp', 'normales.jpg', 'orm.webp', 'emission.webp'):
    print(k, os.path.getsize(f'{TEX}/tete_{k}') // 1024, 'Ko')
np.savez_compressed(f'{OUT}/masks.npz', **{k: v.astype(np.float16) for k, v in M.items()})
print(f'terminé ({time.time()-t0:.0f}s)')
