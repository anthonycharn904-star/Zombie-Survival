"""Outils DSP pour la musique de Zombie Survival : oscillateurs, filtres, enveloppes, réverbération,
saturation, compression. Tout est calculé ici (aucun échantillon tiers). 48 kHz, flottants."""
import numpy as np
from numba import njit
from scipy.signal import fftconvolve, butter, sosfilt, sosfiltfilt, resample_poly

SR = 48000
RNG = np.random.default_rng(20261021)


def secs(n):
    return int(round(n * SR))


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


# ───────────── oscillateurs (numba) ─────────────
@njit(cache=True)
def _polyblep(t, dt):
    if t < dt:
        t /= dt
        return t + t - t * t - 1.0
    if t > 1.0 - dt:
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    return 0.0


@njit(cache=True)
def saw(freq, phase0):
    """Dent de scie à bande limitée (PolyBLEP) ; freq = tableau de fréquences par échantillon."""
    n = freq.shape[0]
    out = np.empty(n)
    ph = phase0
    for i in range(n):
        dt = freq[i] / 48000.0
        out[i] = 2.0 * ph - 1.0 - _polyblep(ph, dt)
        ph += dt
        if ph >= 1.0:
            ph -= 1.0
    return out


@njit(cache=True)
def pulse(freq, width, phase0):
    n = freq.shape[0]
    out = np.empty(n)
    ph = phase0
    for i in range(n):
        dt = freq[i] / 48000.0
        v = 1.0 if ph < width else -1.0
        v += _polyblep(ph, dt)
        t2 = ph - width
        if t2 < 0.0:
            t2 += 1.0
        v -= _polyblep(t2, dt)
        out[i] = v
        ph += dt
        if ph >= 1.0:
            ph -= 1.0
    return out


def sine(freq, phase0=0.0):
    ph = np.cumsum(np.asarray(freq, dtype=np.float64)) / SR + phase0
    return np.sin(2 * np.pi * ph)


# ───────────── filtre à variables d'état (coupure et résonance variables) ─────────────
@njit(cache=True)
def svf(x, cutoff, q, mode):
    """mode 0 = passe-bas, 1 = passe-bande, 2 = passe-haut. cutoff et q : tableaux par échantillon."""
    n = x.shape[0]
    out = np.empty(n)
    ic1 = 0.0
    ic2 = 0.0
    for i in range(n):
        fc = cutoff[i]
        if fc > 20000.0:
            fc = 20000.0
        if fc < 10.0:
            fc = 10.0
        g = np.tan(np.pi * fc / 48000.0)
        k = 1.0 / q[i]
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            out[i] = v2
        elif mode == 1:
            out[i] = v1
        else:
            out[i] = x[i] - k * v1 - v2
    return out


def lp(x, fc, q=0.707):
    return svf(np.ascontiguousarray(x, dtype=np.float64), _arr(fc, len(x)), _arr(q, len(x)), 0)


def bp(x, fc, q=1.0):
    return svf(np.ascontiguousarray(x, dtype=np.float64), _arr(fc, len(x)), _arr(q, len(x)), 1)


def hp(x, fc, q=0.707):
    return svf(np.ascontiguousarray(x, dtype=np.float64), _arr(fc, len(x)), _arr(q, len(x)), 2)


def _arr(v, n):
    if np.isscalar(v):
        return np.full(n, float(v))
    return np.ascontiguousarray(v, dtype=np.float64)


def butter_hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'highpass', fs=SR, output='sos'), x, axis=-1)


def butter_lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'lowpass', fs=SR, output='sos'), x, axis=-1)


def peak_eq(x, fc, gain_db, q=1.0):
    """Égaliseur en cloche (biquad RBJ)."""
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * fc / SR
    al = np.sin(w) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w), 1 - al / A])
    from scipy.signal import lfilter
    return lfilter(b / a[0], a / a[0], x, axis=-1)


def shelf(x, fc, gain_db, kind='low'):
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * fc / SR
    al = np.sin(w) / 2 * np.sqrt(2)
    c = np.cos(w)
    if kind == 'low':
        b = [A * ((A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al)]
        a = [(A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al]
    else:
        b = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al)]
        a = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al]
    from scipy.signal import lfilter
    b = np.array(b); a = np.array(a)
    return lfilter(b / a[0], a / a[0], x, axis=-1)


# ───────────── enveloppes ─────────────
def env_adsr(n, a, d, s, r, hold=None, curve=3.0):
    """Enveloppe ADSR exponentielle ; hold = durée de maintien avant relâchement (s)."""
    t = np.arange(n) / SR
    e = np.zeros(n)
    hold = (n / SR - r) if hold is None else hold
    att = t < a
    e[att] = (t[att] / max(a, 1e-6)) ** 0.8
    dec = (t >= a) & (t < hold)
    e[dec] = s + (1 - s) * np.exp(-(t[dec] - a) / max(d, 1e-6) * curve / 3)
    rel = t >= hold
    level = s + (1 - s) * np.exp(-(max(hold - a, 0)) / max(d, 1e-6) * curve / 3)
    e[rel] = level * np.exp(-(t[rel] - hold) / max(r, 1e-6) * 4.6)
    return e


def env_perc(n, a, decay):
    t = np.arange(n) / SR
    e = np.exp(-t / max(decay, 1e-6))
    if a > 0:
        e *= np.minimum(1, t / a)
    return e


def smooth_noise(n, rate_hz, seed=None):
    """Bruit lent et lisse (dérives de hauteur, respiration)."""
    rng = np.random.default_rng(seed) if seed is not None else RNG
    k = max(2, int(n / SR * rate_hz) + 3)
    pts = rng.standard_normal(k)
    xs = np.linspace(0, n, k)
    from scipy.interpolate import CubicSpline
    return CubicSpline(xs, pts)(np.arange(n))


def noise(n, seed=None):
    rng = np.random.default_rng(seed) if seed is not None else RNG
    return rng.standard_normal(n)


# ───────────── Karplus-Strong (cordes pincées : guitare) ─────────────
@njit(cache=True)
def karplus(freq, n, damping, bright, seed):
    np.random.seed(seed)
    L = int(48000.0 / freq)
    frac = 48000.0 / freq - L
    buf = np.random.uniform(-1.0, 1.0, L + 2)
    # excitation adoucie (médiator) : passe-bas sur le bruit initial
    for i in range(1, L + 2):
        buf[i] = bright * buf[i] + (1.0 - bright) * buf[i - 1]
    out = np.empty(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        a = buf[idx % (L + 1)]
        b = buf[(idx + 1) % (L + 1)]
        v = a + frac * (b - a)
        out[i] = v
        nv = damping * 0.5 * (v + prev)
        prev = v
        buf[idx % (L + 1)] = nv
        idx += 1
    return out


# ───────────── dynamique ─────────────
@njit(cache=True)
def _env_follow(x, att, rel):
    n = x.shape[0]
    out = np.empty(n)
    e = 0.0
    ga = np.exp(-1.0 / (att * 48000.0))
    gr = np.exp(-1.0 / (rel * 48000.0))
    for i in range(n):
        v = abs(x[i])
        if v > e:
            e = ga * e + (1.0 - ga) * v
        else:
            e = gr * e + (1.0 - gr) * v
        out[i] = e
    return out


def compress(x, thresh_db=-18, ratio=4, att=0.005, rel=0.12, makeup_db=0, knee_db=6):
    """Compresseur stéréo lié (x : (2, n) ou (n,))."""
    mono = np.max(np.abs(np.atleast_2d(x)), axis=0)
    env = _env_follow(np.ascontiguousarray(mono, dtype=np.float64), att, rel)
    lvl = 20 * np.log10(env + 1e-9)
    over = lvl - thresh_db
    gr = np.where(over <= -knee_db / 2, 0, np.where(over >= knee_db / 2, over * (1 - 1 / ratio), (over + knee_db / 2) ** 2 / (2 * knee_db) * (1 - 1 / ratio)))
    g = 10 ** ((-gr + makeup_db) / 20)
    return x * g


def limiter(x, ceiling_db=-1.0, release=0.08, lookahead=0.003):
    """Limiteur à anticipation (crêtes sous le plafond)."""
    x2 = np.atleast_2d(x)
    la = secs(lookahead)
    peak = np.max(np.abs(x2), axis=0)
    # crête glissante sur la fenêtre d'anticipation
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(peak, size=2 * la + 1)
    c = 10 ** (ceiling_db / 20)
    target = np.minimum(1.0, c / (pk + 1e-12))
    # relâchement exponentiel du gain
    g = _release(np.ascontiguousarray(target), release)
    out = x2 * g
    return out if x.ndim > 1 else out[0]


@njit(cache=True)
def _release(target, rel):
    n = target.shape[0]
    g = np.empty(n)
    cur = 1.0
    k = np.exp(-1.0 / (rel * 48000.0))
    for i in range(n):
        t = target[i]
        if t < cur:
            cur = t
        else:
            cur = k * cur + (1.0 - k) * t
        g[i] = cur
    return g


def saturate(x, drive=2.0, asym=0.0):
    """Saturation douce (tanh) avec légère asymétrie (chaleur), suréchantillonnée ×2."""
    up = resample_poly(x, 2, 1, axis=-1)
    y = np.tanh(drive * (up + asym)) - np.tanh(drive * asym)
    y /= np.tanh(drive) if drive > 0 else 1
    return resample_poly(y, 1, 2, axis=-1)


# ───────────── réverbération à convolution (réponse impulsionnelle synthétisée) ─────────────
def make_ir(seconds=2.8, predelay=0.02, bands=((0, 250, 1.25), (250, 1200, 1.0), (1200, 4000, 0.72), (4000, 20000, 0.42)), early=12, seed=7, width=1.0):
    """Salle sombre : décroissance plus longue dans les graves, réflexions précoces éparses. Renvoie (2, n)."""
    rng = np.random.default_rng(seed)
    n = secs(seconds)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for ch in range(2):
        nz = rng.standard_normal(n)
        acc = np.zeros(n)
        for lo, hi, k in bands:
            if lo <= 0:
                band = butter_lp(nz, hi, 4)
            elif hi >= 20000:
                band = butter_hp(nz, lo, 4)
            else:
                band = sosfilt(butter(4, [lo, hi], 'bandpass', fs=SR, output='sos'), nz)
            rt = seconds * k * 0.55
            acc += band * np.exp(-t / (rt / 6.9))
        # attaque douce de la queue
        acc *= np.minimum(1, t / 0.03)
        # réflexions précoces
        for _ in range(early):
            d = rng.uniform(0.004, 0.06)
            g = rng.uniform(0.2, 0.6) * np.exp(-d * 20)
            acc[secs(d)] += g * rng.choice([-1, 1]) * 8
        ir[ch] = acc
    mid = (ir[0] + ir[1]) / 2
    side = (ir[0] - ir[1]) / 2 * width
    ir = np.stack([mid + side, mid - side])
    pd = secs(predelay)
    ir = np.concatenate([np.zeros((2, pd)), ir], axis=1)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def convolve_reverb(x, ir, wet=0.3):
    """x : (2, n) → (2, n + len(ir) - 1) : mélange sec + humide."""
    x2 = np.atleast_2d(x)
    if x2.shape[0] == 1:
        x2 = np.vstack([x2, x2])
    wetL = fftconvolve(x2[0], ir[0]) + fftconvolve(x2[1], ir[0]) * 0.15
    wetR = fftconvolve(x2[1], ir[1]) + fftconvolve(x2[0], ir[1]) * 0.15
    n = len(wetL)
    out = np.zeros((2, n))
    out[:, :x2.shape[1]] = x2 * (1 - wet * 0.3)
    out[0] += wetL * wet * 0.25
    out[1] += wetR * wet * 0.25
    return out


# ───────────── stéréo et placement ─────────────
def pan(mono, p):
    """p dans [-1, 1] : loi à puissance constante."""
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)])


class Track:
    """Piste stéréo à durée fixe ; on y additionne des sons à des instants donnés."""

    def __init__(self, seconds):
        self.n = secs(seconds)
        self.buf = np.zeros((2, self.n))

    def add(self, sig, t, gain=1.0, p=0.0):
        s = sig if sig.ndim == 2 else pan(sig, p)
        i = secs(t)
        if i >= self.n:
            return
        m = min(s.shape[1], self.n - i)
        if i < 0:
            s = s[:, -i:]; m = min(s.shape[1], self.n); i = 0
        self.buf[:, i:i + m] += s[:, :m] * gain


def lufs(x):
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    return meter.integrated_loudness(np.atleast_2d(x).T)


def normalize_lufs(x, target=-14.0):
    l = lufs(x)
    return x * 10 ** ((target - l) / 20), l
