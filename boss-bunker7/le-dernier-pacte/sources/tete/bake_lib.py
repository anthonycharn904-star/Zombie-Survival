# Cuisson de textures : rastérisation en espace UV, repères tangents (convention Three.js),
# bruits 3D (numba), dilatation, export WebP.
import numpy as np, numba as nb
from PIL import Image
from scipy import ndimage

F = np.float32


# ----------------------------------------------------------------------------- rastérisation UV
@nb.njit(cache=True)
def _raster(uv, idx, W, H, tri_id, bary):
    for t in range(idx.shape[0]):
        a, b, c = idx[t, 0], idx[t, 1], idx[t, 2]
        x0, y0 = uv[a, 0] * W, uv[a, 1] * H
        x1, y1 = uv[b, 0] * W, uv[b, 1] * H
        x2, y2 = uv[c, 0] * W, uv[c, 1] * H
        area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
        if abs(area) < 1e-12:
            continue
        xmin = max(int(np.floor(min(x0, x1, x2) - 1)), 0)
        xmax = min(int(np.ceil(max(x0, x1, x2) + 1)), W - 1)
        ymin = max(int(np.floor(min(y0, y1, y2) - 1)), 0)
        ymax = min(int(np.ceil(max(y0, y1, y2) + 1)), H - 1)
        for py in range(ymin, ymax + 1):
            cy = py + 0.5
            for px in range(xmin, xmax + 1):
                cx = px + 0.5
                w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) / area
                w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) / area
                w2 = 1.0 - w0 - w1
                # léger débord (conservatif) pour couvrir les texels de bord
                if w0 >= -0.02 and w1 >= -0.02 and w2 >= -0.02:
                    inside = w0 >= 0 and w1 >= 0 and w2 >= 0
                    if tri_id[py, px] < 0 or inside:
                        tri_id[py, px] = t
                        bary[py, px, 0] = w0
                        bary[py, px, 1] = w1
                        bary[py, px, 2] = w2


def raster(uv, idx, W, H):
    tri_id = -np.ones((H, W), np.int32)
    bary = np.zeros((H, W, 3), F)
    _raster(uv.astype(np.float64), idx.astype(np.int64), W, H, tri_id, bary)
    return tri_id, bary


def texel_attrs(tri_id, bary, idx, attr):
    """Interpole un attribut par sommet (n, k) sur les texels couverts. Renvoie (M, k) et le masque."""
    m = tri_id >= 0
    t = tri_id[m]
    w = bary[m]
    I = idx[t]
    out = attr[I[:, 0]] * w[:, 0:1] + attr[I[:, 1]] * w[:, 1:2] + attr[I[:, 2]] * w[:, 2:3]
    return out, m


def cotangent_frames(P, UV, idx, tri, N):
    """Repère (T, B) identique à perturbNormal2Arb de Three.js, par texel (tri = indice de triangle,
    N = normale interpolée normalisée)."""
    I = idx[tri]
    p0, p1, p2 = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
    t0, t1, t2 = UV[I[:, 0]], UV[I[:, 1]], UV[I[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    d1, d2 = t1 - t0, t2 - t0
    q1perp = np.cross(e2, N)
    q0perp = np.cross(N, e1)
    T = q1perp * d1[:, 0:1] + q0perp * d2[:, 0:1]
    B = q1perp * d1[:, 1:2] + q0perp * d2[:, 1:2]
    det = np.maximum((T * T).sum(1), (B * B).sum(1))
    s = 1.0 / np.sqrt(np.maximum(det, 1e-30))
    return T * s[:, None], B * s[:, None]


def encode_normals(n, T, B, N):
    """Résout [T B N] m = n pour chaque texel, normalise m, encode en RGB 0..1."""
    M = np.stack([T, B, N], axis=2)            # colonnes T, B, N
    m = np.linalg.solve(M, n[:, :, None])[:, :, 0]
    m /= np.linalg.norm(m, axis=1, keepdims=True) + 1e-12
    m[:, 2] = np.maximum(m[:, 2], 0.05)
    m /= np.linalg.norm(m, axis=1, keepdims=True)
    return m * 0.5 + 0.5


# ----------------------------------------------------------------------------- bruits 3D
@nb.njit(cache=True, inline='always')
def _hash(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 1274126177 + seed * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return h / 4294967296.0


@nb.njit(parallel=True, cache=True)
def vnoise(P, freq, seed):
    n = P.shape[0]
    out = np.empty(n, np.float32)
    for i in nb.prange(n):
        x, y, z = P[i, 0] * freq, P[i, 1] * freq, P[i, 2] * freq
        ix, iy, iz = int(np.floor(x)), int(np.floor(y)), int(np.floor(z))
        fx, fy, fz = x - ix, y - iy, z - iz
        ux, uy, uz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
        a = _hash(ix, iy, iz, seed); b = _hash(ix + 1, iy, iz, seed)
        c = _hash(ix, iy + 1, iz, seed); d = _hash(ix + 1, iy + 1, iz, seed)
        e = _hash(ix, iy, iz + 1, seed); f = _hash(ix + 1, iy, iz + 1, seed)
        g = _hash(ix, iy + 1, iz + 1, seed); h = _hash(ix + 1, iy + 1, iz + 1, seed)
        x00 = a + (b - a) * ux; x10 = c + (d - c) * ux; x01 = e + (f - e) * ux; x11 = g + (h - g) * ux
        y0 = x00 + (x10 - x00) * uy; y1 = x01 + (x11 - x01) * uy
        out[i] = y0 + (y1 - y0) * uz
    return out


def fbm(P, freq, seed, oct=4, gain=0.5, lac=2.03):
    s = np.zeros(len(P), F); a = 1.0; tot = 0.0; f = freq
    for o in range(oct):
        s += a * vnoise(P, f, seed + o * 17)
        tot += a; a *= gain; f *= lac
    return s / tot


@nb.njit(parallel=True, cache=True)
def worley(P, freq, seed, jitter):
    """Bruit cellulaire : F1, F2 (en unités de cellule) et un aléa par cellule la plus proche."""
    n = P.shape[0]
    f1 = np.empty(n, np.float32); f2 = np.empty(n, np.float32); rid = np.empty(n, np.float32)
    for i in nb.prange(n):
        x, y, z = P[i, 0] * freq, P[i, 1] * freq, P[i, 2] * freq
        ix, iy, iz = int(np.floor(x)), int(np.floor(y)), int(np.floor(z))
        b1 = 1e9; b2 = 1e9; r1 = 0.0
        for dz in range(-1, 2):
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    cx, cy, cz = ix + dx, iy + dy, iz + dz
                    px = cx + 0.5 + jitter * (_hash(cx, cy, cz, seed) - 0.5)
                    py = cy + 0.5 + jitter * (_hash(cx, cy, cz, seed + 1) - 0.5)
                    pz = cz + 0.5 + jitter * (_hash(cx, cy, cz, seed + 2) - 0.5)
                    dd = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2
                    if dd < b1:
                        b2 = b1; b1 = dd; r1 = _hash(cx, cy, cz, seed + 3)
                    elif dd < b2:
                        b2 = dd
        f1[i] = np.sqrt(b1); f2[i] = np.sqrt(b2); rid[i] = r1
    return f1, f2, rid


# ----------------------------------------------------------------------------- images
def to_image(mask, values, H, W, fill=0.0):
    k = values.shape[1] if values.ndim > 1 else 1
    img = np.full((H, W, k), fill, F)
    img[mask] = values.reshape(-1, k)
    return img


def dilate(img, mask, iters=None):
    """Remplit les texels hors cartes avec la valeur du texel couvert le plus proche."""
    idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
    return img[idx[0], idx[1]]


def save(img, path, quality=88, lossless=False, alpha=False):
    a = np.clip(img, 0, 1)
    a = (a * 255 + 0.5).astype(np.uint8)
    a = a[::-1]                                 # v vers le haut → première ligne = haut de l'image (flipY)
    if a.ndim == 3 and a.shape[2] == 1:
        a = a[:, :, 0]
    mode = 'RGBA' if (a.ndim == 3 and a.shape[2] == 4) else ('RGB' if a.ndim == 3 else 'L')
    im = Image.fromarray(a, mode)
    if path.endswith('.webp'):
        im.save(path, 'WEBP', quality=quality, lossless=lossless, method=6, exact=alpha)
    elif path.endswith('.jpg'):
        im.convert('RGB').save(path, 'JPEG', quality=quality, optimize=True, subsampling=0)
    else:
        im.save(path, optimize=True)
    return path


@nb.njit(parallel=True, cache=True)
def strokes2d(X, Y, cell, length, width, seed, x0, x1, ang_tab, jitter_ang, keep):
    """Traits fins (poils) en 2D : un trait par cellule (point aléatoire), orienté selon une table
    d'angles fonction de |x| (miroir pour x < 0), longueur et épaisseur en mm. Renvoie l'intensité 0..1."""
    n = X.shape[0]
    out = np.zeros(n, np.float32)
    R = int(np.ceil(length * 0.5 / cell)) + 1
    nt = ang_tab.shape[0]
    for i in nb.prange(n):
        x, y = X[i], Y[i]
        cx0, cy0 = int(np.floor(x / cell)), int(np.floor(y / cell))
        best = 0.0
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                cx, cy = cx0 + dx, cy0 + dy
                if _hash(cx, cy, 7, seed + 9) > keep:
                    continue
                px = (cx + _hash(cx, cy, 0, seed)) * cell
                py = (cy + _hash(cx, cy, 1, seed)) * cell
                ax = abs(px)
                k = int((ax - x0) / (x1 - x0) * (nt - 1))
                k = min(max(k, 0), nt - 1)
                a = ang_tab[k] + jitter_ang * (_hash(cx, cy, 2, seed) - 0.5)
                ux, uy = np.cos(a), np.sin(a)
                if px < 0:
                    ux = -ux
                L = length * (0.55 + 0.45 * _hash(cx, cy, 3, seed))
                # segment de px,py vers px+u*L (le poil part de son bulbe)
                qx, qy = x - px, y - py
                t = qx * ux + qy * uy
                if t < 0.0:
                    t = 0.0
                if t > L:
                    t = L
                ddx, ddy = qx - t * ux, qy - t * uy
                d2 = ddx * ddx + ddy * ddy
                wv = width * (1.0 - 0.6 * t / L)           # pointe plus fine
                v = np.exp(-d2 / (wv * wv)) * (0.6 + 0.4 * _hash(cx, cy, 4, seed))
                if v > best:
                    best = v
        out[i] = best
    return out
