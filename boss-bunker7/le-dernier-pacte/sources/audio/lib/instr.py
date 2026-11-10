"""Instruments synthétisés : tambours de guerre, impacts, enclume, cloche, cordes, cuivres, chœur,
boîte à musique, guitare saturée, bourdon, montée de bruit, cymbales. Chaque fonction renvoie un signal
mono ou stéréo (numpy) à 48 kHz."""
import numpy as np
from .dsp import (SR, secs, mtof, saw, pulse, sine, svf, lp, bp, hp, butter_hp, butter_lp, peak_eq, shelf,
                  env_adsr, env_perc, smooth_noise, noise, karplus, saturate, pan, RNG)

TAU = 2 * np.pi


def _fade_end(x, ms=30):
    f = min(len(x) // 4, secs(ms / 1000))
    if f > 1:
        x = x.copy(); x[-f:] *= np.linspace(1, 0, f) ** 2
    return x


def _tailsafe(fn):
    def w(*a, **k):
        return _fade_end(fn(*a, **k))
    w.__name__ = fn.__name__; w.__doc__ = fn.__doc__
    return w


def _t(n):
    return np.arange(n) / SR


# ───────────── percussions ─────────────
@_tailsafe
def taiko(f0=58.0, vel=1.0, length=1.6, seed=None):
    """Grand tambour de guerre : membrane qui chute en hauteur, modes de peau, frappe."""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    f0 = f0 * (1 + rng.uniform(-0.02, 0.02))
    out = np.zeros(n)
    for ratio, amp, dec in [(1.0, 1.0, 0.42), (1.59, 0.2, 0.14), (2.14, 0.12, 0.09), (2.65, 0.07, 0.06)]:
        f = f0 * ratio * (1 + 1.1 * np.exp(-t / 0.022))
        out += amp * np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / (dec * (0.7 + 0.5 * vel)))
    hit = noise(n, rng.integers(1 << 30)) * np.exp(-t / 0.012)
    out += 0.45 * bp(hit, 1400, 0.8) + 0.75 * lp(hit, 220) + 0.25 * lp(noise(n, rng.integers(1 << 30)), 300) * np.exp(-t / 0.09)   # peau : moins de hauteur, plus de souffle
    out *= np.minimum(1, t / 0.0015)
    return np.tanh(out * (0.8 + 0.6 * vel)) * vel


def tom(f0=110.0, vel=1.0, seed=None):
    return taiko(f0, vel, 0.9, seed) * 0.8


@_tailsafe
def snare(vel=1.0, length=0.35, seed=None):
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    tone = np.sin(TAU * np.cumsum(185 * (1 + 0.4 * np.exp(-t / 0.01))) / SR) * np.exp(-t / 0.05)
    nz = bp(noise(n, rng.integers(1 << 30)), 4200, 0.6) * np.exp(-t / 0.11)
    return (0.5 * tone + 0.9 * nz) * vel * np.minimum(1, t / 0.0008)


@_tailsafe
def boom(f_end=38.0, length=3.2, vel=1.0):
    """Impact cinématique : sous-grave qui plonge, craquement, distorsion."""
    n = secs(length); t = _t(n)
    f = f_end * (1 + 1.6 * np.exp(-t / 0.06))
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    crack = hp(noise(n, 11), 2500) * np.exp(-t / 0.03) * 0.5
    thump = lp(noise(n, 12), 120) * np.exp(-t / 0.08) * 1.5
    s = body * 1.2 + crack + thump
    s = np.tanh(s * 1.8) * 0.8
    return s * vel * np.minimum(1, t / 0.001)


@_tailsafe
def anvil(f=820.0, vel=1.0, length=2.2, seed=None):
    """Enclume / barre métallique : modes inharmoniques d'une barre libre."""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    out = np.zeros(n)
    for ratio, amp, dec in [(1.0, 1.0, 1.1), (2.756, 0.6, 0.65), (5.404, 0.42, 0.38), (8.933, 0.26, 0.22), (13.34, 0.14, 0.12)]:
        for det in (-0.6, 0.6):
            ff = f * ratio + det * ratio
            out += amp * 0.5 * np.sin(TAU * ff * t + rng.uniform(0, TAU)) * np.exp(-t / dec)
    strike = hp(noise(n, rng.integers(1 << 30)), 2500) * np.exp(-t / 0.004)
    out += strike * 0.8
    return out * vel * 0.6


@_tailsafe
def crash(vel=1.0, length=3.0, seed=None):
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    nz = noise(n, rng.integers(1 << 30))
    s = hp(nz, 3800, 0.7) * (0.6 * np.exp(-t / 0.08) + 0.4 * np.exp(-t / 1.1))
    ring = np.zeros(n)
    for fr in rng.uniform(3000, 9000, 14):
        ring += np.sin(TAU * fr * t + rng.uniform(0, TAU)) * np.exp(-t / rng.uniform(0.4, 1.4))
    s += ring * 0.012
    return s * vel * 0.5 * np.minimum(1, t / 0.0006)


def reverse_cymbal(length=1.6):
    return crash(1.0, length, seed=99)[::-1] * np.linspace(0.2, 1, secs(length)) ** 2


@_tailsafe
def bell(nominal_hz=147.0, vel=1.0, length=7.0, seed=None):
    """Cloche d'église : bourdon (hum), fondamentale, tierce mineure (sombre), quinte, nominale…"""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    partials = [(0.5, 0.85, 7.0), (1.0, 0.55, 4.6), (1.2, 0.62, 3.8), (1.5, 0.3, 2.6), (2.0, 1.0, 2.8),
                (2.5, 0.3, 1.5), (2.67, 0.28, 1.3), (3.0, 0.22, 1.0), (4.0, 0.18, 0.7), (5.33, 0.1, 0.45)]
    out = np.zeros(n)
    base = nominal_hz / 2.0
    for ratio, amp, dec in partials:
        ff = base * ratio * 2  # ratio relatif à la nominale / 2
        for det in (-0.35, 0.35):   # battements lents (cloche réelle)
            out += amp * 0.5 * np.sin(TAU * (ff / 2 + det) * t * 1.0 + rng.uniform(0, TAU)) * np.exp(-t / dec)
    strike = bp(noise(n, rng.integers(1 << 30)), 2200, 0.7) * np.exp(-t / 0.01)
    out += strike * 0.5
    return out * vel * 0.5 * np.minimum(1, t / 0.002)


# ───────────── instruments tenus ─────────────
def _vibrato(n, rate=5.3, depth=0.0025, delay=0.25, seed=None):
    t = _t(n)
    ramp = np.clip((t - delay) / 0.4, 0, 1)
    rng = np.random.default_rng(seed)
    return 1 + depth * ramp * np.sin(TAU * rate * t + rng.uniform(0, TAU)) + 0.0012 * smooth_noise(n, 1.5, rng.integers(1 << 30))


@_tailsafe
def strings(midi, length, style='sustain', vel=0.8, voices=6, attack=None, seed=None):
    """Ensemble de cordes : dents de scie désaccordées, archet (bruit), corps (égalisation)."""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    f0 = float(mtof(midi))
    out = np.zeros(n)
    for v in range(voices):
        det = 1 + rng.uniform(-0.0045, 0.0045)
        vib = _vibrato(n, rng.uniform(4.8, 5.8), 0.0028 if style == 'sustain' else 0.0, 0.2, rng.integers(1 << 30))
        out += saw(np.ascontiguousarray(f0 * det * vib), rng.uniform())
    out /= voices
    if style == 'spiccato':
        env = env_perc(n, 0.006, 0.16 * (0.8 + vel * 0.4))
        bright = 900 + 3500 * env * vel
    else:
        a = attack if attack is not None else 0.35
        env = env_adsr(n, a, 1.0, 0.9, 0.35)
        bright = 1400 + 2600 * vel * np.minimum(1, t / (a + 0.2))
    out = lp(out, bright, 0.8)
    out = peak_eq(out, 280, 3, 0.9)
    out = peak_eq(out, 2500, 2, 1.2)
    bow = bp(noise(n, rng.integers(1 << 30)), 4500, 0.5) * 0.04
    out = (out + bow) * env * vel
    return butter_hp(out, 45)


@_tailsafe
def brass(midi, length, vel=0.9, voices=4, attack=0.06, release=0.4, drive=0.0, seed=None):
    """Section de cuivres : attaque cuivrée (le filtre s'ouvre), glissé d'attaque, vibrato tardif, souffle."""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    f0 = float(mtof(midi))
    out = np.zeros(n)
    scoop = 1 - 0.017 * np.exp(-t / 0.05)
    for v in range(voices):
        det = 1 + rng.uniform(-0.003, 0.003)
        vib = _vibrato(n, rng.uniform(4.6, 5.4), 0.0022, 0.45, rng.integers(1 << 30))
        out += saw(np.ascontiguousarray(f0 * det * vib * scoop), rng.uniform())
    out /= voices
    env = env_adsr(n, attack, 0.6, 0.82, release)
    # brillance : l'ouverture du filtre suit l'intensité (timbre cuivré)
    bright = f0 * (2.5 + (5 + 9 * vel) * np.minimum(1, t / (attack * 1.6))) * (0.85 + 0.15 * env)
    out = lp(out, np.minimum(bright, 9000), 1.1)
    out = peak_eq(out, 1150, 3.5, 1.0)
    out = peak_eq(out, 3200, -3, 1.0)
    breath = bp(noise(n, rng.integers(1 << 30)), 1800, 0.8) * np.exp(-t / 0.05) * 0.08
    out = (out + breath) * env * vel
    if drive > 0:
        out = saturate(out, drive)
    return butter_hp(out, 35)


# formants de voyelles (voix d'hommes) : fréquences, gains (dB), largeurs
VOWELS = {
    'a': [(730, 0, 80), (1090, -5, 90), (2440, -12, 120), (3400, -20, 140)],
    'o': [(570, 0, 70), (840, -6, 80), (2410, -16, 110), (3300, -24, 130)],
    'u': [(300, 0, 60), (870, -10, 80), (2240, -22, 110), (3200, -30, 120)],
    'e': [(530, 0, 70), (1840, -8, 90), (2480, -12, 110), (3500, -20, 130)],
}


@_tailsafe
def choir(midi, length, vowel='a', vel=0.8, voices=8, attack=0.45, release=0.8, vowel_end=None, seed=None):
    """Chœur : source glottique (impulsions) × voix désaccordées × filtres de formants (voyelle)."""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    f0 = float(mtof(midi))
    src = np.zeros(n)
    for v in range(voices):
        det = 1 + rng.uniform(-0.006, 0.006)
        drift = 1 + 0.0035 * smooth_noise(n, 0.7, rng.integers(1 << 30))
        vib = _vibrato(n, rng.uniform(4.6, 5.6), 0.004, 0.3, rng.integers(1 << 30))
        s = pulse(np.ascontiguousarray(f0 * det * drift * vib), 0.18, rng.uniform())
        src += s
    src /= voices
    src = lp(src, 5000, 0.6)
    src += bp(noise(n, rng.integers(1 << 30)), 2500, 0.5) * 0.04   # souffle
    F0 = VOWELS[vowel]; F1 = VOWELS[vowel_end] if vowel_end else F0
    k = np.clip(t / max(length * 0.8, 1e-3), 0, 1)
    out = np.zeros(n)
    for (fa, ga, wa), (fb, gb, wb) in zip(F0, F1):
        fc = fa + (fb - fa) * k
        q = fc / (wa + (wb - wa) * k)
        g = 10 ** ((ga + (gb - ga) * k) / 20)
        out += svf(np.ascontiguousarray(src), np.ascontiguousarray(fc), np.ascontiguousarray(q), 1) * g
    env = env_adsr(n, attack, 1.5, 0.92, release)
    return butter_hp(out * env * vel * 2.2, 70)


@_tailsafe
def musicbox(midi, vel=0.7, length=2.4, wow=0.004, seed=None):
    """Lame de boîte à musique : partiels inharmoniques, attaque nette, pleurage (vieux mécanisme)."""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    f0 = float(mtof(midi))
    w = 1 + wow * np.sin(TAU * 3.7 * t + rng.uniform(0, TAU)) + 0.002 * smooth_noise(n, 3, rng.integers(1 << 30))
    out = np.zeros(n)
    for ratio, amp, dec in [(1.0, 1.0, 1.4), (2.0, 0.12, 0.6), (4.05, 0.3, 0.35), (6.3, 0.16, 0.2), (9.1, 0.07, 0.1)]:
        for det in (0.0, 0.0009):
            out += amp * 0.5 * sine(f0 * ratio * (1 + det) * w, rng.uniform()) * np.exp(-t / dec)
    click = hp(noise(n, rng.integers(1 << 30)), 6000) * np.exp(-t / 0.002) * 0.3
    return (out + click) * vel * np.minimum(1, t / 0.0008) * 0.4


@_tailsafe
def guitar(midis, length, mute=False, vel=0.9, seed=None, drive=14.0):
    """Guitare saturée : cordes de Karplus-Strong (accord de puissance), étouffement, ampli et baffle."""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    raw = np.zeros(n)
    for i, m in enumerate(midis):
        f = float(mtof(m)) * (1 + rng.uniform(-0.0015, 0.0015))
        d = 0.93 if mute else 0.9985
        s = karplus(f, n, d, 0.55 if mute else 0.8, int(rng.integers(1 << 30)))
        delay = secs(0.004 * i + rng.uniform(0, 0.003))   # balayage du médiator
        s = np.concatenate([np.zeros(delay), s[:n - delay]])
        raw += s
    if mute:
        raw *= env_perc(n, 0.001, 0.09)
    else:
        raw *= env_adsr(n, 0.002, 0.8, 0.6, 0.25)
    x = peak_eq(raw, 800, 6, 0.7)
    x = butter_hp(x, 80)
    x = saturate(x * vel, drive, 0.08)
    # baffle 4 × 12" : coupe au-dessus de 5 kHz, creux médium, présence
    x = butter_lp(x, 5200, 4)
    x = peak_eq(x, 420, -4, 0.9)
    x = peak_eq(x, 1700, 3, 1.1)
    x = butter_hp(x, 90)
    return x * 0.35


@_tailsafe
def drone(midi, length, vel=0.6, seed=None):
    """Bourdon grave : dents de scie désaccordées, filtre qui respire, sous-basse, vent."""
    rng = np.random.default_rng(seed)
    n = secs(length); t = _t(n)
    f0 = float(mtof(midi))
    out = np.zeros(n)
    for det in (-0.006, -0.002, 0.003, 0.007):
        out += saw(np.ascontiguousarray(np.full(n, f0 * (1 + det))), rng.uniform())
    out /= 4
    cut = 220 + 380 * (0.5 + 0.5 * np.sin(TAU * 0.13 * t + 1.0)) + 200 * smooth_noise(n, 0.4, 3)
    out = lp(out, np.maximum(cut, 120), 1.6)
    out += 0.3 * np.sin(TAU * f0 / 2 * t)
    wind = bp(noise(n, rng.integers(1 << 30)), 600 + 400 * np.sin(TAU * 0.07 * t), 2.0) * 0.18
    env = env_adsr(n, length * 0.35, 1.0, 1.0, length * 0.3)
    return (out + wind) * env * vel


@_tailsafe
def riser(length, f_from=300.0, f_to=7000.0, vel=0.8, seed=None):
    """Montée : bruit filtré qui grimpe, crescendo."""
    n = secs(length); t = _t(n)
    k = t / length
    fc = f_from * (f_to / f_from) ** (k ** 1.6)
    s = bp(noise(n, seed), fc, 2.5) * (k ** 2.2)
    s2 = hp(noise(n, (seed or 0) + 1), 6000) * (k ** 4) * 0.3
    return (s + s2) * vel


@_tailsafe
def snare_roll(length, vel_from=0.15, vel_to=1.0, rate=16.0, seed=None):
    rng = np.random.default_rng(seed)
    n = secs(length)
    out = np.zeros(n + secs(0.4))
    count = int(length * rate)
    for i in range(count):
        k = i / max(count - 1, 1)
        v = vel_from + (vel_to - vel_from) * k ** 1.5
        s = snare(v * rng.uniform(0.85, 1.0), 0.3, rng.integers(1 << 30))
        j = secs(i / rate)
        out[j:j + len(s)] += s
    return out[:n + secs(0.3)]


@_tailsafe
def braam(midis, length, vel=1.0, seed=None):
    """« Braam » : cuivres graves saturés + sous-basse, l'impact final."""
    out = None
    for i, m in enumerate(midis):
        b = brass(m, length, vel, voices=5, attack=0.035, release=1.2, drive=3.2, seed=(seed or 0) + i)
        out = b if out is None else out + b
    n = out.shape[-1]; t = _t(n)
    sub = np.sin(TAU * float(mtof(midis[0])) / 2 * t) * env_adsr(n, 0.02, 1.4, 0.5, 1.2) * 0.4
    return out + sub
