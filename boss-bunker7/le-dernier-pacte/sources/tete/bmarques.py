# Marques du Septième, sculptées dans la SDF fine et reprises par les textures :
#  - sceau à sept branches INVENTÉ gravé en cicatrices sur le crâne et le haut du front : un nœud central en
#    forme de haricot cabossé (boucle fermée, sans point central) d'où partent sept branches sinueuses, toutes
#    différentes (longueur, épaisseur, ondulation, sens de départ et de courbure alternés), ponctuées de
#    renflements et prolongées, pour certaines, de points brûlés. Bourrelets de cicatrice en relief, sillon
#    central incandescent. Ni symétrie de rotation ni miroir, ni étoile ni polygone, ni trait droit (rune), ni
#    croix, ni fourche, ni tige centrale à bras appariés, ni cercles concentriques.
#  - longue cicatrice chirurgicale de la tempe droite (x < 0) à la mâchoire, refermée par des agrafes
#    métalliques en relief.
# Tout est construit une fois à l'import : dessin 2D → projection sur le crâne (lancer de rayons sur la SDF de
# base), échantillonnage dense, arbres de recherche (distances exactes aux segments).
import numpy as np
from scipy.spatial import cKDTree
from sdf import sstep, smin
import bmodel as HM

F = np.float32
TAU = 2.0 * np.pi

# ============================================================================================ sceau
SEAL_O = np.array([0.0, 32.0, -80.0])                    # centre de projection (centre du crâne)
SEAL_N = np.array([0.15, 0.80, 0.58]); SEAL_N /= np.linalg.norm(SEAL_N)   # axe du sceau : dessus-avant, un peu à gauche
SEAL_R = 100.0                                           # rayon de la projection azimutale équidistante (mm)


def ring_radius(a):
    """Nœud central : haricot cabossé allongé en diagonale (rayon en mm selon l'angle), aucune symétrie."""
    return 8.2 + 2.4 * np.cos(2.0 * (a - 0.62)) + 0.7 * np.sin(3.0 * a + 2.1) + 0.35 * np.sin(5.0 * a + 4.0)


def ring_point(a):
    r = ring_radius(a)
    return np.array([r * np.cos(a), r * np.sin(a)])


def ring_normal(a, e=1e-4):
    t = ring_point(a + e) - ring_point(a - e)
    n = np.array([t[1], -t[0]])
    return n / np.linalg.norm(n)


# Branches : cap de départ h (°, 0 = gauche du personnage, 90 = avant), écart du point de départ sur le nœud
# (a0 = h − dep), longueur (mm), courbure (°/100 mm), ondulation (amplitude rad, longueur d'onde mm, phase),
# points brûlés au bout, épaisseur relative, renflements (positions 0..1). Caps irréguliers (écarts 38 à 66°),
# sens de départ et de courbure alternés : aucune symétrie de rotation, aucune roue.
ARMS = [
    dict(h=70.0, dep=-8.0, L=56.0, k=-14.0, wob=0.28, lam=44.0, ph=0.3, dots=2, w=1.05, beads=[0.46]),          # haut du front, côté gauche
    dict(h=114.0, dep=-6.0, L=44.0, k=+16.0, wob=0.26, lam=34.0, ph=2.0, dots=1, w=0.8, beads=[]),              # haut du front, au milieu
    dict(h=18.0, dep=+8.0, L=50.0, k=+24.0, wob=0.22, lam=46.0, ph=1.2, dots=3, w=0.9, beads=[0.36, 0.66]),     # vers la tempe gauche
    dict(h=-20.0, dep=+8.0, L=86.0, k=-16.0, wob=0.28, lam=54.0, ph=3.1, dots=0, w=0.8, beads=[0.5]),           # arrière gauche
    dict(h=-74.0, dep=-4.0, L=112.0, k=+10.0, wob=0.26, lam=60.0, ph=0.8, dots=2, w=1.12, beads=[0.3, 0.56, 0.8]),  # vers l'occiput
    dict(h=-122.0, dep=-8.0, L=76.0, k=-20.0, wob=0.26, lam=42.0, ph=4.4, dots=1, w=0.85, beads=[]),            # arrière droit
    dict(h=172.0, dep=+10.0, L=53.0, k=+26.0, wob=0.24, lam=36.0, ph=5.0, dots=0, w=0.75, beads=[0.52]),        # côté droit
]
for _A in ARMS:
    _A['a0'] = _A['h'] - _A['dep']
DOT_GAPS = [5.6, 11.0, 16.0]
DOT_RADII = [2.3, 1.95, 1.6]


def arm_heading(A, s):
    phi0 = np.radians(A['h'])
    return (phi0 + np.radians(A['k']) * s / 100.0
            + A['wob'] * (np.sin(TAU * s / A['lam'] + A['ph']) - np.sin(A['ph'])))


def design_2d(step=0.12):
    """Dessin du sceau dans le plan (u = gauche, v = avant), en mm. Renvoie lignes [(pts (n,2), largeurs (n,),
    t (n,), id)], points [(centre (2,), rayon)]."""
    lines, dots = [], []
    a = np.linspace(0.0, TAU, int(TAU * 9.0 / step), endpoint=False)
    ring = np.stack([ring_point(ai) for ai in a])
    ring = np.vstack([ring, ring[:1]])
    lines.append((ring, np.full(len(ring), 1.2), np.zeros(len(ring)), 0))
    for i, A in enumerate(ARMS):
        p = ring_point(np.radians(A['a0']))
        n = int(A['L'] / step)
        s = np.arange(n + 1) * step
        phi = arm_heading(A, s)
        d = np.stack([np.cos(phi), np.sin(phi)], 1)
        pts = p + np.vstack([[0.0, 0.0], np.cumsum(d[:-1] * step, 0)])
        t = s / A['L']
        w = A['w'] * (1.15 - 0.68 * t)
        for tb in A['beads']:
            w = w * (1.0 + 0.55 * np.exp(-((t - tb) / 0.028) ** 2))
        lines.append((pts, w, t, i + 1))
        for k in range(A['dots']):
            c = pts[-1] + d[-1] * DOT_GAPS[k]
            dots.append((c, DOT_RADII[k]))
    return lines, dots


def _frame():
    n = SEAL_N
    e1 = np.array([1.0, 0.0, 0.0]) - n[0] * n; e1 /= np.linalg.norm(e1)
    e2 = np.array([0.0, 0.0, 1.0]) - n[2] * n; e2 -= (e2 @ e1) * e1; e2 /= np.linalg.norm(e2)
    return n, e1, e2


def _ray_surface(origins, dirs, fn, t0, t1, iters=40):
    """Distance le long de rayons (de l'intérieur vers l'extérieur) jusqu'à la surface (bissection)."""
    lo = np.full(len(dirs), t0); hi = np.full(len(dirs), t1)
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        q = (origins + dirs * mid[:, None]).astype(F)
        inside = fn((q[:, 0], q[:, 1], q[:, 2])) < 0
        lo = np.where(inside, mid, lo); hi = np.where(inside, hi, mid)
    return 0.5 * (lo + hi)


def map_seal(uv):
    """Plan du sceau (mm) → points de la surface du crâne (projection azimutale équidistante puis rayon)."""
    n, e1, e2 = _frame()
    s = np.linalg.norm(uv, axis=1)
    w = (uv[:, :1] * e1 + uv[:, 1:2] * e2) / np.maximum(s, 1e-9)[:, None]
    th = s / SEAL_R
    dirs = np.cos(th)[:, None] * n + np.sin(th)[:, None] * w
    t = _ray_surface(SEAL_O[None, :], dirs, HM.head_sdf_coarse, 30.0, 170.0)
    return SEAL_O + dirs * t[:, None]


def surface_normals(P, e=0.08):
    g = []
    for k in range(3):
        o = np.zeros(3); o[k] = e
        a = (P + o).astype(F); b = (P - o).astype(F)
        g.append(HM.head_sdf_coarse((a[:, 0], a[:, 1], a[:, 2])) - HM.head_sdf_coarse((b[:, 0], b[:, 1], b[:, 2])))
    g = np.stack(g, 1)
    return g / np.linalg.norm(g, axis=1, keepdims=True)


class Lines:
    """Ensemble de polylignes 3D denses avec attributs par sommet ; distance exacte aux segments."""

    def __init__(self, polys):
        P, W, T, ID, nxt, prv = [], [], [], [], [], []
        off = 0
        for pts, w, t, i in polys:
            m = len(pts)
            P.append(pts); W.append(w); T.append(t); ID.append(np.full(m, i))
            k = np.arange(m) + off
            nxt.append(np.r_[k[1:], -1]); prv.append(np.r_[-1, k[:-1]])
            off += m
        self.P = np.vstack(P); self.W = np.concatenate(W); self.T = np.concatenate(T); self.ID = np.concatenate(ID)
        self.nxt = np.concatenate(nxt); self.prv = np.concatenate(prv)
        self.tree = cKDTree(self.P)
        self.lo = self.P.min(0); self.hi = self.P.max(0)

    def query(self, Q, cap=12.0):
        """Q (n, 3) → distance exacte, largeur, t, id (inf au-delà de cap)."""
        dd, k = self.tree.query(Q, distance_upper_bound=cap)
        far = ~np.isfinite(dd)
        k = np.where(far, 0, k)
        best = np.where(far, np.inf, dd)
        bt = self.T[k].copy(); bw = self.W[k].copy()
        for nb in (self.nxt[k], self.prv[k]):
            ok = (nb >= 0) & ~far
            nbs = np.where(ok, nb, 0)
            a, b = self.P[k], self.P[nbs]
            ab = b - a
            l2 = np.maximum((ab * ab).sum(1), 1e-12)
            u = np.clip(((Q - a) * ab).sum(1) / l2, 0.0, 1.0)
            dseg = np.linalg.norm(Q - a - ab * u[:, None], axis=1)
            better = ok & (dseg < best)
            best = np.where(better, dseg, best)
            bt = np.where(better, self.T[k] + (self.T[nbs] - self.T[k]) * u, bt)
            bw = np.where(better, self.W[k] + (self.W[nbs] - self.W[k]) * u, bw)
        return best, bw, bt, self.ID[k]


def _build_seal():
    lines, dots = design_2d()
    polys = []
    for pts, w, t, i in lines:
        polys.append((map_seal(pts), w, t, i))
    dc = map_seal(np.array([c for c, r in dots]))
    dr = np.array([r for c, r in dots])
    return Lines(polys), dc, dr, lines, dots


# ============================================================================================ cicatrice
# Tracé vu de côté (z, y) en mm, projeté sur le côté droit du visage (x < 0) : de la tempe, devant l'oreille,
# sur l'arcade zygomatique, le long de la branche montante puis du bord de la mâchoire.
SCAR_ZY = [(-14.0, 50.0), (-22.0, 33.0), (-31.0, 14.0), (-39.0, -6.0), (-44.0, -28.0), (-45.5, -50.0),
           (-42.0, -72.0), (-33.0, -91.0), (-19.0, -104.0), (-4.0, -112.0)]
STAPLE_STEP = 7.4


def _catmull2(pts, step):
    P = np.asarray(pts, float)
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(0, i - 1)], P[i], P[i + 1], P[min(len(P) - 1, i + 2)]
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for s in range(n):
            t = s / n; t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return np.asarray(out)


def _build_scar():
    zy = _catmull2(SCAR_ZY, 0.12)
    org = np.stack([np.full(len(zy), -150.0), zy[:, 1], zy[:, 0]], 1)
    dirs = np.tile([1.0, 0.0, 0.0], (len(zy), 1))
    # premier passage dans le volume en venant de la droite : marche grossière puis bissection
    xs = np.arange(0.0, 150.0, 0.5)
    hit = np.full(len(zy), np.nan)
    for x in xs:
        q = (org + dirs * x).astype(F)
        inside = HM.head_sdf_coarse((q[:, 0], q[:, 1], q[:, 2])) < 0
        new = inside & np.isnan(hit)
        hit[new] = x
    lo = hit - 0.5; hi = hit.copy()
    for _ in range(30):
        mid = 0.5 * (lo + hi)
        q = (org + dirs * mid[:, None]).astype(F)
        inside = HM.head_sdf_coarse((q[:, 0], q[:, 1], q[:, 2])) < 0
        lo = np.where(inside, lo, mid); hi = np.where(inside, mid, hi)
    P = org + dirs * (0.5 * (lo + hi))[:, None]
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    s = np.r_[0.0, np.cumsum(seg)]
    L = s[-1]
    line = Lines([(P, np.full(len(P), 0.5), s / L, 0)])
    # agrafes : position, tangente, normale, axe transverse (avec un peu de désordre)
    rng = np.random.default_rng(77)
    n_st = int((L - 14.0) / STAPLE_STEP) + 1
    ss_ = 7.0 + np.arange(n_st) * (L - 14.0) / max(n_st - 1, 1) + rng.uniform(-0.9, 0.9, n_st)
    C = np.stack([np.interp(ss_, s, P[:, k]) for k in range(3)], 1)
    Tg = np.stack([np.interp(ss_ + 0.6, s, P[:, k]) - np.interp(ss_ - 0.6, s, P[:, k]) for k in range(3)], 1)
    Tg /= np.linalg.norm(Tg, axis=1, keepdims=True)
    Nn = surface_normals(C)
    Tg = Tg - (Tg * Nn).sum(1, keepdims=True) * Nn; Tg /= np.linalg.norm(Tg, axis=1, keepdims=True)
    Bx = np.cross(Nn, Tg)
    ang = np.radians(rng.uniform(-11.0, 11.0, n_st))
    Bx = Bx * np.cos(ang)[:, None] + Tg * np.sin(ang)[:, None]
    hw = 3.0 + rng.uniform(-0.25, 0.3, n_st)
    lift = 0.36 + rng.uniform(-0.05, 0.12, n_st)
    return line, dict(C=C, T=Tg, N=Nn, B=Bx, hw=hw, lift=lift, s=ss_, L=L)


SEAL, DOT_C, DOT_R, SEAL_LINES2D, SEAL_DOTS2D = _build_seal()
DOT_TREE = cKDTree(DOT_C)
SCAR, STAPLES = _build_scar()
STAPLE_TREE = cKDTree(STAPLES['C'])
STAPLE_RW = 0.42


# ============================================================================================ champs
def seal_fields(Q):
    """Q (n, 3) → dict : distance à la ligne, demi-largeur du sillon, t, id de branche, distance au point brûlé
    le plus proche et son rayon, fondu des extrémités."""
    d, w, t, i = SEAL.query(Q)
    fade = np.where(i > 0, sstep(1.0, 0.86, t) * sstep(0.0, 0.02, t), 1.0)
    dd, k = DOT_TREE.query(Q, distance_upper_bound=12.0)
    far = ~np.isfinite(dd)
    k = np.where(far, 0, k)
    return dict(d=d, w=w, t=t, id=i, fade=fade, dd=np.where(far, np.inf, dd), dr=DOT_R[k])


def seal_relief(f):
    d, w, fade = f['d'], f['w'], f['fade']
    dn = np.where(np.isfinite(d), d, 99.0)
    h = (0.45 * np.exp(-((dn - (w + 0.9)) / 0.65) ** 2) - 0.6 * np.exp(-(dn / (0.95 * w)) ** 2)
         + 0.16 * np.exp(-(dn / (3.0 + w)) ** 2)) * fade
    r = np.where(np.isfinite(f['dd']), f['dd'], 99.0)
    rho = f['dr']
    h = h + 0.5 * np.exp(-((r - rho) / 0.6) ** 2) - 0.6 * np.exp(-(r / (0.6 * rho)) ** 2) + 0.12 * np.exp(-(r / (rho + 2.5)) ** 2)
    return h


def scar_fields(Q):
    d, w, t, i = SCAR.query(Q)
    fade = sstep(0.0, 0.035, t) * sstep(1.0, 0.965, t)
    # trous des pattes d'agrafes
    dk, k = STAPLE_TREE.query(Q, distance_upper_bound=10.0)
    far = ~np.isfinite(dk)
    k = np.where(far, 0, k)
    C, B, hw = STAPLES['C'][k], STAPLES['B'][k], STAPLES['hw'][k]
    p1 = np.linalg.norm(Q - (C + B * (hw + 0.15)[:, None]), axis=1)
    p2 = np.linalg.norm(Q - (C - B * (hw + 0.15)[:, None]), axis=1)
    pit = np.where(far, 99.0, np.minimum(p1, p2))
    return dict(d=d, t=t, fade=fade, pit=pit)


def scar_relief(f):
    dn = np.where(np.isfinite(f['d']), f['d'], 99.0)
    h = (0.52 * np.exp(-((dn - 1.45) / 0.8) ** 2) - 0.45 * np.exp(-(dn / 0.5) ** 2) + 0.30 * np.exp(-(dn / 4.5) ** 2)) * f['fade']
    h = h - 0.22 * np.exp(-(f['pit'] / 0.5) ** 2)
    return h


def _capsule(Q, a, b, r):
    ab = b - a
    u = np.clip(((Q - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-12), 0.0, 1.0)
    return np.linalg.norm(Q - a - ab * u[:, None], axis=1) - r


def staple_sdf(Q):
    """Agrafes : barre transversale posée sur la peau, pattes qui s'enfoncent (distance de l'agrafe la plus proche)."""
    dk, k = STAPLE_TREE.query(Q, distance_upper_bound=8.0)
    far = ~np.isfinite(dk)
    k = np.where(far, 0, k)
    C, N, B = STAPLES['C'][k], STAPLES['N'][k], STAPLES['B'][k]
    hw, lift = STAPLES['hw'][k][:, None], STAPLES['lift'][k][:, None]
    A1 = C + N * lift + B * hw
    A2 = C + N * lift - B * hw
    L1 = C - N * 1.1 + B * (hw + 0.15)
    L2 = C - N * 1.1 - B * (hw + 0.15)
    d = _capsule(Q, A1, A2, STAPLE_RW)
    d = np.minimum(d, _capsule(Q, A1, L1, STAPLE_RW * 0.95))
    d = np.minimum(d, _capsule(Q, A2, L2, STAPLE_RW * 0.95))
    return np.where(far, 99.0, d)


def _box(lines, pad):
    return lines.lo - pad, lines.hi + pad


SEAL_BOX = (np.minimum(SEAL.lo, DOT_C.min(0)) - 9.0, np.maximum(SEAL.hi, DOT_C.max(0)) + 9.0)
SCAR_BOX = _box(SCAR, 9.0)


def _in(P, box, d, band=8.0):
    lo, hi = box
    m = (P[0] > lo[0]) & (P[0] < hi[0]) & (P[1] > lo[1]) & (P[1] < hi[1]) & (P[2] > lo[2]) & (P[2] < hi[2]) & (np.abs(d) < band)
    return np.flatnonzero(m)


def apply(P, d):
    """Ajoute les marques fines à la distance d (tête complète) : relief du sceau et de la cicatrice, agrafes."""
    d = np.array(d, dtype=np.float64, copy=True)
    idx = _in(P, SEAL_BOX, d)
    if len(idx):
        Q = np.stack([P[0][idx], P[1][idx], P[2][idx]], 1).astype(np.float64)
        d[idx] -= seal_relief(seal_fields(Q))
    idx = _in(P, SCAR_BOX, d)
    if len(idx):
        Q = np.stack([P[0][idx], P[1][idx], P[2][idx]], 1).astype(np.float64)
        dq = d[idx] - scar_relief(scar_fields(Q))
        d[idx] = smin(dq, staple_sdf(Q), 0.22)
    return d


# ============================================================================================ contrôle du dessin
def design_raster(px=0.25, half=175.0):
    """Rastérise le dessin 2D du sceau (lignes et points) pour le contrôle topologique et l'aperçu."""
    n = int(2 * half / px)
    img = np.zeros((n, n), bool)
    for pts, w, t, i in SEAL_LINES2D:
        fade = np.where(np.asarray(t) < 0.97, 1.0, 0.0) if i > 0 else 1.0
        for (u, v), ww, ff in zip(pts[::2], np.broadcast_to(w, len(pts))[::2], np.broadcast_to(fade, len(pts))[::2]):
            if ff <= 0:
                continue
            cx, cy = int((u + half) / px), int((half - v) / px)
            r = max(1, int(ww / px))
            img[max(cy - r, 0):cy + r + 1, max(cx - r, 0):cx + r + 1] = True
    for (u, v), r in SEAL_DOTS2D:
        cx, cy = int((u + half) / px), int((half - v) / px)
        rr = int(r / px)
        yy, xx = np.ogrid[-rr:rr + 1, -rr:rr + 1]
        img[cy - rr:cy + rr + 1, cx - rr:cx + rr + 1] |= (xx * xx + yy * yy) <= rr * rr
    return img
