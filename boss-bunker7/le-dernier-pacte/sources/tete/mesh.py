# Outils de maillage : grille SDF creuse, marching cubes, décimation, normales, export.
import numpy as np, time, json, struct
from scipy import ndimage
from skimage import measure
import fast_simplification

F = np.float32


def eval_points(fn, pts, chunk=2_000_000):
    out = np.empty(len(pts), dtype=F)
    for i in range(0, len(pts), chunk):
        p = pts[i:i + chunk].astype(F)
        out[i:i + chunk] = fn((p[:, 0], p[:, 1], p[:, 2]))
    return out


def sdf_grid(fn, bmin, bmax, h, coarse=6, band=None, log=True):
    t0 = time.time()
    bmin = np.asarray(bmin, float); bmax = np.asarray(bmax, float)
    H = h * coarse
    nc = np.ceil((bmax - bmin) / H).astype(int) + 1
    gx, gy, gz = [bmin[i] + H * np.arange(nc[i]) for i in range(3)]
    X, Y, Z = np.meshgrid(gx, gy, gz, indexing='ij')
    dc = eval_points(fn, np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)).reshape(nc)
    nf = (nc - 1) * coarse + 1
    # interpolation trilinéaire de la grille grossière vers la fine
    df = ndimage.zoom(dc, [(nf[i]) / nc[i] for i in range(3)], order=1, grid_mode=False).astype(F)
    df = df[:nf[0], :nf[1], :nf[2]]
    band = band if band is not None else H * 2.5
    mask = np.abs(df) < band
    idx = np.nonzero(mask)
    pts = np.stack([bmin[0] + idx[0] * h, bmin[1] + idx[1] * h, bmin[2] + idx[2] * h], 1)
    df[idx] = eval_points(fn, pts)
    if log:
        print(f'grille {tuple(nf)} ({np.prod(nf)/1e6:.1f} M), bande {len(pts)/1e6:.2f} M pts, {time.time()-t0:.1f}s')
    return df, bmin, h


def march(df, bmin, h):
    t0 = time.time()
    v, f, n, _ = measure.marching_cubes(df, level=0.0, spacing=(h, h, h), allow_degenerate=False)
    v = v + bmin
    # orientation : normales vers l'extérieur (volume signé positif)
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    vol = np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6.0
    if vol < 0:
        f = f[:, ::-1].copy()
    print(f'marching cubes : {len(v)} sommets, {len(f)} triangles, {time.time()-t0:.1f}s')
    return v.astype(np.float64), f.astype(np.int64)


def decimate(v, f, target):
    t0 = time.time()
    red = 1.0 - target / len(f)
    if red <= 0:
        return v, f
    v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=red, agg=6)
    print(f'décimation : {len(f)} → {len(f2)} triangles, {time.time()-t0:.1f}s')
    return v2.astype(np.float64), f2.astype(np.int64)


def keep_largest(v, f):
    import trimesh
    m = trimesh.Trimesh(v, f, process=False)
    parts = m.split(only_watertight=False)
    if len(parts) > 1:
        parts = sorted(parts, key=lambda p: len(p.faces), reverse=True)
        print('composantes :', [len(p.faces) for p in parts[:6]])
        m = parts[0]
    return np.asarray(m.vertices), np.asarray(m.faces)


def sdf_normals(fn, v, e=0.05):
    p = v.astype(F)
    d = []
    for k in range(3):
        o = np.zeros(3, F); o[k] = e
        d.append(eval_points(fn, p + o) - eval_points(fn, p - o))
    n = np.stack(d, 1)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def mesh_normals(v, f):
    n = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def project_to_surface(fn, v, iters=3):
    """Ramène les sommets décimés sur la surface fine (descente le long du gradient)."""
    for _ in range(iters):
        d = eval_points(fn, v.astype(F))
        n = sdf_normals(fn, v)
        v = v - n * d[:, None]
    return v


def write_preview(path, v, f, n, scale=0.001, origin=(0, 0, 0), extra=None):
    """Binaire simple : en-tête JSON + Float32 positions/normales + Uint32 index."""
    P = (v * scale + np.asarray(origin)).astype(np.float32)
    N = n.astype(np.float32)
    I = f.astype(np.uint32)
    hdr = {'nv': len(P), 'nf': len(I)}
    if extra:
        hdr.update(extra)
    hb = json.dumps(hdr).encode()
    hb += b' ' * ((4 - len(hb) % 4) % 4)
    with open(path, 'wb') as fp:
        fp.write(struct.pack('<I', len(hb)))
        fp.write(hb)
        fp.write(P.tobytes()); fp.write(N.tobytes()); fp.write(I.tobytes())
