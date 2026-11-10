"""Briques d'effets sonores synthétisés : bruits colorés, souffles, chocs sourds, pierre qui craque, débris,
crépitements d'énergie, scintillements, métal modal, chair, gouttes, battements de cœur, ailes, feu,
réverbération de salle sombre, boucles jointives."""
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt, resample_poly
from .dsp import (SR, secs, mtof, saw, pulse, sine, svf, lp, bp, hp, butter_hp, butter_lp, peak_eq, shelf,
                  env_adsr, env_perc, smooth_noise, noise, saturate, make_ir, pan)
from .voix import courbe

TAU = 2 * np.pi


def T(n):
    return np.arange(n) / SR


def rng_(seed):
    return np.random.default_rng(seed)


def fondu(x, debut=0.002, fin=0.01):
    """Fondus d'entrée et de sortie (évite les clics)."""
    x = np.array(x, dtype=np.float64, copy=True)
    n = x.shape[-1]
    a, b = min(n // 3, secs(debut)), min(n // 3, secs(fin))
    if a > 1:
        x[..., :a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if b > 1:
        x[..., -b:] *= np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return x


def place(buf, sig, t, gain=1.0):
    """Ajoute sig (mono ou stéréo) dans buf à l'instant t (s)."""
    i = secs(t)
    if i >= buf.shape[-1]:
        return buf
    m = min(sig.shape[-1], buf.shape[-1] - i)
    if i < 0:
        sig = sig[..., -i:]; m = min(sig.shape[-1], buf.shape[-1]); i = 0
    if buf.ndim == 2 and sig.ndim == 1:
        buf[:, i:i + m] += sig[:m] * gain
    else:
        buf[..., i:i + m] += sig[..., :m] * gain
    return buf


def env(points, n):
    return courbe(points, n)


# ───────────── bruits colorés ─────────────
def rose(n, seed=None):
    """Bruit rose (−3 dB/octave) par mise en forme spectrale."""
    w = rng_(seed).standard_normal(n)
    W = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    W[1:] /= np.sqrt(f[1:] / 20.0)
    W[0] = 0
    x = np.fft.irfft(W, n)
    return x / (np.std(x) + 1e-12)


def brun(n, seed=None):
    w = rng_(seed).standard_normal(n)
    W = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    W[1:] /= (f[1:] / 20.0)
    W[0] = 0
    x = np.fft.irfft(W, n)
    return x / (np.std(x) + 1e-12)


# ───────────── souffles et balayages ─────────────
def souffle(L, f0, f1, pic=0.5, q=1.2, seed=1, courbe_f=1.0, env_pts=None, rose_=True):
    """Souffle filtré dont le centre glisse de f0 à f1 ; enveloppe en cloche culminant à `pic` (fraction)."""
    n = secs(L); t = T(n); k = t / L
    fc = f0 * (f1 / f0) ** (k ** courbe_f)
    src = rose(n, seed) if rose_ else noise(n, seed)
    x = bp(src, fc, q) + 0.35 * lp(src, fc * 0.6, 0.7)
    if env_pts is None:
        e = np.where(k < pic, (k / pic) ** 2.2, np.exp(-((k - pic) / max(1 - pic, 1e-3)) * 4.0))
    else:
        e = env(env_pts, n)
    return fondu(x * e, 0.003, 0.02)


def passage(L, seed=1, f_haut=4500, f_bas=500, pic=0.5, largeur=0.8):
    """Passage rapide (effet Doppler) : stéréo, le centre du filtre descend après le point le plus proche."""
    n = secs(L); t = T(n); k = t / L
    fc = np.where(k < pic, f_bas + (f_haut - f_bas) * (k / pic) ** 1.5, f_haut * (f_bas / f_haut) ** ((k - pic) / (1 - pic)))
    src = rose(n, seed)
    x = bp(src, fc, 0.9) + 0.4 * lp(src, fc, 0.7)
    e = np.exp(-((k - pic) / 0.18) ** 2) * 0.85 + 0.15 * np.exp(-((k - pic) / 0.45) ** 2)
    x *= e
    p = np.tanh((k - pic) * 6) * largeur
    a = (p + 1) * np.pi / 4
    return fondu(np.stack([x * np.cos(a), x * np.sin(a)]), 0.003, 0.02)


def aspiration(L, seed=2, f0=300, f1=6000, fin_net=True):
    """Aspiration / implosion : bruit qui monte en hauteur et en intensité, coupé net à la fin."""
    n = secs(L); t = T(n); k = t / L
    fc = f0 * (f1 / f0) ** (k ** 1.7)
    src = rose(n, seed)
    x = bp(src, fc, 1.6) + 0.5 * hp(src, fc * 0.8) * k ** 3
    e = k ** 2.6
    if fin_net:
        e[-secs(0.006):] *= np.linspace(1, 0, secs(0.006))
    return x * e


# ───────────── chocs ─────────────
def chute_grave(L=1.5, f_haut=90.0, f_bas=32.0, tau=0.08, decroit=0.5):
    """Sous-grave qui plonge (impact cinématique)."""
    n = secs(L); t = T(n)
    f = f_bas + (f_haut - f_bas) * np.exp(-t / tau)
    x = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / decroit)
    return fondu(x * np.minimum(1, t / 0.0015), 0.0, 0.03)


def coup_sourd(L=0.6, f=70.0, decroit=0.12, seed=3, clic=0.4):
    """Choc sourd : sinusoïde grave amortie + claquement filtré."""
    n = secs(L); t = T(n)
    ff = f * (1 + 0.8 * np.exp(-t / 0.015))
    x = np.sin(TAU * np.cumsum(ff) / SR) * np.exp(-t / decroit)
    c = lp(noise(n, seed), 900) * np.exp(-t / 0.01) * clic
    return fondu((x + c) * np.minimum(1, t / 0.001), 0.0, 0.02)


def craquement(L=0.04, seed=4, f=2500, q=3.0):
    """Petit grain de fracture."""
    n = max(secs(L), 32); t = T(n)
    x = bp(noise(n, seed), f, q) * np.exp(-t / (L * 0.3))
    return x


def pierre_fracture(L, densite, seed=5, f_lo=700, f_hi=4500, gros=0.25, sourd=0.5):
    """Pierre qui craque : grains d'impulsions résonantes à densité variable (densite = [(t, grains/s)]),
    grondement sourd et claquements graves pour les plus gros éclats."""
    n = secs(L); r = rng_(seed)
    out = np.zeros(n)
    dens = env(densite, n)
    tcur = 0.0
    while tcur < L:
        d = dens[min(n - 1, secs(tcur))]
        if d <= 0.01:
            tcur += 0.01; continue
        tcur += r.exponential(1.0 / d)
        if tcur >= L:
            break
        f = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
        g = r.uniform(0.25, 1.0) ** 2
        lg = r.uniform(0.006, 0.03)
        grain = craquement(lg, r.integers(1 << 30), f, r.uniform(2, 8)) * g
        if r.uniform() < gros:
            gb = coup_sourd(0.15, r.uniform(100, 260), 0.035, r.integers(1 << 30), 0.8) * g * 0.8
            place(out, gb, tcur)
        place(out, grain, tcur)
    gr = lp(brun(n, seed + 1), 160) * env([(0, 0), (0.2 * L, 1), (L, 0.2)], n) * 0.08 * sourd
    return out + gr


def debris(L, nombre=30, seed=6, debut=0.0, etalement=0.8, f_lo=900, f_hi=6000, rebonds=2):
    """Débris qui tombent et rebondissent (cailloux, éclats)."""
    n = secs(L); r = rng_(seed)
    out = np.zeros(n)
    for _ in range(nombre):
        t0 = debut + r.exponential(etalement / 3)
        g = r.uniform(0.15, 1.0) ** 1.5
        f = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
        for b in range(rebonds + 1):
            if t0 >= L:
                break
            s = craquement(r.uniform(0.008, 0.025), r.integers(1 << 30), f * r.uniform(0.9, 1.15), r.uniform(3, 9))
            if f < 1800:
                s = s + coup_sourd(0.05, r.uniform(120, 300), 0.012, r.integers(1 << 30), 0.3)[:len(s)] * 0.5
            place(out, s * g, t0)
            t0 += r.uniform(0.05, 0.16) * (0.7 ** b)
            g *= 0.45
    return out


def grondement(L, seed=7, f=90, am=0.8, env_pts=None):
    """Grondement grave irrégulier (tremblement, éboulement lointain)."""
    n = secs(L)
    x = lp(brun(n, seed), f, 0.8)
    x *= 1 + am * smooth_noise(n, 6, seed + 1)
    if env_pts is not None:
        x *= env(env_pts, n)
    return fondu(x, 0.02, 0.05)


def crepitement(L, taux=40, seed=8, f_lo=1500, f_hi=9000, env_pts=None, bourdon=0.0, f_bourdon=60):
    """Crépitement électrique : décharges brèves (impulsions résonantes), bourdon de champ optionnel."""
    n = secs(L); r = rng_(seed)
    out = np.zeros(n)
    rate = env(env_pts, n) * taux if env_pts is not None else np.full(n, float(taux))
    tcur = 0.0
    while True:
        d = rate[min(n - 1, secs(tcur))]
        tcur += r.exponential(1.0 / max(d, 0.5))
        if tcur >= L:
            break
        burst = r.integers(1, 4)
        for b in range(burst):
            f = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
            s = craquement(r.uniform(0.002, 0.012), r.integers(1 << 30), f, r.uniform(1, 5)) * r.uniform(0.2, 1.0)
            place(out, s, tcur + b * r.uniform(0.002, 0.008))
    if bourdon > 0:
        t = T(n)
        bz = saw(np.full(n, float(f_bourdon)) * (1 + 0.01 * smooth_noise(n, 3, seed + 3)), 0.0)
        bz = bp(bz, 900, 0.8) * bourdon * (0.6 + 0.4 * smooth_noise(n, 12, seed + 4))
        if env_pts is not None:
            bz *= env(env_pts, n)
        out += bz
    return out


def scintillement(L, centre=3000, partiels=14, seed=9, etalement=0.6, env_pts=None, tremolo=7.0, stereo=False):
    """Scintillement magique : partiels aigus inharmoniques, trémolos indépendants, légers glissés."""
    n = secs(L); t = T(n); r = rng_(seed)
    Lc = np.zeros(n); Rc = np.zeros(n)
    for k in range(partiels):
        f = centre * np.exp(r.uniform(-etalement, etalement) * np.log(2))
        g = r.uniform(0.3, 1.0) / partiels ** 0.5
        tr = 0.5 + 0.5 * np.sin(TAU * r.uniform(0.6, 1.4) * tremolo * t + r.uniform(0, TAU))
        s = np.sin(TAU * f * (1 + 0.003 * smooth_noise(n, 2, r.integers(1 << 30))) * t + r.uniform(0, TAU)) * tr * g
        p = r.uniform(-1, 1) if stereo else 0
        a = (p + 1) * np.pi / 4
        Lc += s * np.cos(a); Rc += s * np.sin(a)
    out = np.stack([Lc, Rc]) if stereo else (Lc + Rc) * 0.7071
    if env_pts is not None:
        out = out * env(env_pts, n)
    return fondu(out, 0.01, 0.05)


def modes(L, f, rapports, amps, decroits, seed=10, frappe=0.5, f_frappe=3000, desaccord=0.002):
    """Synthèse modale générique (métal, pierre, verre)."""
    n = secs(L); t = T(n); r = rng_(seed)
    out = np.zeros(n)
    for ra, a, d in zip(rapports, amps, decroits):
        for det in (-desaccord, desaccord):
            out += a * 0.5 * np.sin(TAU * f * ra * (1 + det) * t + r.uniform(0, TAU)) * np.exp(-t / d)
    out += hp(noise(n, r.integers(1 << 30)), f_frappe) * np.exp(-t / 0.004) * frappe
    return fondu(out * np.minimum(1, t / 0.0008), 0.0, 0.02)


def metal_lame(L=1.2, f=1850, seed=11, eclat=0.6):
    """Résonance de lame (métal fin, très aigu, scintillant)."""
    return modes(L, f, [1.0, 2.32, 3.81, 5.47, 7.08, 9.3], [1.0, 0.7, 0.55, 0.4, 0.3, 0.18],
                 [0.9 * L, 0.6 * L, 0.42 * L, 0.3 * L, 0.2 * L, 0.12 * L], seed, eclat, 5000, 0.0007)


def chair(L=0.5, seed=12, mouille=0.6, grave=1.0):
    """Impact de chair : choc grave, giclée (bande résonante qui glisse), craquement."""
    n = secs(L); t = T(n); r = rng_(seed)
    thud = coup_sourd(L, r.uniform(85, 130), 0.045, r.integers(1 << 30), 0.9) * grave * 0.7
    body = lp(rose(n, r.integers(1 << 30)), 1800, 0.8) * np.exp(-t / 0.028) * 1.1      # masse molle
    fc = 1400 * np.exp(-t / 0.05) + 380
    sq = bp(noise(n, r.integers(1 << 30)), fc, 2.5) * np.exp(-t / 0.06) * mouille
    sq2 = bp(noise(n, r.integers(1 << 30)), 700 + 900 * np.exp(-t / 0.02), 4.0) * np.exp(-t / 0.03) * mouille * 0.7
    thud = thud + body
    crk = pierre_fracture(min(L, 0.12), [(0, 120), (0.12, 0)], r.integers(1 << 30), 1500, 6000, 0.0, 0.0) * 0.3
    out = thud + sq + sq2
    out[:len(crk)] += crk[:n]
    return fondu(out, 0.0, 0.03)


def goutte(f0=850, L=0.15, seed=13):
    """Goutte (bulle qui résonne en montant) + petit impact."""
    n = secs(L); t = T(n)
    f = f0 * (1 + 0.8 * np.minimum(t / 0.035, 1.0))
    x = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.028) * np.minimum(1, t / 0.0015)
    c = hp(noise(n, seed), 2500) * np.exp(-t / 0.002) * 0.3
    return fondu(x + c, 0.0, 0.01)


def battement_coeur(L, temps, seed=14, force=1.0, sourd=1.0):
    """Battements « toum-toum » : deux chocs graves étouffés par cycle (temps = débuts de cycle)."""
    n = secs(L); out = np.zeros(n); r = rng_(seed)
    for t0 in temps:
        for k, (dt, g, f) in enumerate([(0.0, 1.0, 52), (0.21, 0.75, 46)]):
            s = coup_sourd(0.32, f * r.uniform(0.97, 1.03), 0.07, r.integers(1 << 30), 0.15 * sourd)
            s = lp(s, 160)
            place(out, s * g * force, t0 + dt)
    return out


def battement_aile(L=0.6, seed=15, taille=1.0):
    """Battement d'aile membraneuse : poussée d'air grave, claquement de membrane, frémissement."""
    n = secs(L); t = T(n); r = rng_(seed)
    air = lp(rose(n, r.integers(1 << 30)), 350 * taille ** -0.5, 0.9) * env([(0, 0), (0.12 * L, 1), (0.35 * L, 0.6), (L, 0)], n) * 1.6
    k = t / L
    fc = 600 + 1200 * np.exp(-((k - 0.18) / 0.08) ** 2)
    snap = bp(rose(n, r.integers(1 << 30)), fc, 1.4) * np.exp(-((k - 0.2) / 0.06) ** 2) * 0.9
    flutter = bp(noise(n, r.integers(1 << 30)), 900, 2.0) * (0.5 + 0.5 * np.sin(TAU * 28 * t)) * np.exp(-((k - 0.3) / 0.2) ** 2) * 0.25
    return fondu(air + snap + flutter, 0.004, 0.03)


def flamme(L=1.0, seed=16, pic=0.25):
    """Embrasement : souffle grave (feu qui prend) + crépitements de braises."""
    n = secs(L); t = T(n); k = t / L
    whoom = lp(rose(n, seed), 900 * (0.4 + 0.6 * np.exp(-((k - pic) / 0.3) ** 2)), 0.9) * env([(0, 0), (pic * L, 1), (L, 0.15)], n) * 1.2
    braises = crepitement(L, 70, seed + 1, 1800, 7000, [(0, 0.2), (pic * L, 1.0), (L, 0.3)]) * 0.35
    return fondu(whoom + braises, 0.01, 0.05)


def bourdon_harmonique(L, f0, partiels=(1, 2, 3, 4, 5, 6), amps=None, seed=17, battement=0.6, souffle_=0.0, boucle=False):
    """Bourdon additif aux battements lents (cercle rituel, zones maudites). boucle=True : toutes les
    fréquences sont arrondies à un multiple de 1/L (signal exactement périodique sur L)."""
    n = secs(L); t = T(n); r = rng_(seed)
    amps = amps or [1.0 / (i + 1) for i in range(len(partiels))]
    out = np.zeros(n)
    for p, a in zip(partiels, amps):
        for det in (-battement, battement):
            f = f0 * p + det * p ** 0.5
            if boucle:
                f = round(f * L) / L
            out += a * 0.5 * np.sin(TAU * f * t + r.uniform(0, TAU))
    if souffle_ > 0:
        out += bp(rose(n, seed + 1), f0 * 4, 1.0) * souffle_
    return out


def metal_frotte(L, f=420, seed=18, env_pts=None, glisse=0.08):
    """Métal frotté (plaintes inquiétantes) : bruit excitant un banc de résonateurs inharmoniques qui glissent."""
    n = secs(L); t = T(n); r = rng_(seed)
    src = rose(n, r.integers(1 << 30)) * (0.5 + 0.5 * smooth_noise(n, 2, r.integers(1 << 30)))
    out = np.zeros(n)
    for ra in (1.0, 2.76, 5.4, 8.93):
        fc = f * ra * (1 + glisse * smooth_noise(n, 0.5, r.integers(1 << 30)))
        out += svf(np.ascontiguousarray(src), np.ascontiguousarray(fc), np.full(n, 120.0), 1) / ra ** 0.5
    if env_pts is not None:
        out *= env(env_pts, n)
    return fondu(out, 0.05, 0.1)


# ───────────── espace ─────────────
_IR = {}


def salle(x, taille=2.2, humide=0.25, predelai=0.015, seed=21, stereo_out=None, sombre=True):
    """Réverbération de salle souterraine. x mono ou stéréo ; renvoie la même forme (ou stéréo si
    stereo_out=True). La queue est ajoutée à la fin (longueur augmentée)."""
    key = (taille, predelai, seed, sombre)
    if key not in _IR:
        bands = ((0, 250, 1.3), (250, 1200, 1.0), (1200, 4000, 0.65), (4000, 20000, 0.32)) if sombre else \
                ((0, 250, 1.1), (250, 1200, 1.0), (1200, 4000, 0.85), (4000, 20000, 0.6))
        _IR[key] = make_ir(taille, predelai, bands, 10, seed, 1.0)
    ir = _IR[key]
    x = np.asarray(x, dtype=np.float64)
    st = x.ndim == 2
    if not st:
        xx = np.stack([x, x])
    else:
        xx = x
    n = xx.shape[1]
    wl = fftconvolve(xx[0], ir[0]) + 0.15 * fftconvolve(xx[1], ir[0])
    wr = fftconvolve(xx[1], ir[1]) + 0.15 * fftconvolve(xx[0], ir[1])
    m = len(wl)
    out = np.zeros((2, m))
    out[:, :n] += xx * (1 - humide * 0.3)
    out[0] += wl * humide * 0.22
    out[1] += wr * humide * 0.22
    # coupe la queue inaudible
    e = np.max(np.abs(out), axis=0)
    seuil = e.max() * 10 ** (-70 / 20)
    der = np.nonzero(e > seuil)[0]
    fin = (der[-1] + secs(0.02)) if len(der) else m
    fin = max(fin, n)
    out = out[:, :min(m, fin)]
    out = fondu(out, 0.0, 0.05)
    if stereo_out is True or (st and stereo_out is None):
        return out
    return out.mean(axis=0)


def stereo_large(x, seed=22, largeur=0.5, retard=0.012):
    """Élargit un son mono (décorrélation par retards et filtres complémentaires)."""
    n = len(x)
    d = secs(retard)
    y = np.concatenate([np.zeros(d), x[:n - d]])
    lo = butter_lp(y, 1500); hi = y - lo
    sideL = lo * 0.6 - hi * 0.6
    L = x + largeur * sideL * 0.5
    R = x - largeur * sideL * 0.5
    return np.stack([L, R])


def ajuste(x, n):
    """Tronque ou complète x (mono/stéréo) à n échantillons."""
    if x.shape[-1] >= n:
        return x[..., :n]
    pad = np.zeros(x.shape[:-1] + (n - x.shape[-1],))
    return np.concatenate([x, pad], axis=-1)


def boucle_fondue(x, L, recouvrement=0.25):
    """Rend une boucle jointive de durée L à partir d'un signal plus long (≥ L + recouvrement) : la fin est
    fondue dans le début. Loi du fondu choisie selon la corrélation (puissance constante si décorrélé)."""
    n = secs(L); m = secs(recouvrement)
    x = np.asarray(x, dtype=np.float64)
    assert x.shape[-1] >= n + m, 'signal trop court pour la boucle'
    tete = x[..., :m].copy(); queue = x[..., n:n + m].copy()
    a = tete.ravel(); b = queue.ravel()
    corr = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
    k = np.linspace(0, 1, m)
    if corr > 0.5:
        fi, fo = k, 1 - k
    else:
        fi, fo = np.sin(k * np.pi / 2), np.cos(k * np.pi / 2)
    out = x[..., :n].copy()
    out[..., :m] = tete * fi + queue * fo
    return out


def boucle_circulaire(x, L):
    """Replie tout ce qui dépasse L au début (addition modulo L) : pour des évènements + réverbération."""
    n = secs(L)
    x = np.asarray(x, dtype=np.float64)
    out = np.zeros(x.shape[:-1] + (n,))
    for i in range(0, x.shape[-1], n):
        seg = x[..., i:i + n]
        out[..., :seg.shape[-1]] += seg
    return out


def bruit_periodique(n, forme, seed=None):
    """Bruit exactement périodique sur n échantillons (boucle parfaite) : spectre aléatoire de module
    forme(f) (fonction numpy des fréquences en Hz), synthétisé par FFT inverse."""
    r = rng_(seed)
    f = np.fft.rfftfreq(n, 1 / SR)
    mag = forme(np.maximum(f, 1e-3))
    mag[0] = 0
    ph = r.uniform(0, TAU, len(f))
    X = mag * np.exp(1j * ph)
    x = np.fft.irfft(X, n)
    return x / (np.std(x) + 1e-12)


def bande(lo, hi, pente=2.0):
    """Forme spectrale passe-bande douce (pour bruit_periodique)."""
    def f(fr):
        return 1.0 / np.sqrt(1 + (lo / fr) ** (2 * pente)) / np.sqrt(1 + (fr / hi) ** (2 * pente)) / np.sqrt(fr / 100.0)
    return f


def frequence_boucle(f, L):
    """Arrondit une fréquence au multiple de 1/L le plus proche (sinusoïde parfaitement périodique)."""
    return round(f * L) / L


def sinus_boucle(L, f, phase=0.0):
    n = secs(L)
    return np.sin(TAU * frequence_boucle(f, L) * np.arange(n) / SR + phase)


def am_boucle(L, cycles, profondeur=0.5, phase=0.0, forme=1.0):
    """Modulation d'amplitude périodique (nombre entier de cycles sur L)."""
    n = secs(L)
    m = 0.5 + 0.5 * np.sin(TAU * cycles * np.arange(n) / n + phase)
    return 1 - profondeur + profondeur * m ** forme


def impact_lourd(L=1.5, seed=30, sub=(110.0, 32.0), g_sub=0.65, punch=135.0, g_punch=1.0, crunch=0.6, eclat=0.5,
                 crunch_lo=500, crunch_hi=4500, dec_sub=0.38):
    """Impact équilibré : sous-grave qui plonge (cinéma), « coup » médium audible sur petits haut-parleurs
    (membrane 110-180 Hz + bruit 200-900 Hz), craquement 0,5-4,5 kHz, éclat aigu bref."""
    n = secs(L); t = T(n); r = rng_(seed)
    out = chute_grave(L, sub[0], sub[1], 0.06, dec_sub) * g_sub
    f = punch * (1 + 1.2 * np.exp(-t / 0.012))
    memb = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.075)
    nz = bp(rose(n, r.integers(1 << 30)), 420, 0.6) * np.exp(-t / 0.05) * 1.3
    out += np.tanh((memb + nz) * 1.6) * g_punch
    cr = pierre_fracture(min(L, 0.35), [(0, 900), (0.12, 300), (0.35, 0)], r.integers(1 << 30), crunch_lo, crunch_hi, 0.3, 0.0)
    out[:len(cr)] += cr * crunch * 1.6
    ec = hp(noise(secs(0.03), r.integers(1 << 30)), 3500) * np.exp(-np.arange(secs(0.03)) / SR / 0.004)
    out[:len(ec)] += ec * eclat
    return fondu(out * np.minimum(1, t / 0.0008), 0.0, 0.05)


def circulaire(fn, x):
    """Applique un traitement à mémoire (filtre, saturation suréchantillonnée) à un signal de boucle sans
    créer de discontinuité : traite 3 copies jointes et garde celle du milieu."""
    n = x.shape[-1]
    y = fn(np.concatenate([x, x, x], axis=-1))
    return y[..., n:2 * n]



# ───────────── chiens zombies (v1.2) ─────────────
def gargouillis(L, densite=25.0, seed=40, f_lo=220.0, f_hi=750.0, env_pts=None):
    """Gargouillis d'une gorge pourrie : petites bulles qui éclatent (sinusoïdes amorties dont la hauteur monte)
    et clapotis brefs ; densite = bulles par seconde (multipliée par la courbe env_pts si elle est donnée)."""
    n = secs(L); r = rng_(seed); out = np.zeros(n)
    dens = env(env_pts, n) * densite if env_pts is not None else np.full(n, float(densite))
    t = 0.0
    while True:
        t += r.exponential(1.0 / max(dens[min(n - 1, secs(t))], 0.5))
        if t >= L:
            break
        f0 = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
        d = r.uniform(0.01, 0.03)
        m = secs(d); tt = np.arange(m) / SR
        f = f0 * (1 + r.uniform(0.4, 1.0) * np.minimum(tt / d, 1.0))
        b = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-tt / (d * 0.35)) * np.minimum(1, tt / 0.0015)
        cl = bp(noise(m, r.integers(1 << 30)), min(f0 * 3, 6000), 2.0) * np.exp(-tt / 0.002) * 0.3
        place(out, (b + cl) * r.uniform(0.3, 1.0), t)
    return out


def claquement_dents(seed=50, f=2300.0, sec=1.0, L=0.12):
    """Choc de crocs : contact très bref qui excite des modes durs et très amortis (émail, os), « toc » de la
    cavité buccale, et un peu de poids (mâchoire)."""
    n = secs(L); t = T(n); r = rng_(seed)
    email = modes(L, f, [1.0, 1.63, 2.37, 3.11, 4.2], [1.0, 0.7, 0.55, 0.35, 0.2],
                  [0.022, 0.016, 0.011, 0.008, 0.006], r.integers(1 << 30), 0.0, 6000, 0.004)
    contact = hp(noise(n, r.integers(1 << 30)), 2000) * np.exp(-t / 0.0012) * 0.7
    toc = bp(noise(n, r.integers(1 << 30)), r.uniform(650, 900), 2.5) * np.exp(-t / 0.015)
    poids = np.sin(TAU * np.cumsum(170 * (1 + 0.6 * np.exp(-t / 0.004))) / SR) * np.exp(-t / 0.022)
    x = email * 0.6 + contact * 0.9 + toc * 0.8 + poids * 0.5 * sec
    return fondu(x * np.minimum(1, t / 0.0003), 0.0, 0.02)


def os_cliquetis(L=0.5, nombre=6, seed=60, f_lo=650.0, f_hi=1700.0):
    """Os secs qui s'entrechoquent et rebondissent (carcasse décharnée qui tombe)."""
    n = secs(L); r = rng_(seed); out = np.zeros(n)
    t0 = 0.0
    for k in range(nombre):
        f = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
        c = modes(0.12, f, [1.0, 2.71, 5.15], [1.0, 0.45, 0.2], [0.035, 0.016, 0.008], r.integers(1 << 30), 0.5, 3500, 0.003)
        place(out, c * r.uniform(0.4, 1.0) * 0.8 ** k, t0)
        t0 += r.uniform(0.02, 0.09) * 0.85 ** k
    return out


def place_circulaire(buf, sig, t, gain=1.0):
    """Ajoute sig dans buf à l'instant t en repliant ce qui dépasse la fin au début (boucle exacte)."""
    n = buf.shape[-1]
    i = secs(t) % n
    k = 0
    while k < sig.shape[-1]:
        j = (i + k) % n
        m = min(sig.shape[-1] - k, n - j)
        buf[..., j:j + m] += sig[..., k:k + m] * gain
        k += m
    return buf


# ───────────── cuves et mini-boss (v1.3) ─────────────
def bulle(f0=180.0, d=0.06, montee=0.6, seed=70, eclat=0.2):
    """Une bulle (ou un « gloup ») : sinusoïde amortie dont la hauteur monte, petit claquement à l'éclatement."""
    r = rng_(seed); m = max(secs(d), 64); tt = np.arange(m) / SR
    f = f0 * (1 + montee * np.minimum(tt / d, 1.0))
    b = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-tt / (d * 0.4)) * np.minimum(1, tt / 0.002)
    cl = bp(noise(m, r.integers(1 << 30)), min(f0 * 4, 7000), 2.0) * np.exp(-tt / 0.003) * eclat
    return b + cl


def verre(L=1.0, f=1150.0, seed=71, frappe=0.8, amort=1.0):
    """Résonance de verre épais (cylindre) : modes inharmoniques brillants, battements, attaque cristalline."""
    return modes(L, f, [1.0, 1.73, 2.61, 3.42, 4.67, 6.15, 7.9], [1.0, 0.8, 0.6, 0.5, 0.35, 0.25, 0.15],
                 [0.55 * amort, 0.38 * amort, 0.28 * amort, 0.2 * amort, 0.13 * amort, 0.09 * amort, 0.06 * amort],
                 seed, frappe, 5000, 0.0015)


def tessons(L, nombre=40, seed=72, debut=0.0, etalement=0.9, f_lo=2200.0, f_hi=8500.0, rebonds=2):
    """Tessons de verre qui tombent et tintent : petits modes très aigus, rebonds qui s'amortissent."""
    n = secs(L); r = rng_(seed); out = np.zeros(n)
    for _ in range(nombre):
        t0 = debut + r.exponential(etalement / 3)
        g = r.uniform(0.15, 1.0) ** 1.6
        f = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
        for b in range(rebonds + 1):
            if t0 >= L:
                break
            d = r.uniform(0.04, 0.16)
            s = modes(d, f * r.uniform(0.97, 1.03), [1.0, 1.58, 2.34], [1.0, 0.6, 0.35], [d * 0.45, d * 0.3, d * 0.2],
                      r.integers(1 << 30), 0.6, 6000, 0.002)
            place(out, s * g, t0)
            t0 += r.uniform(0.04, 0.14) * 0.7 ** b
            g *= 0.4
    return out


def arc_electrique(L, seed=73, f_bz=100.0, centre=3200.0, env_pts=None, siffle=None):
    """Arc électrique : bruit large bande haché à la fréquence du secteur (et ses irrégularités), bourdon saturé,
    sifflement optionnel siffle = [(t, Hz), …]."""
    n = secs(L); t = T(n); r = rng_(seed)
    gate = (0.5 + 0.5 * np.sin(TAU * f_bz * t * (1 + 0.02 * smooth_noise(n, 8, r.integers(1 << 30))))) ** 3
    gate = 0.25 + 0.75 * gate * (0.6 + 0.4 * (smooth_noise(n, 40, r.integers(1 << 30)) > 0))
    nz = bp(noise(n, r.integers(1 << 30)), centre * (1 + 0.3 * smooth_noise(n, 12, r.integers(1 << 30))), 0.7) + \
        0.5 * hp(noise(n, r.integers(1 << 30)), 6000)
    bz = saturate(saw(np.full(n, f_bz * 1.5), 0.0) * 0.8, 3.0)
    out = nz * gate + 0.35 * bp(bz, 1200, 0.6)
    if siffle is not None:
        fs = env(siffle, n)
        out += np.sin(TAU * np.cumsum(fs) / SR) * 0.18
    if env_pts is not None:
        out *= env(env_pts, n)
    return out


def tic_geiger(seed=74, g=1.0, dec=0.006, fres=2200.0, corps=1.5, ecretage=3.0):
    """Un « tic » de compteur Geiger : impulsion sèche qui fait sonner le petit haut-parleur (résonance ≈ 1,8–2,8 kHz,
    corps ≈ 1,2 kHz), écrêtée doucement : moins d'aiguille pour la même netteté (sinon le crépitement n'a pas de sonie)."""
    r = rng_(seed); m = secs(0.02); tt = np.arange(m) / SR
    imp = np.zeros(m); imp[0] = 1.0; imp[1] = -0.6
    x = bp(imp, r.uniform(fres * 0.8, fres * 1.25), 2.2) * 6 + hp(imp, 5000) * 2.5 + lp(imp, 900) * 1.5 + bp(imp, 1200, 3.0) * 4 * corps
    x = x * np.exp(-tt / dec)
    x = np.tanh(x / np.max(np.abs(x)) * ecretage) / np.tanh(ecretage)
    return x * g


def friture(L, densite=300.0, seed=75, f_lo=2500.0, f_hi=9000.0, env_pts=None):
    """Grésillement d'acide qui ronge (friture) : nuée de micro-éclatements très brefs."""
    n = secs(L); r = rng_(seed); out = np.zeros(n)
    dens = env(env_pts, n) * densite if env_pts is not None else np.full(n, float(densite))
    t = 0.0
    while True:
        t += r.exponential(1.0 / max(dens[min(n - 1, secs(t))], 1.0))
        if t >= L:
            break
        m = secs(r.uniform(0.0006, 0.003))
        if m < 8:
            continue
        tt = np.arange(m) / SR
        s = bp(noise(m, r.integers(1 << 30)), np.exp(r.uniform(np.log(f_lo), np.log(f_hi))), r.uniform(1, 4)) * np.exp(-tt / (m / SR * 0.35))
        place(out, s * r.uniform(0.1, 1.0) ** 2, t)
    return out


# ───────────── v1.4 : chaînes, tendons, pas, flanger ─────────────
def maillon(seed=80, f=2600.0, g=1.0, dec=0.035):
    """Choc d'un maillon de chaîne : contact sec + modes d'un anneau d'acier (aigus, brefs)."""
    r = rng_(seed)
    return modes(dec * 3, f * r.uniform(0.85, 1.15), [1.0, 1.52, 2.31, 3.08, 4.4], [1.0, 0.7, 0.5, 0.3, 0.15],
                 [dec, dec * 0.75, dec * 0.55, dec * 0.4, dec * 0.3], r.integers(1 << 30), 0.9, 5000, 0.004) * g


def chaine(L, densite_pts, seed=81, f_lo=1800.0, f_hi=4200.0, dec=0.03, gain_pts=None):
    """Chaîne qui cliquette : chocs de maillons à la densité donnée (chocs/s, courbe [(t, d)]), parfois doublés."""
    n = secs(L); r = rng_(seed); out = np.zeros(n)
    dens = env(densite_pts, n); gn = env(gain_pts, n) if gain_pts is not None else np.ones(n)
    t = 0.0
    while True:
        t += r.exponential(1.0 / max(dens[min(n - 1, secs(t))], 0.5))
        if t >= L:
            break
        g = gn[min(n - 1, secs(t))] * r.uniform(0.3, 1.0) ** 1.5
        f = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
        place(out, maillon(int(r.integers(1 << 30)), f, g, dec * r.uniform(0.7, 1.3)), t)
        if r.uniform() < 0.25:
            place(out, maillon(int(r.integers(1 << 30)), f * r.uniform(0.9, 1.1), g * 0.6, dec), t + r.uniform(0.003, 0.009))
    return out


def grincement(L, seed=82, periode=(0.012, 0.03), resonances=(420.0, 950.0, 1650.0), q=9.0, env_pts=None, mouille=0.3):
    """Grincement par adhérence-glissement (tendon tiré, corde, cuir) : impulsions à période irrégulière qui font
    sonner quelques résonances ; mouille ajoute un léger bruit humide."""
    n = secs(L); r = rng_(seed); imp = np.zeros(n)
    p_bas, p_haut = periode
    lent = smooth_noise(n, 3, r.integers(1 << 30))
    t = 0.0
    while t < L:
        i = secs(t)
        if i >= n:
            break
        imp[i] += r.uniform(0.5, 1.0)
        k = 0.5 + 0.5 * np.tanh(lent[min(n - 1, i)])
        t += (p_bas + (p_haut - p_bas) * k) * r.uniform(0.85, 1.15)
    out = np.zeros(n)
    for j, fc in enumerate(resonances):
        out += bp(imp, fc * r.uniform(0.95, 1.05), q) / (1 + 0.5 * j)
    out += bp(noise(n, r.integers(1 << 30)), 1800, 1.0) * mouille * 0.05
    if env_pts is not None:
        out *= env(env_pts, n)
    return fondu(out, 0.005, 0.02)


def pas_lourd(seed=83, g=1.0, traine=False):
    """Pas lourd et sourd (ou pied qui traîne) sur la pierre."""
    r = rng_(seed)
    if traine:
        m = secs(0.28); tt = np.arange(m) / SR
        fr = bp(rose(m, r.integers(1 << 30)), 700 + 300 * tt / 0.28, 1.2) * env([(0, 0), (0.04, 1.0), (0.2, 0.6), (0.28, 0)], m)
        return (fr * 0.35 + debris(0.28, 6, r.integers(1 << 30), 0.02, 0.15, 900, 3500, 0) * 0.3 +
                ajuste(coup_sourd(0.2, r.uniform(80, 100), 0.04, r.integers(1 << 30), 0.3), m) * 0.4) * g
    x = coup_sourd(0.35, r.uniform(55, 70), 0.07, r.integers(1 << 30), 0.5)
    x = x + ajuste(lp(rose(secs(0.1), r.integers(1 << 30)), 600, 0.8) * np.exp(-np.arange(secs(0.1)) / SR / 0.02), len(x)) * 0.5
    x = x + ajuste(debris(0.3, 5, r.integers(1 << 30), 0.01, 0.1, 800, 3000, 0) * 0.25, len(x))
    return x * g


def flanger(x, d_min=0.002, d_max=0.008, cycles=1.0, melange=0.7, boucle=False):
    """Filtre en peigne qui glisse (fantomatique). boucle=True : retard circulaire et nombre entier de cycles."""
    x = np.asarray(x, dtype=np.float64); n = x.shape[-1]
    t = np.arange(n)
    d = (d_min + (d_max - d_min) * (0.5 - 0.5 * np.cos(TAU * cycles * t / n))) * SR
    pos = t - d
    if boucle:
        pos = np.mod(pos, n)
        i0 = np.floor(pos).astype(int); fr = pos - i0; i1 = (i0 + 1) % n
    else:
        pos = np.clip(pos, 0, n - 1)
        i0 = np.floor(pos).astype(int); fr = pos - i0; i1 = np.minimum(i0 + 1, n - 1)
    retard = x[..., i0] * (1 - fr) + x[..., i1] * fr
    return (x + melange * retard) / (1 + melange)
