# Tête du Septième (boss de Bunker 7) : sculpture SDF. Repère « tête » en mm : origine au milieu des globes
# oculaires, x vers la gauche du personnage, y vers le haut, z vers l'avant. Placement dans le corps :
# HEAD_ORIGIN + p / 1000 (m). Personnage entièrement inventé (ne représente aucune personne réelle).
# Homme d'environ 55 ans, émacié : crâne rasé un peu allongé, orbites profondes, pommettes saillantes, joues
# creuses, nez long et mince légèrement busqué, lèvres minces, menton anguleux, oreilles normales, cou mince
# fermé en bas. Bouche entrouverte (fente + cavité) pour la morphose de mâchoire.
# Les marques fines (sceau à sept branches, cicatrice agrafée) sont dans bmarques.py : head_sdf_coarse sert au
# maillage, head_sdf (avec les marques) à la surface fine des textures (normales, occlusion).
import numpy as np, os
from sdf import *
from bcommun import *
from bake_lib import vnoise as _vnoise


def vnz(Q, freq, seed, scale=(1.0, 1.0, 1.0)):
    """Bruit de valeur 3D (0..1) sur un tuple de tableaux, avec étirement anisotrope."""
    P3 = np.stack([Q[0] * scale[0], Q[1] * scale[1], Q[2] * scale[2]], 1).astype(np.float32)
    return _vnoise(P3, freq, seed)


HEAD_ORIGIN = (0.0, 1.620, 0.064)

# ---------------------------------------------------------------------------------------------- bouche
SLIT_Y0, SLIT_CURVE, SLIT_HALF, SLIT_W = -70.4, 0.5, 0.72, 20.5    # fente labiale (mi-hauteur, demi-épaisseur, demi-largeur)
CAV_C, CAV_R = (0.0, -72.0, -6.0), (21.0, 11.5, 21.0)               # cavité buccale (ellipsoïde)
JAW_PIVOT = (0.0, -28.0, -70.0)                                      # charnière (articulation temporo-mandibulaire)
JAW_ANGLE = 0.25                                                     # rad : ≈ 30 mm d'ouverture au menton

# ---------------------------------------------------------------------------------------------- cou
NECK_Y = -272.0           # bas du cou : fond plat fermé, arrondi (pas de bord ouvert)
NECK_FILLET = 14.0


def slit_y(x):
    return SLIT_Y0 - SLIT_CURVE * (x / 22.0) ** 2


# ---------------------------------------------------------------------------------------------- volumes
SKULL_C, SKULL_R = (0.0, 32.0, -80.0), (75.0, 95.0, 101.0)      # crâne rasé, un peu allongé (haut et arrière)


def skull(P):
    return sell(P, SKULL_C, SKULL_R, n=2.3, m=2.35, cf=99.5, egg=0.09)


def midface_b(P):
    return sell(P, (0.0, -30.0, -33.0), (54.0, 54.0, 74.0), n=2.0, nb=2.4, m=2.4, cf=54.0, egg=0.14)


def jaw_block_b(P):
    """Mandibule longue et anguleuse (moins en V), bord inférieur net qui remonte vers l'angle."""
    x, y, z = P
    ze = z + 8.0 * sstep(-102.0, -120.0, y)
    u2 = sell2(x, ze, (0.0, -62.0), 56.0, 82.0, 22.0, n=2.9, egg=0.29)
    # bord inférieur : remonte vers l'angle de la mâchoire sur les côtés ; au centre, le plancher sous le
    # menton descend doucement vers la gorge (pas de rebord plat vu d'en dessous)
    side = sstep(12.0, 34.0, np.abs(x))
    rise = 0.5 * ((15.0 - z) + np.sqrt((15.0 - z) ** 2 + 16.0))         # max(15 − z, 0) adouci (pas de pli)
    border = -119.0 + 0.40 * rise * side - (1.0 - side) * (1.5 + 0.08 * rise)
    d = smax(u2, border - y, 9.0)
    return smax(d, y + 38.0, 14.0)


def nose_dorsum_s(P):
    """Dos du nez long et mince, bosse dorsale (nez légèrement busqué)."""
    x, y, z = P
    t = np.clip((6.0 - y) / 44.0, 0.0, 1.0)
    hump = 2.6 * np.exp(-((y + 19.0) / 7.0) ** 2) - 0.6 * np.exp(-((y + 33.0) / 4.0) ** 2)
    zd = 19.0 + 22.0 * t + hump + 0.5 * np.exp(-((y + 4.0) / 5.0) ** 2)
    rx = 4.1 + 3.3 * t
    rz = 8.5 + 6.0 * t
    d = ellipse2(x, z, (0.0, zd - rz), (rx, rz))
    d = smax(d, y - 9.0, 5.0)
    return smax(d, -(y + 44.0), 4.5)


def chin_s(P):
    """Menton anguleux : bloc arrondi à coins marqués (vu de face et de dessous)."""
    return superellipsoid(P, (0.0, -106.5, 13.0), (18.5, 12.0, 9.5), n=3.0)


def base_sdf(P):
    """Tête nue sans bouche ouverte ni marques fines."""
    x, y, z = P
    ax = np.abs(x)
    S = (ax, y, z)

    # --- crâne rasé, un peu allongé vers le haut et l'arrière
    d = skull(P)
    # --- étage moyen et mandibule
    d = op(d, P, (-95, -120, -135), (95, 50, 45), midface_b, 'u', 16.0)
    d = op(d, P, (-92, -175, -106), (92, -10, 47), jaw_block_b, 'u', 14.0)
    # --- maxillaire sous le nez
    d = op(d, P, (-50, -120, -75), (50, -15, 42), lambda Q: ellipsoid(Q, (0.0, -67.0, -17.0), (33.0, 37.0, 43.0)), 'u', 12.0)
    # --- pommettes hautes et saillantes, menton anguleux
    # pommettes : crête osseuse haute qui file vers l'oreille (arcade zygomatique), pas une boule
    d = op(d, S, (22, -52, -76), (90, 12, 28), lambda Q: tube(Q, [(46.0, -18.0, 1.0, 5.2), (52.0, -20.0, -5.0, 6.3), (58.0, -21.5, -16.5, 5.7),
                                                               (62.5, -21.5, -30.0, 4.5), (64.5, -20.0, -45.0, 3.5)], n=4), 'u', 17.0)
    d = op(d, P, (-40, -138, -14), (40, -84, 42), chin_s, 'u', 9.0)
    d = op(d, S, (26, -85, -95), (90, 10, -5), lambda Q: ellipsoid(Q, (57.0, -35.0, -50.0), (13.0, 29.0, 27.0)), 'u', 14.0)
    # --- angle de la mâchoire marqué, nuque
    d = op(d, S, (22, -105, -132), (88, -8, -48), lambda Q: ellipsoid(Q, (52.0, -58.0, -90.0), (10.5, 16.0, 13.5)), 'u', 16.0)

    # --- orbites profondes, tempes creusées
    d = op(d, S, (3, -28, -24), (62, 28, 34), lambda Q: ellipsoid(Q, (EYE_X, 1.5, 5.5), (15.4, 12.8, 13.8)), 's', 9.0)
    d = op(d, S, (36, -24, -62), (95, 64, 17), lambda Q: ellipsoid(Q, (80.0, 19.0, -23.0), (14.0, 24.0, 22.0)), 's', 14.0)

    # --- arcades sourcilières, glabelle
    brow_half = [(10, 16.5, 19.6, 5.8), (20, 19.0, 19.0, 5.6), (33, 19.4, 15.3, 5.1), (44, 15.6, 7.8, 4.3), (50, 7, -1.8, 4.1), (51.5, -6, -6, 4.6)]
    brow_ctrl = [(-p[0], p[1], p[2], p[3]) for p in reversed(brow_half)] + [(0.0, 15.6, 20.0, 5.6)] + brow_half
    d = op(d, P, (-80, -34, -37), (80, 54, 50), lambda Q: tube(Q, brow_ctrl, n=4), 'u', 18.0)
    d = op(d, P, (-25, -10, -5), (25, 35, 38), lambda Q: ellipsoid(Q, (0.0, 14.0, 16.0), (9.0, 7.0, 8.0)), 'u', 7.0)

    # --- nez long et mince, légèrement busqué ; pointe fine un peu tombante, ailes étroites
    idx, Q = region(P, (-34, -68, -2), (34, 22, 60))
    if len(idx):
        qx, qy, qz = Q
        dq = d[idx]
        Sn = (np.abs(qx), qy, qz)
        dq = smin(dq, nose_dorsum_s(Q), 6.0)
        tipd = smin(ellipsoid(Q, (3.0, -43.6, 36.2), (5.0, 6.6, 6.2)), ellipsoid(Q, (-3.0, -43.6, 36.2), (5.0, 6.6, 6.2)), 3.5)
        tipd = smin(tipd, ellipsoid(Q, (0.0, -48.4, 33.6), (4.4, 3.6, 4.6)), 3.0)
        dq = smin(dq, tipd, 4.5)
        dq = smin(dq, ellipsoid(Sn, (10.9, -47.2, 22.5), (4.2, 4.6, 7.0), R=rot(8, -28, 0)), 5.0)      # ailes étroites
        dq = smin(dq, tube((qx * 1.45, qy, qz), [(0, -48.2, 33.2, 2.4), (0, -52.4, 25.0, 2.1)], n=2), 2.5)
        dq = smax(dq, -ellipsoid(Sn, (5.6, -50.4, 28.8), (2.6, 1.7, 4.8), R=rot(-14, -16, 0)), 0.9)    # narines
        dq += grooves(Sn, [([(15.2, -51.5, 19.0), (16.0, -46.5, 21.0), (14.6, -41.5, 24.5), (11.2, -40.0, 28.5)], 0.8, 1.0),
                           ([(11.2, -40.0, 28.5), (7.6, -42.6, 34.0)], 0.4, 0.8)])
        d[idx] = dq

    # --- lèvres minces
    idx, Q = region(P, (-32, -86, -2), (32, -58, 40))
    if len(idx):
        qx, qy, qz = Q
        dq = d[idx]
        up_pts = [(22.0, -70.2, 11.5, 0.8), (15.5, -68.9, 19.6, 1.4), (7.5, -68.2, 25.2, 1.7)]
        up_ctrl = [(-p[0], p[1], p[2], p[3]) for p in up_pts] + [(0.0, -68.3, 26.3, 1.8)] + [p for p in reversed(up_pts)]
        dq = smin(dq, tube((qx, (qy + 67.8) / 1.1 - 67.8, qz), up_ctrl, n=4), 3.0)
        lo_pts = [(22.0, -71.2, 11.0, 0.8), (15.0, -72.6, 17.8, 1.7), (6.5, -73.5, 22.2, 2.3)]
        lo_ctrl = [(-p[0], p[1], p[2], p[3]) for p in lo_pts] + [(0.0, -73.7, 22.8, 2.4)] + [p for p in reversed(lo_pts)]
        dq = smin(dq, tube((qx, (qy + 73.8) / 1.08 - 73.8, qz), lo_ctrl, n=4), 3.0)
        d[idx] = dq

    # --- cou mince, tendons, larynx ; fermé en bas (fond plat à bord arrondi, dans les bornes de la grille)
    d = op(d, P, (-82, -300, -182), (82, 0, -8), lambda Q: tube((Q[0], Q[1], (Q[2] + 94.0) / 0.95 - 94.0), [(0, -300, -98, 53.5), (0, -160, -94, 49.5), (0, -118, -93, 47.5), (0, -80, -100, 38.0)], n=5), 'u', 26.0)
    d = op(d, S, (0, -300, -125), (80, -25, -10), lambda Q: tube(Q, [(41, -104, -97, 7.6), (29.5, -150, -66, 8.2), (15.0, -226, -47, 6.8), (10.5, -258, -45, 4.6)], n=4), 'u', 12.0)
    d = op(d, P, (-16, -146, -60), (16, -108, -30), lambda Q: ellipsoid(Q, (0.0, -127.0, -44.5), (4.2, 6.5, 2.6)), 'u', 7.0)
    # sillon de la nuque (ligament nucal entre les deux masses musculaires)
    d = op(d, P, (-20, -200, -175), (20, -60, -110), lambda Q: grooves(Q, [([(0.0, -84.0, -146.0), (0.0, -120.0, -146.5), (0.0, -170.0, -148.0)], 1.1, 5.0, 0.3)]), 'a', 0.0)
    d = smax(d, NECK_Y - y, NECK_FILLET)

    # --- oreilles normales
    idx, Q = region(S, (46, -70, -130), (108, 34, -46))
    if len(idx):
        dq = d[idx]
        ear, c1, canal = ear_sdf(Q)
        dq = smin(dq, ear, 2.0)
        dq = smax(dq, -canal, 1.5)
        d[idx] = dq

    # --- reliefs du visage : rides du lion, cernes creusés, sillons marqués, joues creuses, tempes décharnées
    idx, Q = region(S, (-1, -126, -64), (80, 47, 58))
    if len(idx):
        E = EYE_X
        d[idx] += grooves(Q, [
            ([(E - 11, 4.6, 10.5), (E - 4, 7.3, 13.2), (E + 3, 7.7, 13.0), (E + 9, 6.6, 10.4), (E + 13.5, 4.2, 5.6)], 0.6, 0.75),
            ([(E - 10, 6.8, 11.5), (E - 3, 9.4, 13.4), (E + 4, 9.7, 12.9), (E + 10, 8.3, 9.6)], -0.30, 1.5),
            # cernes creusés, vallée des larmes nette
            ([(E - 11, -8.5, 9.8), (E - 4, -12.6, 11.4), (E + 3, -14.0, 11.0), (E + 10, -13.0, 8.0)], 0.8, 2.6, 0.3),
            ([(E - 10, -6.4, 10.6), (E, -8.4, 12.9), (E + 10, -6.4, 9.2)], -0.18, 1.5),
            # sillons nasogéniens profonds (âge, maigreur)
            ([(16.5, -48, 21.0), (23.5, -58, 16.5), (27.0, -68, 11.8), (28.5, -78, 7.0), (28.5, -90, 2.5)], 1.0, 2.6, 0.2),
            ([(21.0, -48, 19.0), (28.0, -58, 14.0), (31.5, -68, 9.5), (33.0, -78, 4.5)], -0.25, 3.5, 0.35),
            # plis d'amertume aux commissures, sillon mentonnier
            ([(23.0, -73.5, 10.5), (25.5, -80.0, 8.0), (26.5, -88.0, 5.5)], 0.7, 1.6, 0.3),
            ([(-14, -85.5, 18.0), (-7, -87.0, 20.6), (0, -87.5, 21.4), (7, -87.0, 20.6), (14, -85.5, 18.0)], 1.3, 2.6, 0.25),
            ([(21.0, -70.2, 12.6), (23.5, -71.2, 10.6), (25.5, -72.4, 9.0)], 1.0, 1.8, 0.4),
            # philtrum
            ([(3.6, -53, 25.6), (4.2, -63.5, 28.4)], -0.35, 1.8, 0.25),
            ([(0.0, -53, 25.4), (0.0, -63.0, 28.2)], 0.3, 1.8, 0.25),
            # rides du lion (deux sillons verticaux) et une ride horizontale à la racine du nez
            ([(4.6, 8.0, 24.0), (5.6, 20.5, 24.8), (6.6, 33.0, 23.8)], 0.55, 1.5, 0.3),
            ([(9.5, 11.0, 23.4), (11.0, 22.0, 23.2)], 0.3, 1.2, 0.35),
            ([(-6.0, 8.5, 22.6), (0.0, 8.0, 23.0), (6.0, 8.5, 22.6)], 0.35, 0.9, 0.35),
        ])
        # joues creuses sous les pommettes, mâchoire décharnée
        d[idx] += 3.2 * gbump(Q, (41.5, -56.0, 3.0), (11.0, 14.5, 11.5))
        d[idx] += 1.6 * gbump(Q, (49.0, -80.0, -14.0), (9.0, 12.0, 12.0))
        d[idx] += 1.2 * gbump(Q, (40.0, -118.0, -18.0), (12.0, 7.0, 14.0))          # creux sous le bord de la mâchoire

    # --- paupières : coque sphérique autour du globe, découpée en amande (paupière haute lourde)
    idx, Q = region(S, (12, -22, -8), (52, 22, 24))
    if len(idx):
        qx, qy, qz = Q
        dq = d[idx]
        ex, ey, ez = qx - EYE_X, qy, qz
        rho = length(ex, ey, ez)
        RR = 15.5
        ad, up, lo, tc, su, sl = almond(RR * ex / rho, RR * ey / rho)
        yc = CM[1] + (CL[1] - CM[1]) * tc
        yn = RR * ey / rho
        above = sstep(yc - 0.5, yc + 0.5, yn)
        hu = np.clip((yn - up) / 6.0, 0.0, 1.0)
        hl = np.clip((lo - yn) / 6.0, 0.0, 1.0)
        tl = above * (1.9 + 1.2 * np.sin(np.pi * 0.5 * hu)) + (1.0 - above) * (1.4 + 0.45 * np.sin(np.pi * 0.5 * hl))
        shell = np.maximum(rho - (LID_RI + tl), LID_RI - rho)
        shell = np.maximum(shell, -(ez + 6.0))
        dq = smin(dq, shell, 2.5)
        cut = np.maximum(np.maximum(ad * rho / RR, rho - (LID_RI + 4.5)), -ez - 1.0)
        dq = smax(dq, -cut, 0.45)
        dq = smin(dq, ellipsoid((ex, ey, ez), (-12.8, -0.9, 5.4), (2.1, 1.5, 1.9)), 0.6)
        dq = smax(dq, -(rho - LID_RI), 0.3)
        d[idx] = dq
    return d


def mouth_carve(P, d):
    """Bouche entrouverte : fente entre les lèvres et cavité buccale."""
    idx, Q = region(P, (-30, -90, -32), (30, -55, 48))
    if len(idx):
        qx, qy, qz = Q
        # fente en lentille : pleine épaisseur au centre, refermée vers les commissures
        lens = SLIT_HALF * np.clip(1.0 - (qx / SLIT_W) ** 2, 0.0, 1.0) ** 0.55
        dslab = np.abs(qy - slit_y(qx)) - lens
        dside = np.abs(qx) - SLIT_W
        ds = smax(smax(dslab, dside, 1.2), np.maximum(-10.0 - qz, qz - 46.0), 1.0)
        dq = smax(d[idx], -ds, 1.3)
        dq = smax(dq, -ellipsoid(Q, CAV_C, CAV_R), 3.0)
        d[idx] = dq
    return d


def head_sdf_coarse(P, parts=None):
    """Volume de la tête sans les marques fines (maillage bas-poly, projection des sommets)."""
    return mouth_carve(P, base_sdf(P)).astype(F)


def head_sdf(P, parts=None):
    """Volume complet : marques fines comprises (sceau gravé, cicatrice, agrafes)."""
    import bmarques as BM
    d = mouth_carve(P, base_sdf(P))
    return BM.apply(P, d).astype(F)


BOUNDS = ((-102.0, -282.0, -194.0), (102.0, 142.0, 62.0))
FACE_BOUNDS = ((-62.0, -128.0, -45.0), (62.0, 40.0, 58.0))
