# Outils communs de sculpture (repris de la tête d'Anthony) : paupières, oreille, superellipsoïdes, sillons.
# Repère « tête » en millimètres : origine au milieu des deux globes oculaires,
# x vers la gauche du personnage, y vers le haut, z vers l'avant.
# Position dans le repère du corps (m) : HEAD_ORIGIN + p / 1000.
import numpy as np, os
from sdf import *
OFF = set(os.environ.get('HEAD_OFF', '').split(','))

HEAD_ORIGIN = (0.0, 1.620, 0.064)
EYE_X = 31.5          # demi-écart pupillaire
EYE_R = 12.0          # rayon du globe
LID_RI = 12.3         # face interne des paupières (jeu de 0,3 mm sur le globe)
LID_T_UP, LID_T_LO = 1.9, 1.6
CM = (-14.6, -0.7)    # canthus médial (repère de l'œil, x local vers l'extérieur)
CL = (13.6, 1.3)      # canthus latéral (léger angle vers le haut)
H_UP, H_LO = 3.4, 6.4  # paupière supérieure plus lourde (regard fixe, menaçant)


def almond(ex, ey):
    L = CL[0] - CM[0]
    t = (ex - CM[0]) / L
    tc = np.clip(t, 0.0, 1.0)
    yc = CM[1] + (CL[1] - CM[1]) * tc
    su = np.maximum(np.sin(np.pi * tc ** 0.80), 0.0) ** 0.85
    sl = np.maximum(np.sin(np.pi * tc ** 1.27), 0.0) ** 0.90
    up = yc + H_UP * su
    lo = yc - H_LO * sl
    dv = np.maximum(ey - up, lo - ey)
    dh = np.maximum(-t, t - 1.0) * L
    return np.maximum(dv, dh), up, lo, tc, su, sl


def ear_frame():
    a = np.radians(15.0); phi = np.radians(23.0)       # oreilles normales (angle d'Anthony)
    U = np.array([0.0, np.cos(a), -np.sin(a)])
    Vb0 = np.array([0.0, -np.sin(a), -np.cos(a)])
    Vb = np.array([np.sin(phi), Vb0[1] * np.cos(phi), Vb0[2] * np.cos(phi)])
    W = np.cross(Vb, U); W /= np.linalg.norm(W)
    A = np.array([70.0, -17.0, -80.0])
    return A, U, Vb, W


EAR_A, EAR_U, EAR_V, EAR_W = ear_frame()


def ellipse2(u, v, c, r):
    pu, pv = (u - c[0]) / r[0], (v - c[1]) / r[1]
    k0 = np.sqrt(pu * pu + pv * pv)
    k1 = np.sqrt((pu / r[0]) ** 2 + (pv / r[1]) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def seg2(u, v, pts):
    """Distance 2D à une polyligne et abscisse normalisée."""
    Q = np.asarray(pts, dtype=np.float64)
    L = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(Q, axis=0), axis=1))]
    d = None
    for i in range(len(Q) - 1):
        a, b = Q[i], Q[i + 1]
        ab = b - a
        l2 = float(ab @ ab)
        t = np.clip(((u - a[0]) * ab[0] + (v - a[1]) * ab[1]) / l2, 0.0, 1.0)
        du, dv = u - a[0] - t * ab[0], v - a[1] - t * ab[1]
        di = np.sqrt(du * du + dv * dv)
        ti = (L[i] + t * (L[i + 1] - L[i])) / L[-1]
        if d is None:
            d, tt = di, ti
        else:
            m = di < d
            d = np.where(m, di, d); tt = np.where(m, ti, tt)
    return d, tt


HELIX = [(1.5, 4.0), (8.0, 2.2), (15.0, 3.6), (19.6, 8.6), (21.0, 15.5), (18.6, 22.5), (12.0, 28.4), (2.0, 31.0),
         (-9.0, 29.8), (-18.5, 26.0), (-25.5, 20.5), (-30.0, 15.5)]
ANTI = [(-23.5, 12.8), (-16.0, 17.2), (-7.0, 19.6), (2.0, 19.0), (9.0, 15.6), (13.5, 12.6), (16.4, 8.6)]
CRUS = [(5.5, 16.6), (7.0, 11.0), (6.0, 6.6)]


def ear_sdf(Ps):
    """Pavillon en « champ de hauteur » sur son plan : bord de l'hélix enroulé, anthélix et ses
    racines, conque, fosses, tragus, antitragus, lobe. Pas de paroi mince percée."""
    x, y, z = Ps[0] - EAR_A[0], Ps[1] - EAR_A[1], Ps[2] - EAR_A[2]
    u = x * EAR_U[0] + y * EAR_U[1] + z * EAR_U[2]
    v = x * EAR_V[0] + y * EAR_V[1] + z * EAR_V[2]
    w = x * EAR_W[0] + y * EAR_W[1] + z * EAR_W[2]
    outline = smin(ellipse2(u, v, (-2.0, 14.5), (22.5, 16.0)), ellipse2(u, v, (-29.0, 9.5), (10.0, 8.5)), 6.0)
    dh, th = seg2(u, v, HELIX)
    da, ta = seg2(u, v, ANTI)
    dc, tcr = seg2(u, v, CRUS)
    h = 1.6
    h = h + 2.9 * np.exp(-(dh / 1.9) ** 2) * sstep(0.0, 0.12, th)
    h = h + 2.0 * np.exp(-(da / 1.7) ** 2) * sstep(0.0, 0.15, ta) * sstep(1.0, 0.8, ta)
    h = h + 1.5 * np.exp(-(dc / 1.4) ** 2) * sstep(1.0, 0.75, tcr)
    conch = np.clip(1.0 - ((u + 10.0) / 9.0) ** 2 - ((v - 7.6) / 7.6) ** 2, 0.0, 1.0)
    cymba = np.clip(1.0 - ((u - 1.5) / 4.6) ** 2 - ((v - 8.0) / 6.0) ** 2, 0.0, 1.0)
    fossa = np.clip(1.0 - ((u - 11.5) / 3.8) ** 2 - ((v - 9.5) / 3.0) ** 2, 0.0, 1.0)
    h = h - 6.0 * sstep(0.0, 0.7, conch) - 3.4 * sstep(0.0, 0.7, cymba) - 1.0 * sstep(0.0, 0.8, fossa)
    h = h + 3.2 * np.exp(-(((u + 9.0) / 4.4) ** 2 + ((v + 1.4) / 3.2) ** 2))          # tragus
    h = h + 2.0 * np.exp(-(((u + 21.5) / 3.2) ** 2 + ((v - 8.6) / 3.0) ** 2))         # antitragus
    h = h + 1.2 * np.exp(-(((u + 32.0) / 6.0) ** 2 + ((v - 9.5) / 6.0) ** 2))         # lobe charnu
    back = -1.4 - 0.8 * np.exp(-(((u + 31.0) / 6.0) ** 2 + ((v - 9.5) / 6.0) ** 2))
    back = smin(back, h - 1.8, 1.5)
    e = smax(smax(outline, w - h, 1.0), back - w, 1.0)
    canal = ellipsoid((u, v, w), (-8.5, 3.6, -4.5), (2.8, 2.6, 4.0))
    return e, None, canal


def ramp1(t, tau=0.15):
    """Rampe 0..1 dérivable (C1) : remplace clip(t, 0, 1), dont le coude en t = 0 faisait un pli net dans les
    normales fines (ligne verticale visible sur le crâne rasé, au plan du centre de la superellipsoïde)."""
    t = np.minimum(t, 1.0)
    return np.where(t <= 0.0, 0.0, np.where(t < tau, t * t / (2.0 * tau), t - 0.5 * tau)) / (1.0 - 0.5 * tau)


def sell(P, c, r, n=2.0, m=2.0, cf=None, egg=None, nb=None):
    """Superellipsoïde : exposant horizontal n (nb à l'arrière), vertical m, rayon avant cf,
    egg (scalaire ou tableau) rétrécit l'avant. Distance normalisée par le gradient."""
    x, y, z = P[0] - c[0], P[1] - c[1], P[2] - c[2]
    a, b, cb = r
    cz = np.where(z > 0, cf if cf else cb, cb)
    if egg is not None:
        x = x / (1.0 - egg * ramp1(z / cz))
    nn = n if nb is None else n + (nb - n) * sstep(0.08 * cb, -0.25 * cb, z)
    X = np.abs(x) / a + 1e-7
    Z = np.abs(z) / cz + 1e-7
    Y = np.abs(y) / b + 1e-7
    s_ = X ** nn + Z ** nn
    G = s_ ** (m / nn)
    q = (G + Y ** m) ** (1.0 / m)
    qm = q ** (1.0 - m)
    sp = s_ ** (m / nn - 1.0)
    dX = qm * sp * X ** (nn - 1.0) / a
    dZ = qm * sp * Z ** (nn - 1.0) / cz
    dY = qm * Y ** (m - 1.0) / b
    gl = np.sqrt(dX * dX + dY * dY + dZ * dZ) + 1e-9
    return (q - 1.0) / gl


def sell2(x, z, c, a, cf, cb, n=2.0, egg=0.0):
    """Superellipse 2D (vue de dessus) avec avant rétréci, distance normalisée."""
    xx, zz = x - c[0], z - c[1]
    cz = np.where(zz > 0, cf, cb)
    if egg:
        xx = xx / (1.0 - egg * ramp1(zz / cz))
    X = np.abs(xx) / a + 1e-7
    Z = np.abs(zz) / cz + 1e-7
    s_ = X ** n + Z ** n
    q = s_ ** (1.0 / n)
    sp = s_ ** (1.0 / n - 1.0)
    dX = sp * X ** (n - 1.0) / a
    dZ = sp * Z ** (n - 1.0) / cz
    return (q - 1.0) / (np.sqrt(dX * dX + dZ * dZ) + 1e-9)


def midface(P):
    return sell(P, (0.0, -28.0, -33.0), (58.0, 52.0, 75.0), n=2.0, nb=2.4, m=2.4, cf=55.0, egg=0.12)


def jaw_block(P):
    """Mandibule : U vu de dessus, bord inférieur incliné qui remonte vers l'angle."""
    x, y, z = P
    ze = z + 8.0 * sstep(-98.0, -116.0, y)
    u2 = sell2(x, ze, (0.0, -62.0), 62.0, 84.0, 22.0, n=2.6, egg=0.30)
    border = -114.0 + 0.38 * np.maximum(15.0 - z, 0.0)
    d = smax(u2, border - y, 9.0)
    return smax(d, y + 38.0, 14.0)


def nose_dorsum(P):
    """Dos et pans du nez : ellipse balayée le long du profil (largeur et profondeur croissantes)."""
    x, y, z = P
    t = np.clip((4.0 - y) / 37.0, 0.0, 1.0)
    zd = 19.0 + 19.0 * t + 0.9 * np.exp(-((y + 15.0) / 6.0) ** 2)
    rx = 5.0 + 4.0 * t
    rz = 9.0 + 6.0 * t
    d = ellipse2(x, z, (0.0, zd - rz), (rx, rz))
    d = smax(d, y - 8.0, 5.0)
    return smax(d, -(y + 40.0), 5.0)


def seg_dist_t(P, pts):
    """Distance à une polyligne et abscisse normalisée (0..1) du point le plus proche."""
    Q = np.asarray(pts, dtype=np.float64)
    L = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(Q[:, :3], axis=0), axis=1))]
    x, y, z = P
    d = None
    for i in range(len(Q) - 1):
        a, b = Q[i, :3], Q[i + 1, :3]
        ab = b - a
        l2 = float(ab @ ab)
        t = np.clip(((x - a[0]) * ab[0] + (y - a[1]) * ab[1] + (z - a[2]) * ab[2]) / l2, 0.0, 1.0)
        dx, dy, dz = x - a[0] - t * ab[0], y - a[1] - t * ab[1], z - a[2] - t * ab[2]
        di = np.sqrt(dx * dx + dy * dy + dz * dz)
        ti = (L[i] + t * (L[i + 1] - L[i])) / L[-1]
        if d is None:
            d, tt = di, ti
        else:
            m = di < d
            d = np.where(m, di, d)
            tt = np.where(m, ti, tt)
    return d, tt


def grooves(P, curves):
    """Sillons : liste de (points, profondeur mm, largeur mm[, fondu des extrémités]).
    Renvoie le déplacement (positif = creux), atténué en douceur aux deux bouts."""
    out = np.zeros_like(P[0])
    for c in curves:
        pts, depth, width = c[0], c[1], c[2]
        fade = c[3] if len(c) > 3 else 0.3
        dd, tt = seg_dist_t(P, pts)
        prof = sstep(0.0, fade, tt) * sstep(1.0, 1.0 - fade, tt)
        out += depth * prof * np.exp(-(dd / width) ** 2)
    return out


def region(P, lo, hi):
    m = (P[0] >= lo[0]) & (P[0] < hi[0]) & (P[1] > lo[1]) & (P[1] < hi[1]) & (P[2] > lo[2]) & (P[2] < hi[2])
    idx = np.flatnonzero(m)
    return idx, (P[0][idx], P[1][idx], P[2][idx])


def op(d, P, lo, hi, fn, kind, k):
    """Applique une primitive seulement dans sa boîte englobante (élargie de k par l'appelant)."""
    idx, Q = region(P, lo, hi)
    if len(idx):
        v = fn(Q)
        if kind == 'u':
            d[idx] = smin(d[idx], v, k)
        elif kind == 's':
            d[idx] = smax(d[idx], -v, k)
        else:
            d[idx] = d[idx] + v
    return d


