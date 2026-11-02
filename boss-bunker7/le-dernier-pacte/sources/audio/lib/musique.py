"""Moteur de mixage des musiques du boss : bus, boucles parfaitement jointives (évènements et réverbération
repliés modulo la durée, chaîne de mastering appliquée sur 3 copies dont on garde celle du milieu),
cues non bouclées (queue conservée puis fondue)."""
import numpy as np
from scipy.signal import fftconvolve
from .dsp import SR, secs, make_ir, compress, saturate, butter_hp, shelf, pan
from .sortie import integrated


def active_rms_db(x, floor_db=-45.0):
    m = np.mean(np.atleast_2d(x), axis=0)
    hop = secs(0.05)
    k = len(m) // hop
    if k == 0:
        return -120.0
    fr = np.sqrt(np.mean(m[:k * hop].reshape(k, hop) ** 2, axis=1)) + 1e-12
    db = 20 * np.log10(fr)
    act = fr[db > db.max() + floor_db]
    return float(20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-12))


class Bus:
    def __init__(self, n, boucle):
        self.n = n
        self.boucle = boucle
        self.buf = np.zeros((2, n))

    def add(self, sig, t, gain=1.0, p=0.0):
        s = np.asarray(sig, dtype=np.float64)
        s = s if s.ndim == 2 else pan(s, p)
        i = secs(t)
        if self.boucle:
            i %= self.n
            k = 0
            while k < s.shape[1]:
                j = (i + k) % self.n
                m = min(s.shape[1] - k, self.n - j)
                self.buf[:, j:j + m] += s[:, k:k + m] * gain
                k += m
        else:
            if i >= self.n:
                return
            if i < 0:
                s = s[:, -i:]; i = 0
            m = min(s.shape[1], self.n - i)
            self.buf[:, i:i + m] += s[:, :m] * gain


def _trois(x, fn):
    """Applique fn (traitement à mémoire) sur 3 copies jointes ; renvoie la copie du milieu."""
    n = x.shape[-1]
    y = fn(np.concatenate([x, x, x], axis=-1))
    return y[..., n:2 * n]


class Morceau:
    def __init__(self, duree, boucle=True, queue=4.0):
        self.duree = duree
        self.boucle = boucle
        self.n = secs(duree) if boucle else secs(duree + queue)
        self.buses = {}
        self.sends = {}

    def bus(self, nom, envoi=0.25):
        if nom not in self.buses:
            self.buses[nom] = Bus(self.n, self.boucle)
            self.sends[nom] = envoi
        return self.buses[nom]

    def respiration(self, t0, fondu=0.06, plancher=0.0, buses=None, t1=None):
        """Coupe ce qui est déjà posé sur les bus entre t0 et t1 (ou jusqu'à la fin)."""
        env = np.ones(self.n)
        a, b = secs(t0), secs(t0 + fondu)
        env[a:b] = plancher + (1 - plancher) * 0.5 * (1 + np.cos(np.linspace(0, np.pi, b - a)))
        if t1 is None:
            env[b:] = plancher
        else:
            c, d = secs(t1), secs(t1 + fondu)
            env[b:c] = plancher
            env[c:d] = plancher + (1 - plancher) * 0.5 * (1 - np.cos(np.linspace(0, np.pi, d - c)))
        for nom, bus in self.buses.items():
            if buses is None or nom in buses:
                bus.buf *= env

    def rendu(self, ir, cibles=None, effets=None, cible_lufs=-18.0, gains=None, compresser=True, fin_fondu=0.5):
        n = self.n
        sec = np.zeros((2, n)); env_rev = np.zeros((2, n))
        stats = {}
        for nom, bus in self.buses.items():
            x = bus.buf.copy()
            if effets and nom in effets:
                x = _trois(x, effets[nom]) if self.boucle else effets[nom](x)
            if cibles and nom in cibles:
                x *= 10 ** ((cibles[nom] - active_rms_db(x)) / 20)
            x *= 10 ** (((gains or {}).get(nom, 0.0)) / 20)
            stats[nom] = round(active_rms_db(x), 1)
            sec += x
            env_rev += x * self.sends[nom]
        if self.boucle:
            # réverbération circulaire : la queue de la fin retombe au début
            wet = np.zeros((2, n))
            for c in range(2):
                full = fftconvolve(env_rev[c], ir[c]) + 0.15 * fftconvolve(env_rev[1 - c], ir[c])
                for k in range(0, len(full), n):
                    seg = full[k:k + n]
                    wet[c, :len(seg)] += seg
            sortie = sec + wet * 0.25
        else:
            wet = np.zeros((2, n))
            for c in range(2):
                full = fftconvolve(env_rev[c], ir[c]) + 0.15 * fftconvolve(env_rev[1 - c], ir[c])
                wet[c] = full[:n]
            sortie = sec + wet * 0.25

        def master(y):
            y = butter_hp(y, 32, 2)
            y = shelf(y, 5000, 2.0, 'high')
            if compresser:
                y = compress(y, -14, 1.7, 0.03, 0.3, 0)
            return saturate(y * 0.9, 1.15) * 1.05

        sortie = _trois(sortie, master) if self.boucle else master(sortie)
        sortie *= 10 ** ((cible_lufs - integrated(sortie)) / 20)
        if not self.boucle and fin_fondu:
            f = secs(fin_fondu)
            sortie[:, -f:] *= np.cos(np.linspace(0, np.pi / 2, f)) ** 2
        return sortie, stats
