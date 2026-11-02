"""Spectrogrammes de contrôle : python spectro.py fichier.(wav|mp3) [sortie.png] [titre]"""
import sys, os, subprocess, numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.signal import spectrogram
SR = 48000

def charger(p):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.astype(np.float64)

def png(x, path, titre=''):
    x = np.atleast_2d(x)
    mono = x.mean(axis=0)
    f, t, S = spectrogram(mono, SR, nperseg=1024 if len(mono) < SR * 4 else 2048, noverlap=768 if len(mono) < SR * 4 else 1536)
    fig, ax = plt.subplots(2, 1, figsize=(11, 5.2), gridspec_kw={'height_ratios': [1, 2.2]})
    tt = np.arange(len(mono)) / SR
    ax[0].plot(tt, x[0], lw=0.3, color='#ddd'); ax[0].set_xlim(0, tt[-1]); ax[0].set_ylim(-1, 1)
    if x.shape[0] > 1:
        ax[0].plot(tt, x[1] * 0 + (x[0] - x[1]) * 0.5 - 0.0, lw=0.2, color='#c44', alpha=0.6)
    ax[0].set_facecolor('#111'); ax[0].set_title(titre, color='w', fontsize=10)
    ax[1].pcolormesh(t, f, 10 * np.log10(S + 1e-14), shading='auto', cmap='magma', vmin=-130, vmax=-30)
    ax[1].set_yscale('symlog', linthresh=200); ax[1].set_ylim(30, 20000)
    fig.patch.set_facecolor('#111')
    for a in ax: a.tick_params(colors='w')
    fig.tight_layout(); fig.savefig(path, dpi=72); plt.close(fig)

if __name__ == '__main__':
    p = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(p)[0] + '.png'
    png(charger(p), out, sys.argv[3] if len(sys.argv) > 3 else os.path.basename(p))
