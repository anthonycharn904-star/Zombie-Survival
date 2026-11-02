"""Bus de mixage, envois de réverbération et chaîne de mastering communs aux pièces."""
import numpy as np
from .dsp import (SR, secs, Track, make_ir, convolve_reverb, compress, limiter, saturate, butter_hp, butter_lp,
                  peak_eq, shelf, lufs)
import soundfile as sf
import subprocess, os


class Mix:
    def __init__(self, seconds):
        self.seconds = seconds
        self.buses = {}
        self.sends = {}

    def bus(self, name, send=0.25):
        if name not in self.buses:
            self.buses[name] = Track(self.seconds)
            self.sends[name] = send
        return self.buses[name]

    def breath(self, t0, fade=0.06, floor=0.0, buses=None):
        """Respiration avant un impact : tout ce qui a déjà été posé sur les bus s'éteint à partir de t0
        (fondu en cosinus de `fade` s) et reste coupé ensuite. Ce qui est ajouté après l'appel (l'impact,
        la montée, la cymbale inversée) n'est pas touché. La réverbération des notes coupées continue."""
        n = secs(self.seconds)
        env = np.ones(n)
        a, b = secs(t0), secs(t0 + fade)
        env[a:b] = floor + (1 - floor) * 0.5 * (1 + np.cos(np.linspace(0, np.pi, b - a)))
        env[b:] = floor
        for name, tr in self.buses.items():
            if buses is None or name in buses:
                tr.buf *= env

    def render(self, ir, master_gain_db=0.0, comp=True, target_lufs=-13.0, ceiling=-1.0, bus_gains=None, bus_fx=None, targets=None, end_fade=0.03):
        """targets : niveau RMS visé (dBFS) de chaque bus mesuré sur ses passages actifs ; bus_gains s'ajoute ensuite."""
        n = secs(self.seconds)
        dry = np.zeros((2, n)); wet_in = np.zeros((2, n))
        stats = {}
        for name, tr in self.buses.items():
            x = tr.buf.copy()
            if bus_fx and name in bus_fx:
                x = bus_fx[name](x)
            if targets and name in targets:
                x *= 10 ** ((targets[name] - active_rms_db(x)) / 20)
            g = 10 ** (((bus_gains or {}).get(name, 0.0)) / 20)
            x *= g
            stats[name] = round(active_rms_db(x), 1)
            dry += x
            wet_in += x * self.sends[name]
        wet = convolve_reverb(wet_in, ir, wet=1.0)[:, :n] - wet_in * (1 - 0.3)   # garde seulement la part humide
        out = dry + wet
        out = butter_hp(out, 34, 2)
        out = shelf(out, 5000, 2.5, 'high')          # un peu d'air : sombre sans être étouffé
        if comp:
            out = compress(out, -12, 1.8, 0.03, 0.3, 0)
        out = saturate(out * 0.9, 1.2) * 1.05
        out *= 10 ** (master_gain_db / 20)
        # normalisation à la sonie visée puis limiteur
        L = lufs(out)
        out *= 10 ** ((target_lufs - L) / 20)
        out = limiter(out, ceiling, 0.06)
        # fondu final (pas de clic, et la queue s'éteint avant la fin du fichier)
        f = secs(end_fade); out[:, -f:] *= np.cos(np.linspace(0, np.pi / 2, f)) ** 2
        return out, stats


def active_rms_db(x, floor_db=-45.0):
    """RMS sur les trames actives (à moins de 45 dB de la trame la plus forte) : niveau d'un instrument quand il joue."""
    m = np.mean(np.atleast_2d(x), axis=0)
    hop = secs(0.05)
    k = len(m) // hop
    if k == 0:
        return -120.0
    fr = np.sqrt(np.mean(m[:k * hop].reshape(k, hop) ** 2, axis=1)) + 1e-12
    db = 20 * np.log10(fr)
    act = fr[db > db.max() + floor_db]
    return float(20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-12))


def export(x, path_base, mp3_kbps=192):
    """Écrit le WAV maître (24 bits) et un MP3 (constant, compatible partout)."""
    os.makedirs(os.path.dirname(path_base), exist_ok=True)
    wav = path_base + '.wav'
    sf.write(wav, np.clip(x.T, -1, 1), SR, subtype='PCM_24')
    mp3 = path_base + '.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', f'{mp3_kbps}k', '-ar', '48000', mp3], check=True)
    return wav, mp3


def spectrogram_png(x, path, title=''):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from scipy.signal import spectrogram
    mono = np.mean(np.atleast_2d(x), axis=0)
    f, t, S = spectrogram(mono, SR, nperseg=2048, noverlap=1536)
    fig, ax = plt.subplots(2, 1, figsize=(11, 5.2), gridspec_kw={'height_ratios': [1, 2.2]})
    tt = np.arange(len(mono)) / SR
    ax[0].plot(tt, np.atleast_2d(x)[0], lw=0.3, color='#ddd'); ax[0].set_xlim(0, tt[-1]); ax[0].set_ylim(-1, 1)
    ax[0].set_facecolor('#111'); ax[0].set_title(title, color='w', fontsize=10)
    ax[1].pcolormesh(t, f, 10 * np.log10(S + 1e-12), shading='auto', cmap='magma', vmin=-120, vmax=-30)
    ax[1].set_yscale('symlog', linthresh=200); ax[1].set_ylim(30, 16000)
    fig.patch.set_facecolor('#111')
    for a in ax: a.tick_params(colors='w')
    fig.tight_layout(); fig.savefig(path, dpi=80); plt.close(fig)
