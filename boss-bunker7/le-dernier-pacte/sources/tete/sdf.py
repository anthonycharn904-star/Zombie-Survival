# Bibliothèque SDF vectorisée (numpy, float32). Les points sont des tuples (x, y, z) de tableaux.
import numpy as np

F = np.float32


def length(x, y, z):
    return np.sqrt(x * x + y * y + z * z)


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def rot(rx=0.0, ry=0.0, rz=0.0):
    """Matrice de rotation (degrés), appliquée dans l'ordre X puis Y puis Z."""
    rx, ry, rz = np.radians([rx, ry, rz])
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    X = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Z = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Z @ Y @ X


def local(P, c, R=None):
    x, y, z = P[0] - c[0], P[1] - c[1], P[2] - c[2]
    if R is None:
        return x, y, z
    return (R[0, 0] * x + R[1, 0] * y + R[2, 0] * z,
            R[0, 1] * x + R[1, 1] * y + R[2, 1] * z,
            R[0, 2] * x + R[1, 2] * y + R[2, 2] * z)


def sphere(P, c, r):
    return length(P[0] - c[0], P[1] - c[1], P[2] - c[2]) - r


def ellipsoid(P, c, r, R=None):
    x, y, z = local(P, c, R)
    px, py, pz = x / r[0], y / r[1], z / r[2]
    k0 = np.sqrt(px * px + py * py + pz * pz)
    k1 = np.sqrt((px / r[0]) ** 2 + (py / r[1]) ** 2 + (pz / r[2]) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def superellipsoid(P, c, r, n=2.0, R=None, egg=0.0):
    """Superellipsoïde (section horizontale d'exposant n), distance normalisée par le gradient.
    egg > 0 rétrécit l'avant (+z local) et élargit l'arrière."""
    x, y, z = local(P, c, R)
    a, b, cc = r
    if egg:
        sx = 1.0 - egg * np.clip(z / cc, -1.0, 1.0)
        x = x / sx
    X = np.abs(x) / a + 1e-9
    Z = np.abs(z) / cc + 1e-9
    Y = y / b
    h = X ** n + Z ** n
    g = h ** (2.0 / n)
    q = np.sqrt(g + Y * Y) + 1e-9
    hp = h ** (2.0 / n - 1.0)
    dX = hp * X ** (n - 1.0) / a / q
    dZ = hp * Z ** (n - 1.0) / cc / q
    dY = Y / b / q
    gl = np.sqrt(dX * dX + dY * dY + dZ * dZ) + 1e-9
    return (q - 1.0) / gl


def round_cone(P, a, b, r1, r2):
    x, y, z = P
    bax, bay, baz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    l2 = bax * bax + bay * bay + baz * baz
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pax, pay, paz = x - a[0], y - a[1], z - a[2]
    yv = pax * bax + pay * bay + paz * baz
    zv = yv - l2
    qx, qy, qz = pax * l2 - bax * yv, pay * l2 - bay * yv, paz * l2 - baz * yv
    x2 = qx * qx + qy * qy + qz * qz
    y2 = yv * yv * l2
    z2 = zv * zv * l2
    k = np.sign(rr) * rr * rr * x2
    d1 = np.sqrt(x2 + z2) * il2 - r2
    d2 = np.sqrt(x2 + y2) * il2 - r1
    d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0.0)) + yv * rr) * il2 - r1
    return np.where(np.sign(zv) * a2 * z2 > k, d1, np.where(np.sign(yv) * a2 * y2 < k, d2, d3)).astype(F)


def catmull(pts, n=6):
    """Sous-échantillonne une polyligne de points de contrôle (Catmull-Rom). pts : liste de tuples."""
    P = np.asarray(pts, dtype=np.float64)
    if len(P) < 3:
        return P
    out = []
    m = len(P)
    for i in range(m - 1):
        p0, p1, p2, p3 = P[max(0, i - 1)], P[i], P[i + 1], P[min(m - 1, i + 2)]
        for s in range(n):
            t = s / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return np.asarray(out)


def tube(P, pts, n=5, scale=None, center=None, k=0.0):
    """Tube lisse le long de points de contrôle [(x, y, z, r), ...] (Catmull-Rom).
    scale : (sx, sy, sz) anisotropie autour de center."""
    Q = catmull(pts, n)
    x, y, z = P
    if scale is not None:
        c = center if center is not None else Q[:, :3].mean(0)
        x = (x - c[0]) / scale[0] + c[0]
        y = (y - c[1]) / scale[1] + c[1]
        z = (z - c[2]) / scale[2] + c[2]
        Q = Q.copy()
        for i in range(3):
            Q[:, i] = (Q[:, i] - c[i]) / scale[i] + c[i]
    d = None
    for i in range(len(Q) - 1):
        a, b = Q[i], Q[i + 1]
        r1, r2 = a[3], b[3]
        L = np.linalg.norm(b[:3] - a[:3])
        if L < 1e-6:
            continue
        if abs(r1 - r2) >= L * 0.98:
            r2 = r1 - np.sign(r1 - r2) * L * 0.98
        di = round_cone((x, y, z), a[:3], b[:3], r1, r2)
        d = di if d is None else (smin(d, di, k) if k > 0 else np.minimum(d, di))
    if scale is not None:
        d = d * min(scale)
    return d


def seg_dist(P, pts):
    """Distance à une polyligne (sans rayon)."""
    Q = np.asarray(pts, dtype=np.float64)
    x, y, z = P
    d = None
    for i in range(len(Q) - 1):
        a, b = Q[i], Q[i + 1]
        ab = b - a
        l2 = float(ab @ ab)
        t = np.clip(((x - a[0]) * ab[0] + (y - a[1]) * ab[1] + (z - a[2]) * ab[2]) / l2, 0.0, 1.0)
        dx, dy, dz = x - a[0] - t * ab[0], y - a[1] - t * ab[1], z - a[2] - t * ab[2]
        di = np.sqrt(dx * dx + dy * dy + dz * dz)
        d = di if d is None else np.minimum(d, di)
    return d


def gbump(P, c, s, R=None):
    """Bosse gaussienne anisotrope (valeur 0..1). s : écarts-types (sx, sy, sz)."""
    x, y, z = local(P, c, R)
    if np.isscalar(s):
        s = (s, s, s)
    return np.exp(-0.5 * ((x / s[0]) ** 2 + (y / s[1]) ** 2 + (z / s[2]) ** 2))
