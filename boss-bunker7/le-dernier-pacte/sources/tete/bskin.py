# Peau du Septième : masques et cartes (albédo, relief fin, rugosité, émission, métal).
# P (n, 3) en mm dans le repère tête, N (n, 3) normales, ao (n,) occlusion.
# Crâne entièrement rasé (aucun cheveu), sourcils gris clairsemés, chaume gris très court sur la mâchoire
# seulement (rien au-dessus de la lèvre), sceau gravé incandescent, cicatrice agrafée, veines sombres.
import numpy as np
import bmodel as HM
import bmarques as BM
from bake_lib import vnoise, fbm, worley, strokes2d
from sdf import ellipsoid

F = np.float32


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def hexc(h):
    return np.array([((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255], F)


def mix(a, b, t):
    t = np.asarray(t, F)[..., None] if np.ndim(t) else t
    return a + (b - a) * t


def interp_table(x, tab):
    tab = np.asarray(tab, float)
    return np.interp(x, tab[:, 0], tab[:, 1])


def seg2d(x, y, pts):
    Q = np.asarray(pts, float)
    L = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(Q, axis=0), axis=1))]
    d = tt = None
    for i in range(len(Q) - 1):
        a, b = Q[i], Q[i + 1]
        ab = b - a; l2 = float(ab @ ab)
        t = np.clip(((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / l2, 0, 1)
        di = np.hypot(x - a[0] - t * ab[0], y - a[1] - t * ab[1])
        ti = (L[i] + t * (L[i + 1] - L[i])) / L[-1]
        if d is None:
            d, tt = di, ti
        else:
            m = di < d; d = np.where(m, di, d); tt = np.where(m, ti, tt)
    return d, tt


def T3(P):
    return (P[:, 0], P[:, 1], P[:, 2])


# ----------------------------------------------------------------------------- palette (sRGB)
SKIN = hexc(0x9fa5a9)          # très pâle, gris-bleuté
SKIN_LIGHT = hexc(0xafb4b7)
SKIN_COLD = hexc(0x7c8b97)     # gris-bleu des creux
SKIN_SICK = hexc(0x9fa197)     # teinte maladive
SKIN_DEEP = hexc(0x80808c)
LIVOR = hexc(0x726f8a)         # marbrures bleu-violet sous la peau
BRUISE = hexc(0x4a3c52)        # orbites et cernes
LID = hexc(0x6a5e6c)
EAR = hexc(0x9c9398)
VEIN = hexc(0x261f36)
VEIN_HALO = hexc(0x7c7e94)
LIP = hexc(0x564650)
LIP_DARK = hexc(0x33252c)
LIP_FLAKE = hexc(0x7d7276)
BROW_C = hexc(0x77777a)        # sourcils gris cendré
STUB_DARK = hexc(0x55565b)     # chaume gris (mélange de poils sombres et blancs)
STUB_LIGHT = hexc(0xb4b5b8)
SCALP_SHADOW = hexc(0x8f97a0)  # ombre bleutée du crâne rasé (follicules), très légère
MOUTH = hexc(0x2a1315)
MOUTH_DEEP = hexc(0x0b0304)
SEAL_TISSUE = hexc(0xc4aaa8)   # bourrelets de cicatrice, nacrés
SEAL_INFL = hexc(0x8e626b)     # peau irritée autour du sceau
SEAL_CORE = hexc(0x4c0e06)     # fond du sillon (braise ; la lumière vient de l'émission)
SCAR_TISSUE = hexc(0x9a7d88)   # cicatrice chirurgicale gonflée, violacée
SCAR_LINE = hexc(0x2c0d10)     # incision croûteuse
SCAR_INFL = hexc(0x8c5c63)
STEEL = hexc(0x8b8e93)
STEEL_DARK = hexc(0x3b3d42)
RUST = hexc(0x6b3a22)
NECK_CAP = hexc(0x2a2426)      # fond du cou (caché dans le col)
GLOW = np.array([1.0, 0.33, 0.08], F)          # émission du sceau (rouge-orangé, sRGB)
GLOW_HALO = np.array([0.6, 0.07, 0.015], F)
THROAT_GLOW = np.array([0.26, 0.035, 0.012], F)


# ----------------------------------------------------------------------------- masques
def lips_mask(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    ys = HM.slit_y(x)
    yu = -65.8 - 0.8 * (ax / 22.0) ** 2
    yl = -76.4 + 3.0 * (ax / 22.0) ** 2
    up = ss(yu + 1.0, yu - 1.0, y) * (y > ys - 0.2)
    lo = ss(yl - 1.2, yl + 1.2, y) * (y < ys + 0.2)
    m = np.maximum(up, lo) * ss(23.5, 20.5, ax) * ss(10.0, 16.0, z)
    return m.astype(F), up, lo


def mouth_mask(P):
    """Intérieur de la bouche : parois de la cavité et faces internes des lèvres (fente)."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    dcav = ellipsoid(T3(P), HM.CAV_C, HM.CAV_R)
    cav = ss(2.2, 0.6, np.abs(dcav)) * ss(30.0, 22.0, np.abs(x)) * ss(-92.0, -86.0, y) * ss(-54.0, -58.0, y)
    slit = ss(HM.SLIT_HALF + 1.4, HM.SLIT_HALF + 0.2, np.abs(y - HM.slit_y(x))) * ss(21.5, 19.5, np.abs(x)) * ss(27.0, 21.0, z)
    corner = ss(3.2, 1.0, np.abs(y - HM.slit_y(x))) * ss(16.0, 20.0, np.abs(x)) * ss(26.0, 22.0, np.abs(x)) * ss(21.0, 15.0, z)
    deep = ss(4.0, -14.0, z)                   # fond de la cavité (gorge)
    front = ss(-36.0, -28.0, z)                # rien sur la nuque à la même hauteur
    return (np.clip(np.maximum(np.maximum(cav, slit), corner), 0, 1) * front).astype(F), deep.astype(F)


def eye_fields(P):
    ex, ey, ez = np.abs(P[:, 0]) - HM.EYE_X, P[:, 1], P[:, 2]
    rho = np.sqrt(ex ** 2 + ey ** 2 + ez ** 2) + 1e-6
    RR = 15.5
    ad, up, lo, tc, su, sl = HM.almond(RR * ex / rho, RR * ey / rho)
    yn = RR * ey / rho
    near = ss(22.0, 15.0, rho) * ss(-4.0, 2.0, ez)
    dup = yn - up
    dlo = lo - yn
    inside_t = ss(-0.02, 0.06, tc) * ss(1.02, 0.94, tc)
    lash = np.exp(-((dup - 0.5) / 0.9) ** 2) * inside_t * near * (0.6 + 0.4 * ss(0.1, 0.7, tc))
    wet_up = np.exp(-((dup - 0.05) / 0.35) ** 2) * inside_t * near
    wet_lo = np.exp(-((dlo - 0.1) / 0.45) ** 2) * inside_t * near
    lower_lash = np.exp(-((dlo - 0.6) / 0.6) ** 2) * inside_t * near * ss(0.25, 0.8, tc) * 0.5
    sunken = np.exp(-(((ex) / 17.0) ** 2 + ((ey + 3.0) / 14.0) ** 2)) * ss(-12.0, 4.0, ez)
    circles = np.exp(-((dlo - 4.5) / 3.6) ** 2) * ss(-0.3, 0.2, tc) * ss(1.3, 0.85, tc) * ss(30.0, 15.0, rho)
    upper_lid = ss(0.0, 1.0, dup) * ss(10.0, 4.0, dup) * inside_t * near
    caruncle = np.exp(-(((ex + 12.8) / 2.2) ** 2 + ((ey + 0.9) / 1.6) ** 2 + ((ez - 5.4) / 2.0) ** 2))
    return dict(lash=lash, wet_up=wet_up, wet_lo=wet_lo, lower_lash=lower_lash, circles=circles, sunken=sunken,
                upper_lid=upper_lid, caruncle=caruncle, dlo=dlo, dup=dup, near=near, tc=tc, rho=rho, ex=ex, ey=ey)


BROW = [(10.5, 13.4), (16.5, 16.2), (23.5, 18.6), (31.5, 19.8), (39.0, 19.4), (46.0, 16.8), (51.0, 13.0)]


def brow_mask(P):
    """Sourcils clairsemés (gris)."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    d, t = seg2d(ax, y, BROW)
    width = 2.6 - 1.6 * t ** 1.2
    j = (fbm(P, 0.8, 31, 3) - 0.5) * 1.1
    above = (y > interp_table(ax, BROW)).astype(F)
    feather = 0.8 + 1.0 * above
    m = ss(width + feather + j, width - 0.9 + j, d) * ss(0.0, 0.08, t) * ss(1.0, 0.82, t) * ss(-2.0, 6.0, z)
    return m.astype(F), t


def ear_mask(P):
    S = (np.abs(P[:, 0]), P[:, 1], P[:, 2])
    x, y, z = S[0] - HM.EAR_A[0], S[1] - HM.EAR_A[1], S[2] - HM.EAR_A[2]
    u = x * HM.EAR_U[0] + y * HM.EAR_U[1] + z * HM.EAR_U[2]
    v = x * HM.EAR_V[0] + y * HM.EAR_V[1] + z * HM.EAR_V[2]
    w = x * HM.EAR_W[0] + y * HM.EAR_W[1] + z * HM.EAR_W[2]
    out = HM.ellipse2(u, v, (-2.0, 14.5), (22.5, 16.0))
    out = np.minimum(out, HM.ellipse2(u, v, (-29.0, 9.5), (10.0, 8.5)))
    m = ss(2.5, -1.0, out) * ss(-6.0, -2.0, w)
    conch = np.clip(1.0 - ((u + 10.0) / 9.0) ** 2 - ((v - 7.6) / 7.6) ** 2, 0.0, 1.0)
    return m.astype(F), conch.astype(F)


# ligne (fictive) d'implantation des cheveux rasés : hauteur y selon l'angle autour d'un axe vertical
SCALP_LINE = [(0.0, 84.0), (0.45, 80.0), (0.75, 66.0), (1.05, 46.0), (1.25, 30.0), (1.40, 16.0), (1.55, 26.0),
              (1.9, 22.0), (2.3, -10.0), (2.7, -42.0), (3.1416, -52.0)]


def scalp_mask(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    a = np.abs(np.arctan2(x, z + 72.0))
    edge = y - interp_table(a, SCALP_LINE)
    S = (np.abs(x), y, z)
    earm = ss(6.0, -2.0, ellipsoid(S, (72.0, -14.0, -82.0), (16.0, 34.0, 26.0)))
    return (ss(-2.0, 7.0, edge) * (1.0 - earm)).astype(F)


def stubble_mask(P, lips, mouth):
    """Chaume gris très court : mâchoire, menton, dessous de la mâchoire. Rien au-dessus de la lèvre."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    m = ss(-64.0, -80.0, y) * ss(-150.0, -128.0, y) * ss(-80.0, -58.0, z)
    m *= 1.0 - ss(30.0, 22.0, ax) * ss(-92.0, -82.0, y) * ss(5.0, 12.0, z)          # pas autour de la bouche
    m *= 1.0 - np.clip(lips + mouth, 0, 1)
    m *= 0.55 + 0.45 * ss(0.3, 0.6, fbm(P, 0.08, 61, 3))
    return np.clip(m, 0, 1).astype(F)


# ----------------------------------------------------------------------------- veines
def veins(P):
    """Veines sombres : rayons autour des yeux, réseau et troncs sinueux sur les tempes."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    side = np.sign(x) + (x == 0)
    out = np.zeros(len(P), F)
    # rayons autour des orbites (plus marqués vers le coin externe et sous l'œil)
    ex, ey = ax - HM.EYE_X, y + 1.0
    r = np.hypot(ex, ey) + 1e-6
    th = np.arctan2(ey, ex)
    q = np.stack([np.cos(th) * 5.5 + side * 13.0, np.sin(th) * 5.5, np.log(r) * 1.6], 1).astype(F)
    n1 = vnoise(q, 1.0, 301)
    n2 = vnoise(q * 2.3, 1.0, 302)
    ridge = 1.0 - np.abs(2.0 * (0.65 * n1 + 0.35 * n2) - 1.0)
    rad = ss(0.93, 0.985, ridge) * ss(11.0, 15.0, r) * ss(31.0, 18.0, r)
    rad *= 0.55 + 0.45 * ss(-0.2, 0.9, np.cos(th + 0.9))
    rad *= ss(0.25, 0.6, fbm(P, 0.08, 303, 3)) * ss(-8.0, 4.0, z)
    out = np.maximum(out, rad)
    # réseau ramifié organique (bruit « ridé » déformé) : tempes surtout, un peu sur la mâchoire et le cou
    warp = np.stack([fbm(P, 0.045, 314, 3), fbm(P + 31.0, 0.045, 315, 3), fbm(P + 57.0, 0.045, 316, 3)], 1)
    Q = (P + (warp - 0.5) * 22.0).astype(F)
    rr1 = 1.0 - np.abs(2.0 * fbm(Q, 0.11, 317, 3) - 1.0)
    rr2 = 1.0 - np.abs(2.0 * fbm(Q * F(1.9) + 11.0, 0.11, 318, 3) - 1.0)
    net = ss(0.935, 0.985, rr1)
    netf = ss(0.95, 0.99, rr2) * 0.65
    temples = np.exp(-(((ax - 67.0) / 14.0) ** 2 + ((y - 22.0) / 30.0) ** 2)) * ss(-55.0, -20.0, z)
    neck = ss(-125.0, -160.0, y) * ss(-80.0, -40.0, z) * (0.6 + 0.4 * ss(20.0, 45.0, ax)) * 0.45
    jaw = np.exp(-(((ax - 50.0) / 12.0) ** 2 + ((y + 80.0) / 18.0) ** 2)) * ss(-60.0, -20.0, z) * 0.4
    reg = np.clip(temples * 0.75 + neck + jaw, 0, 1) * ss(0.35, 0.65, fbm(P, 0.05, 313, 3))
    out = np.maximum(out, np.maximum(net, netf) * reg)
    # troncs : veine temporale sinueuse (bien visible sur le crâne rasé), branche frontale
    for pts, w in [([(58.0, 66.0), (62.0, 52.0), (65.0, 38.0), (69.0, 24.0), (71.0, 12.0), (72.0, 2.0)], 1.15),
                   ([(48.0, 58.0), (52.0, 47.0), (58.0, 40.0), (62.0, 38.0)], 0.8)]:
        wob = 1.8 * (vnoise(P * F(0.12), 1.0, 321) - 0.5)
        dd, tt = seg2d(ax + wob, y, pts)
        msk = ss(-60.0, -15.0, z)
        out = np.maximum(out, np.exp(-(dd / w) ** 2) * ss(0.0, 0.1, tt) * ss(1.0, 0.85, tt) * msk)
    return np.clip(out, 0, 1).astype(F)


# ----------------------------------------------------------------------------- marques
def seal_masks(P):
    f = BM.seal_fields(P.astype(np.float64))
    d = np.where(np.isfinite(f['d']), f['d'], 99.0)
    w, fade = f['w'], f['fade']
    core = ss(w * 1.05, w * 0.35, d) * fade
    ridge = np.exp(-((d - (w + 0.9)) / 0.75) ** 2) * fade
    halo = np.exp(-(d / (3.2 + w)) ** 2) * fade
    r = np.where(np.isfinite(f['dd']), f['dd'], 99.0)
    rho = f['dr']
    core = np.maximum(core, ss(0.62 * rho, 0.3 * rho, r))
    ridge = np.maximum(ridge, np.exp(-((r - rho) / 0.65) ** 2))
    halo = np.maximum(halo, np.exp(-(r / (rho + 3.0)) ** 2))
    return core.astype(F), ridge.astype(F), halo.astype(F), f['t'], f['id']


def scar_masks(P):
    f = BM.scar_fields(P.astype(np.float64))
    d = np.where(np.isfinite(f['d']), f['d'], 99.0)
    fade = f['fade']
    line = ss(0.75, 0.2, d) * fade
    swell = np.exp(-((d - 1.45) / 0.9) ** 2) * fade
    band = np.exp(-(d / 5.0) ** 2) * fade
    infl = np.exp(-(d / 8.0) ** 2) * fade
    pit = np.exp(-(f['pit'] / 0.55) ** 2)
    return line.astype(F), swell.astype(F), band.astype(F), infl.astype(F), pit.astype(F)


def staple_mask(P):
    s = BM.staple_sdf(P.astype(np.float64))
    return ss(0.14, -0.04, s).astype(F)


# ----------------------------------------------------------------------------- cuisson
def skin_maps(P, N, ao):
    """Renvoie albédo (n,3), relief (n,), rugosité (n,), émission (n,3), métal (n,), masques."""
    n = len(P)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    lips, lip_up, lip_lo = lips_mask(P)
    mouth, deep = mouth_mask(P)
    E = eye_fields(P)
    brow, brow_t = brow_mask(P)
    earm, conch = ear_mask(P)
    scalp = scalp_mask(P)
    vn = veins(P)
    s_core, s_ridge, s_halo, s_t, s_id = seal_masks(P)
    c_line, c_swell, c_band, c_infl, c_pit = scar_masks(P)
    metal = staple_mask(P)
    stub = stubble_mask(P, lips, mouth) * (1.0 - c_band)
    cap = ss(-262.0, -270.5, y) * ss(-0.2, -0.7, N[:, 1])
    marks = np.clip(np.maximum(np.maximum(s_ridge, s_core), np.maximum(c_swell, c_line)), 0, 1)
    skin_w = np.clip(1.0 - mouth - marks - metal, 0, 1)

    # --- peau : pâle gris-bleuté, creux bleutés, plaques maladives, marbrures
    c = np.tile(SKIN, (n, 1))
    low = fbm(P, 0.04, 1, 4)
    mid = fbm(P, 0.12, 2, 3)
    c = mix(c, SKIN_LIGHT, ss(0.55, 0.8, mid) * 0.5 * ss(-40.0, 10.0, z))
    c = mix(c, SKIN_SICK, ss(0.5, 0.78, low) * 0.4)
    c = mix(c, SKIN_COLD, np.clip((1 - ao) * 1.6 + ss(0.45, 0.2, low) * 0.35, 0, 0.8))
    wq = np.stack([fbm(P, 0.03, 333, 3), fbm(P + 17.0, 0.03, 334, 3), fbm(P + 41.0, 0.03, 335, 3)], 1)
    Qm = (P + (wq - 0.5) * 30.0).astype(F)
    rm = 1.0 - np.abs(2.0 * fbm(Qm, 0.07, 336, 3) - 1.0)
    marb = ss(0.88, 0.97, rm) * (0.35 + 0.65 * ss(0.4, 0.7, fbm(P, 0.06, 332, 3)))
    marb *= np.clip(ss(-115.0, -150.0, y) + np.exp(-(((ax - 64.0) / 16.0) ** 2 + ((y - 20.0) / 30.0) ** 2)) + 0.25, 0, 1)
    c = mix(c, LIVOR, np.clip(marb * 0.16, 0, 0.2))
    hollow = np.exp(-(((ax - 41.0) / 12.0) ** 2 + ((y + 53.0) / 14.0) ** 2)) + np.exp(-(((ax - 74.0) / 12.0) ** 2 + ((y - 18.0) / 22.0) ** 2)) * ss(-50.0, -10.0, z)
    c = mix(c, SKIN_COLD * 0.92, np.clip(hollow * 0.45, 0, 0.5))
    # crâne rasé : ombre bleutée très légère des follicules (pas de cheveux)
    f1s, _, _ = worley(P.astype(np.float64), 1.0 / 0.42, 57, 0.9)
    foll = ss(0.32, 0.12, f1s)
    c = mix(c, SCALP_SHADOW, scalp * (0.10 + 0.10 * foll))
    # orbites creusées, cernes violacés, paupières sombres
    c = mix(c, BRUISE, np.clip(E['sunken'] * 0.55 + E['circles'] * 0.55, 0, 0.85))
    c = mix(c, LID, E['upper_lid'] * 0.5)
    c = mix(c, hexc(0x7a3d42), E['wet_lo'] * 0.75 + E['wet_up'] * 0.4)
    c = mix(c, hexc(0x8a4a4c), E['caruncle'] * 0.85)
    c = mix(c, hexc(0x141012), np.clip(E['lash'] * 0.85 + E['lower_lash'] * 0.5, 0, 1))
    # nez et oreilles : légère rougeur grise
    nose = np.exp(-((x / 9.0) ** 2 + ((y + 40.0) / 12.0) ** 2)) * ss(15.0, 30.0, z)
    c = mix(c, hexc(0xa79499), nose * 0.3)
    c = mix(c, EAR, earm * 0.6)
    c = mix(c, SKIN_DEEP * 0.7, conch * earm * 0.55)
    # sourcils gris clairsemés
    sel = brow > 0.02
    bstr = np.zeros(n, F)
    if sel.any():
        tab = np.radians(np.interp(np.linspace(8, 56, 64), [8, 14, 22, 32, 42, 50, 56], [70, 52, 30, 14, 2, -14, -22])).astype(np.float64)
        bstr[sel] = strokes2d(x[sel].astype(np.float64), y[sel].astype(np.float64), 0.55, 4.2, 0.11, 7, 8.0, 56.0, tab, 0.5, 0.55)
    c = mix(c, mix(BROW_C, SKIN_DEEP, 0.5), np.clip(brow * 0.3, 0, 1))
    c = mix(c, BROW_C * 0.85, np.clip(bstr * brow * 0.8, 0, 1))
    # veines (halo terne + trait sombre)
    c = mix(c, VEIN_HALO, np.clip(vn * 0.35 + ss(0.0, 0.5, vn) * 0.1, 0, 0.4) * skin_w)
    c = mix(c, VEIN, np.clip(vn * 0.55, 0, 0.55) * skin_w)
    # pores et grain
    pf1, pf2, prid = worley(P.astype(np.float64), 1.0 / 0.6, 101, 0.9)
    pores = ss(0.3, 0.08, pf1) * skin_w
    c = c * (1.0 - 0.07 * pores[:, None])
    c = c * (0.965 + 0.06 * vnoise(P, 2.0, 102)[:, None])
    # chaume gris très court (mâchoire)
    f1b, _, _ = worley(P.astype(np.float64), 1.0 / 0.34, 71, 0.95)
    hairs = ss(0.36, 0.14, f1b)
    tone = ss(0.35, 0.65, vnoise(P * F(3.0), 1.0, 72))
    c = mix(c, mix(STUB_DARK, STUB_LIGHT, tone), np.clip(hairs * stub * 0.55, 0, 1))
    c = mix(c, SKIN_COLD * 0.95, stub * 0.12)
    # lèvres minces, sombres et gercées
    flake = ss(0.66, 0.84, vnoise(P * F(np.array([1.6, 0.5, 1.0])), 1.3, 121))
    lipc = mix(LIP, LIP_DARK, ss(0.35, 0.75, fbm(P, 0.5, 122, 3)) * 0.5)
    near_slit = ss(2.2, 0.2, np.abs(y - HM.slit_y(x)))
    lipc = mix(lipc, LIP_DARK * 0.8, near_slit * 0.6)
    lipc = mix(lipc, LIP_FLAKE, flake * 0.2)
    c = mix(c, lipc, lips * 0.8)
    # sceau : peau irritée autour, bourrelets nacrés, sillon de braise
    c = mix(c, SEAL_INFL, np.clip(s_halo * 0.32, 0, 0.32))
    c = mix(c, SEAL_TISSUE, np.clip(s_ridge * 0.75, 0, 0.75))
    c = mix(c, SEAL_CORE, s_core)
    # cicatrice chirurgicale : inflammation, bourrelets violacés, incision croûteuse, trous d'agrafes
    c = mix(c, SCAR_INFL, np.clip(c_infl * 0.28, 0, 0.3))
    c = mix(c, SCAR_TISSUE, np.clip(c_swell * 0.7 + c_band * 0.15, 0, 0.75))
    c = mix(c, SCAR_LINE, np.clip(c_line * 0.92, 0, 1))
    c = mix(c, hexc(0x3a1013), c_pit * 0.85)
    # agrafes : acier sombre, un peu de rouille
    rust = ss(0.55, 0.8, fbm(P, 1.1, 81, 3))
    steel = mix(mix(STEEL, STEEL_DARK, ss(0.3, 0.7, vnoise(P * F(2.0), 1.0, 82))), RUST, rust * 0.6)
    c = mix(c, steel, metal)
    # intérieur de la bouche
    mc = mix(MOUTH, MOUTH_DEEP, deep)
    c = mix(c, mc, mouth)
    # fond du cou fermé (caché dans le col) : sombre
    c = mix(c, NECK_CAP, cap)
    # occlusion douce dans l'albédo
    c = c * (0.80 + 0.20 * ao[:, None])

    # --- relief fin (mm, positif = bosse) ; le sceau, la cicatrice et les agrafes sont dans la SDF fine
    hgt = np.zeros(n, F)
    hgt -= 0.02 * pores
    hgt += 0.005 * (vnoise(P, 3.0, 111) - 0.5)
    # rides du bas du front (sous le sceau), pattes d'oie, plis sous les yeux, cou
    for yy in (37.0, 45.5):
        wav = yy + 1.3 * np.sin(x * 0.09 + yy) + 0.8 * (fbm(P, 0.15, int(yy), 2) - 0.5)
        hgt -= 0.07 * np.exp(-((y - wav) / 0.6) ** 2) * ss(44.0, 20.0, ax) * ss(-10.0, 5.0, z) * (1 - s_halo)
    for ang in (-0.42, -0.1, 0.25, 0.55):
        cx, cy = HM.EYE_X + 15.5, 1.0
        dx, dy = ax - cx, y - cy
        along = dx * np.cos(ang) + dy * np.sin(ang)
        perp = -dx * np.sin(ang) + dy * np.cos(ang)
        hgt -= 0.05 * np.exp(-(perp / 0.45) ** 2) * ss(0.0, 2.0, along) * ss(14.0, 6.0, along)
    hgt -= 0.05 * np.exp(-((E['dlo'] - 3.5) / 0.6) ** 2) * ss(0.2, 0.5, E['tc']) * ss(0.95, 0.7, E['tc']) * E['near']
    for yy in (-128.0, -142.0, -158.0):
        hgt -= 0.06 * np.exp(-((y - yy - 2.0 * np.sin(x * 0.05)) / 0.9) ** 2) * ss(-70.0, -40.0, z)
    hgt += 0.045 * vn * skin_w                      # veines légèrement en relief
    hgt -= 0.035 * lips * (0.5 + 0.5 * np.sin(x * 3.4 + 2.0 * vnoise(P, 0.8, 131))) ** 3
    hgt -= 0.03 * flake * lips
    hgt += 0.012 * hairs * stub
    hgt += 0.03 * bstr * brow
    hgt += 0.02 * (vnoise(P * F(4.0), 1.0, 141) - 0.5) * c_swell     # tissu cicatriciel irrégulier

    # --- rugosité : peau sèche et cireuse, cicatrices luisantes, acier, intérieur humide
    r = np.full(n, 0.62, F)
    r -= 0.07 * np.clip(nose + ss(30.0, 60.0, y) * ss(-10.0, 10.0, z), 0, 1)
    r -= 0.06 * scalp * ss(80.0, 110.0, y)          # dessus du crâne un peu luisant
    r = r * (1 - lips) + 0.48 * lips
    r = r * (1 - stub) + 0.68 * stub
    r = r * (1 - mouth) + 0.24 * mouth
    r -= 0.3 * (E['wet_lo'] + E['wet_up'] * 0.6 + E['caruncle'])
    r = r * (1 - s_ridge) + 0.38 * s_ridge
    r = r * (1 - s_core) + 0.78 * s_core
    r = r * (1 - c_swell) + 0.42 * c_swell
    r = r * (1 - c_line) + 0.72 * c_line
    r = r * (1 - metal) + (0.3 + 0.35 * rust) * metal
    r = r * (1 - cap) + 0.9 * cap
    r += 0.04 * (fbm(P, 0.4, 141, 3) - 0.5)
    r = np.clip(r, 0.18, 0.92)

    # --- émission : sceau incandescent (plus chaud près de l'anneau, quelques points chauds), gorge
    flick = 0.72 + 0.28 * vnoise(P * F(0.35), 1.0, 451)
    hot = 0.8 + 0.2 * np.where(s_id == 0, 1.0, ss(0.9, 0.0, s_t))
    em = GLOW[None, :] * (s_core * flick * hot)[:, None]
    em += GLOW_HALO[None, :] * (np.clip(s_halo - s_core, 0, 1) * 0.22 * flick)[:, None]
    em += THROAT_GLOW[None, :] * (mouth * deep * 0.9)[:, None]

    masks = dict(lips=lips, mouth=mouth, veins=vn, seal=s_core, seal_ridge=s_ridge, scar=c_line, staples=metal,
                 stubble=stub, brow=brow, scalp=scalp, cap=cap)
    return np.clip(c, 0, 1).astype(F), hgt.astype(F), r.astype(F), np.clip(em, 0, 1).astype(F), metal.astype(F), masks
