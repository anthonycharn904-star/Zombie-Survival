"""Vocalises non verbales : source glottique (impulsions de Rosenberg, gigue, scintillement, sous-harmonique
de grognement), conduit vocal (formants qui suivent une trajectoire de voyelles, mise à l'échelle de la
taille de la créature), souffle, murmures (bruit filtré par des formants aléatoires : jamais de mots)."""
import numpy as np
from numba import njit
from .dsp import SR, secs, svf, lp, hp, bp, butter_hp, butter_lp, smooth_noise, noise, saturate

TAU = 2 * np.pi

# formants de voix d'homme (Hz) : F1..F5
VOY = {
    'a': [730, 1090, 2440, 3400, 4200], 'o': [570, 840, 2410, 3300, 4100], 'u': [300, 870, 2240, 3200, 4000],
    'e': [400, 2000, 2550, 3600, 4300], 'i': [270, 2290, 3010, 3500, 4300], 'E': [550, 1770, 2490, 3500, 4200],
    'y': [250, 1750, 2150, 3200, 4100], 'O': [450, 800, 2400, 3300, 4100], '@': [500, 1500, 2500, 3500, 4200],
    'ae': [660, 1720, 2410, 3400, 4200],
}
GAIN_F = [0.0, -5.0, -11.0, -16.0, -22.0]
LARG_F = [70.0, 90.0, 120.0, 150.0, 200.0]


def courbe(points, n, log=False):
    """Interpolation d'une liste [(t, valeur), …] sur n échantillons (lissée par cosinus)."""
    t = np.arange(n) / SR
    ts = np.array([p[0] for p in points], dtype=float)
    vs = np.array([p[1] for p in points], dtype=float)
    if log:
        vs = np.log(vs)
    out = np.empty(n)
    idx = np.searchsorted(ts, t, side='right') - 1
    idx = np.clip(idx, 0, len(ts) - 2)
    t0, t1 = ts[idx], ts[idx + 1]
    k = np.clip((t - t0) / np.maximum(t1 - t0, 1e-9), 0, 1)
    k = 0.5 - 0.5 * np.cos(np.pi * k)
    out = vs[idx] + (vs[idx + 1] - vs[idx]) * k
    out[t < ts[0]] = vs[0]
    out[t > ts[-1]] = vs[-1]
    return np.exp(out) if log else out


@njit(cache=True)
def _glotte(f0, oq, n, seed):
    """Dérivée du débit glottique (modèle de Rosenberg) ; f0 et oq par échantillon. Renvoie aussi l'ouverture."""
    np.random.seed(seed)
    out = np.empty(n)
    ouv = np.empty(n)
    ph = 0.0
    prev = 0.0
    for i in range(n):
        ph += f0[i] / 48000.0
        if ph >= 1.0:
            ph -= 1.0
        q = oq[i]
        tp = q * 0.62
        tn = q - tp
        if ph < tp:
            g = 0.5 * (1.0 - np.cos(np.pi * ph / tp))
        elif ph < tp + tn:
            g = np.cos(0.5 * np.pi * (ph - tp) / tn)
        else:
            g = 0.0
        out[i] = (g - prev) * 48000.0 / max(f0[i], 20.0) * 0.25
        prev = g
        ouv[i] = g
    return out, ouv


def formants(src, voyelles, n, echelle=1.0, ouverture=1.0):
    """Filtre la source par 5 formants qui suivent `voyelles` = [(t, 'a'), …] ; echelle < 1 = créature énorme."""
    out = np.zeros(n)
    for k in range(5):
        fc = courbe([(t, VOY[v][k] * echelle) for t, v in voyelles], n, log=True)
        larg = LARG_F[k] * (0.8 + 0.4 * echelle) * ouverture
        q = np.maximum(fc / larg, 0.7)
        out += svf(np.ascontiguousarray(src), np.ascontiguousarray(fc), np.ascontiguousarray(q), 1) * 10 ** (GAIN_F[k] / 20)
    return out


def voix(longueur, f0, voyelles, *, echelle=1.0, rauque=0.3, sous=0.0, souffle=0.15, gigue=0.012, scintil=0.12,
         oq=0.6, env=None, graine=1, inclinaison=4000.0, roule=0.0, roule_prof=0.0, roule_gigue=0.15):
    """Vocalise inhumaine. f0 = [(t, Hz), …], voyelles = [(t, 'a'), …], env = [(t, amplitude), …].
    rauque et sous acceptent aussi une courbe [(t, valeur), …] (voix qui se casse en cours de cri).
    roule (Hz) / roule_prof (0-1) : pulsation roulée « rrrr » de la gorge (grognement de chien, râle), appliquée à
    la source voisée ET au souffle ; roule_gigue = irrégularité de cette pulsation."""
    n = secs(longueur)
    rng = np.random.default_rng(graine)
    f = courbe(f0, n, log=True)
    f = f * (1 + gigue * smooth_noise(n, 35, rng.integers(1 << 30)) + 0.4 * gigue * smooth_noise(n, 6, rng.integers(1 << 30)))
    oqs = np.clip(oq + 0.08 * smooth_noise(n, 3, rng.integers(1 << 30)), 0.35, 0.85)
    src, ouv = _glotte(np.ascontiguousarray(f), np.ascontiguousarray(oqs), n, int(rng.integers(1 << 30)))
    # scintillement : amplitude qui varie d'une période à l'autre
    src *= 1 + scintil * smooth_noise(n, 60, rng.integers(1 << 30))
    # sous-harmonique (doublement de période) : grognement
    sous_c = courbe(sous, n) if isinstance(sous, (list, tuple)) else sous
    if np.max(sous_c) > 0:
        ph = np.cumsum(f / 2) / SR
        sq = np.tanh(6 * np.sin(TAU * ph))
        src *= 1 + sous_c * sq
    # rugosité : modulation d'amplitude lente et irrégulière (raclement)
    rq = courbe(rauque, n) if isinstance(rauque, (list, tuple)) else rauque
    if np.max(rq) > 0:
        am = smooth_noise(n, 45, rng.integers(1 << 30))
        src *= 1 + rq * np.tanh(1.5 * am)
    # souffle (aspiration) modulé par l'ouverture glottique
    br = hp(noise(n, rng.integers(1 << 30)), 400) * (0.35 + 0.65 * ouv)
    src = lp(src, inclinaison, 0.6) + souffle * br * 0.6
    # pulsation roulée de la gorge (après le souffle : l'air turbulent pulse avec les tissus qui battent)
    if roule > 0 and roule_prof > 0:
        fr = roule * (1 + roule_gigue * smooth_noise(n, 4, rng.integers(1 << 30)))
        php = np.cumsum(fr) / SR
        pul = (0.5 + 0.5 * np.cos(TAU * php)) ** 2.5
        src = src * ((1 - roule_prof) + roule_prof * pul / 0.34)
    out = formants(src, voyelles, n, echelle)
    if env is not None:
        out *= courbe(env, n)
    return butter_hp(out, 40)


def murmures(longueur, voix_n=3, debit=5.0, echelle=1.0, graine=7, sifflantes=0.5, stereo=False, env=None):
    """Murmures inintelligibles : bruit d'aspiration filtré par des formants qui sautent au hasard au rythme
    des syllabes, petites consonnes de bruit. Aucun mot n'est formé (aucune langue n'est modélisée)."""
    n = secs(longueur)
    rng = np.random.default_rng(graine)
    vk = list(VOY.keys())
    L = np.zeros(n); R = np.zeros(n)
    for v in range(voix_n):
        t = rng.uniform(0, 0.2); voy = []
        while t < longueur + 0.3:
            voy.append((t, vk[rng.integers(len(vk))]))
            t += rng.uniform(0.6, 1.4) / debit
        # enveloppe syllabique : bouffées de souffle
        syl = np.zeros(n)
        t = rng.uniform(0, 0.15)
        while t < longueur:
            d = rng.uniform(0.08, 0.22)
            i0, i1 = secs(t), min(n, secs(t + d))
            if i1 > i0:
                w = np.sin(np.linspace(0, np.pi, i1 - i0)) ** 1.5
                syl[i0:i1] = np.maximum(syl[i0:i1], w * rng.uniform(0.5, 1.0))
            t += d + rng.uniform(0.02, 0.18)
        src = noise(n, rng.integers(1 << 30))
        s = formants(src, voy, n, echelle * rng.uniform(0.92, 1.08), ouverture=1.6) * syl
        # consonnes (s, ch, t) : courtes bouffées aiguës
        cons = np.zeros(n)
        for _ in range(int(longueur * debit * 0.6)):
            t0 = rng.uniform(0, longueur); d = rng.uniform(0.03, 0.09)
            i0, i1 = secs(t0), min(n, secs(t0 + d))
            if i1 > i0:
                cons[i0:i1] += np.hanning(i1 - i0) * rng.uniform(0.3, 1.0)
        sib = bp(noise(n, rng.integers(1 << 30)), rng.uniform(4500, 7000), 1.5) * cons * sifflantes * 0.5
        s = s + sib
        p = rng.uniform(-0.8, 0.8) if stereo else 0.0
        a = (p + 1) * np.pi / 4
        L += s * np.cos(a); R += s * np.sin(a)
    out = np.stack([L, R]) if stereo else (L + R) * 0.7071
    if env is not None:
        out = out * courbe(env, n)
    return butter_hp(out, 120)


def rugissement(longueur, base=85.0, graine=3, cri=0.35, grave=1.0, voyelles=None, env=None, contour=None, echelle=1.0):
    """Rugissement de créature : couche grave (formants ×0,7, grognement), couche médium, cri aigu, souffle.
    echelle multiplie la taille apparente du conduit vocal (< 1 : créature plus grande ; 1 = inchangé)."""
    L = longueur
    if contour is None:
        contour = [(0, 0.82), (0.18 * L, 1.08), (0.55 * L, 1.15), (0.8 * L, 0.95), (L, 0.7)]
    if voyelles is None:
        voyelles = [(0, 'O'), (0.15 * L, 'a'), (0.6 * L, 'a'), (0.85 * L, 'o'), (L, 'u')]
    if env is None:
        env = [(0, 0.0), (0.08 * L, 0.9), (0.2 * L, 1.0), (0.7 * L, 0.85), (0.92 * L, 0.3), (L, 0.0)]
    f_g = [(t, base * k) for t, k in contour]
    f_m = [(t, base * 2.03 * k) for t, k in contour]
    f_c = [(t, base * 6.1 * (0.9 + 0.25 * k)) for t, k in contour]
    a = voix(L, f_g, voyelles, echelle=0.68 * echelle, rauque=0.55, sous=0.55, souffle=0.4, gigue=0.02, graine=graine) * grave
    b = voix(L, f_m, voyelles, echelle=0.84 * echelle, rauque=0.4, sous=0.25, souffle=0.35, gigue=0.016, graine=graine + 1) * 0.6
    c = voix(L, f_c, [(0, 'a'), (0.5 * L, 'E'), (L, 'a')], echelle=1.05 * echelle, rauque=0.3, souffle=0.5, gigue=0.02,
             env=[(0, 0), (0.12 * L, 0.0), (0.3 * L, 1.0), (0.75 * L, 0.7), (L, 0)], graine=graine + 2) * cri
    n = secs(L)
    x = a + b + c
    x = x / (np.max(np.abs(x)) + 1e-9)
    # saturation modérée AVANT l'enveloppe : la dynamique du cri est conservée
    x = saturate(x * 1.6, 1.4)
    e = courbe(env, n)
    return x * e
