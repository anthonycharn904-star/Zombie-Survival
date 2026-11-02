# Bouche du boss : poids de la mâchoire, morphose « bouche ouverte », dents et langue.
# Repère tête (mm). La morphose = rotation autour de la charnière JAW_PIVOT (axe x) d'un angle
# JAW_ANGLE × poids(P) ; poids 1 sur la lèvre inférieure, le menton, la mâchoire et le plancher de la cavité.
import numpy as np
import bmodel as HM
from sdf import sstep

AXIS = np.array([1.0, 0.0, 0.0])


def jaw_weight(P):
    P = np.asarray(P, np.float64)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    py, pz = HM.JAW_PIVOT[1], HM.JAW_PIVOT[2]
    # --- zone de la bouche : séparation nette par la fente (lèvres) puis par le milieu de la cavité
    ys_front = HM.slit_y(x)
    ys_cav = HM.CAV_C[1] + 0.5
    ys = ys_cav + (ys_front - ys_cav) * sstep(8.0, 14.0, z)
    tw = 0.6 + 2.6 * np.clip(ax / 20.5, 0.0, 1.0) ** 4        # séparation nette au centre, douce aux commissures
    w_mouth = sstep(ys + tw, ys - tw, y)
    # --- ailleurs : angle autour de la charnière (transition douce sur les joues), menton, cou
    a = np.arctan2(y - py, z - pz)
    a_s = np.arctan2(HM.SLIT_Y0 - py, 25.0 - pz)
    w_jaw = sstep(a_s + 0.10, a_s - 0.12, a)
    w_jaw *= sstep(-82.0, -58.0, z)                     # rien derrière la charnière
    w_jaw *= sstep(-168.0, -118.0, y)                     # le bas du cou ne suit pas
    w_jaw *= 1.0 - sstep(56.0, 64.0, ax) * sstep(-78.0, -56.0, y)      # rien autour des oreilles
    zone = sstep(29.0, 14.0, ax) * sstep(-98.0, -90.0, y) * sstep(-50.0, -57.0, y) * sstep(-34.0, -26.0, z)
    return np.clip(w_jaw * (1 - zone) + w_mouth * zone, 0.0, 1.0)


def rotate(P, ang):
    """Rotation de points (n, 3) autour de l'axe x passant par la charnière (ang scalaire ou (n,))."""
    P = np.asarray(P, np.float64)
    py, pz = HM.JAW_PIVOT[1], HM.JAW_PIVOT[2]
    c, s = np.cos(ang), np.sin(ang)
    y, z = P[:, 1] - py, P[:, 2] - pz
    out = P.copy()
    out[:, 1] = y * c - z * s + py
    out[:, 2] = y * s + z * c + pz
    return out


def jaw_delta(P, w=None):
    w = jaw_weight(P) if w is None else w
    return rotate(P, HM.JAW_ANGLE * w) - np.asarray(P, np.float64)


# ---------------------------------------------------------------------------------------------- dents
def _rounded_box(nu=10, nv=8, nw=6):
    """Pavé arrondi unitaire (superellipsoïde) : sommets (n, 3) dans [-1, 1]^3 et triangles."""
    us = np.linspace(-np.pi / 2, np.pi / 2, nv)
    vs = np.linspace(-np.pi, np.pi, nu, endpoint=False)
    e1, e2 = 0.35, 0.45
    sg = lambda a, e: np.sign(a) * np.abs(a) ** e
    V = []
    for u in us:
        for v in vs:
            V.append((sg(np.cos(u), e1) * sg(np.cos(v), e2), sg(np.sin(u), e1), sg(np.cos(u), e1) * sg(np.sin(v), e2)))
    V = np.array(V)
    I = []
    for i in range(nv - 1):
        for j in range(nu):
            a = i * nu + j; b = i * nu + (j + 1) % nu; c = (i + 1) * nu + (j + 1) % nu; d = (i + 1) * nu + j
            I += [a, d, c, a, c, b]
    return V, np.array(I, np.int64)


def _arch_points(R, Rz, zc, widths, side_gap=0.25):
    """Place des dents successives le long d'une demi-ellipse (vue de dessus) depuis le milieu."""
    phis = np.linspace(0, np.pi * 0.55, 2000)
    xs, zs = R * np.sin(phis), zc + Rz * np.cos(phis)
    L = np.r_[0, np.cumsum(np.hypot(np.diff(xs), np.diff(zs)))]
    out, s = [], 0.0
    for w in widths:
        mid = s + w / 2.0
        i = np.searchsorted(L, mid)
        i = min(i, len(L) - 2)
        tx, tz = xs[i + 1] - xs[i], zs[i + 1] - zs[i]
        tl = np.hypot(tx, tz)
        out.append((xs[i], zs[i], tx / tl, tz / tl))
        s += w + side_gap
    return out


def teeth(row='haut'):
    """Rangée de dents (repère tête, mm). Renvoie V (n, 3), I (m,), teinte par sommet (n,)."""
    V0, I0 = _rounded_box()
    if row == 'haut':
        widths = [8.4, 6.6, 7.6, 7.0, 6.6, 9.6]
        R, Rz, zc = 15.0, 14.6, -4.4
        y_root, y_edge = -59.0, -70.0                  # bord libre caché derrière la lèvre haute (bouche fermée)
        thick = [3.0, 2.8, 3.6, 4.6, 4.8, 6.4]
        extra = [0.0, -0.4, 0.8, -0.6, -0.8, -1.0]     # canines un peu plus longues
    else:
        widths = [5.4, 5.9, 6.9, 7.0, 7.1, 10.4]
        R, Rz, zc = 12.1, 11.9, -4.4
        y_root, y_edge = -84.5, -71.6                  # sous la fente labiale (bouche fermée : on ne voit que le noir)
        thick = [2.8, 2.9, 3.6, 4.4, 4.6, 6.0]
        extra = [0.0, -0.3, 1.2, -0.7, -0.9, -1.1]
    pts = _arch_points(R, Rz, zc, widths)
    Vs, Is, Cs = [], [], []
    off = 0
    for side in (1, -1):
        for k, (px, pz, tx, tz) in enumerate(pts):
            w, t = widths[k] * 0.5 - 0.15, thick[k] * 0.5
            nx_, nz_ = tz, -tx                      # normale de l'arc (vers l'extérieur)
            if row == 'haut':
                top, bot = y_root, y_edge - extra[k]
            else:
                top, bot = y_edge + extra[k], y_root
            hy = 0.5 * (top - bot); cy = 0.5 * (top + bot)
            V = V0.copy()
            # pointe des canines : resserre la largeur près du bord libre
            if k == 2:
                tip = (V[:, 1] < -0.3) if row == 'haut' else (V[:, 1] > 0.3)
                f = np.where(tip, 1.0 - 0.55 * (np.abs(V[:, 1]) - 0.3) / 0.7, 1.0)
                V[:, 0] *= f
            # légère courbure (couronne bombée à l'avant)
            lx = V[:, 0] * w
            ly = V[:, 1] * hy + cy
            lz = V[:, 2] * t + 0.25 * (1 - V[:, 0] ** 2)
            X = side * (px + lx * tx + lz * nx_)
            Z = pz + lx * tz + lz * nz_
            if side < 0:
                tri = I0.reshape(-1, 3)[:, ::-1].ravel()
            else:
                tri = I0
            Vs.append(np.stack([X, ly, Z], 1)); Is.append(tri + off)
            # teinte : jaunie, plus sombre au collet et entre les dents
            neck = (V[:, 1] > 0.45) if row == 'haut' else (V[:, 1] < -0.45)
            edge = (V[:, 1] < -0.6) if row == 'haut' else (V[:, 1] > 0.6)
            Cs.append(np.where(neck, 0.45, np.where(edge, 0.62, 0.8)) - 0.14 * np.abs(V[:, 0]) ** 4)
            off += len(V0)
    return np.vstack(Vs), np.concatenate(Is), np.concatenate(Cs)


def tongue():
    """Langue : masse aplatie posée sur le plancher de la cavité (suit entièrement la mâchoire)."""
    nu, nv = 24, 14
    V, I = [], []
    for i in range(nv):
        th = np.pi * i / (nv - 1)
        for j in range(nu):
            ph = 2 * np.pi * j / nu
            x, y, z = np.sin(th) * np.cos(ph), np.cos(th), np.sin(th) * np.sin(ph)
            V.append((x * 12.5, y * 3.4, z * 14.0))
    for i in range(nv - 1):
        for j in range(nu):
            a = i * nu + j; b = i * nu + (j + 1) % nu; c = (i + 1) * nu + (j + 1) % nu; d = (i + 1) * nu + j
            I += [a, b, c, a, c, d]
    V = np.array(V)
    # dos bombé, pointe aplatie et relevée, sillon médian
    V[:, 1] += 1.2 * (1 - (V[:, 0] / 12.5) ** 2) * (V[:, 1] > 0) - 0.6 * np.exp(-(V[:, 0] / 2.0) ** 2) * (V[:, 1] > 0)
    V[:, 1] += 0.08 * np.maximum(V[:, 2], 0)
    V += np.array([0.0, -78.2, -6.0])
    return V, np.array(I, np.int64)
