"""Planche de spectrogrammes : python planche.py sortie.png cle1 cle2 ... (lit out/<cle>.mp3)"""
import sys, numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.signal import spectrogram
sys.path.insert(0, '.')
from spectro import charger
SR = 48000
out = sys.argv[1]; cles = sys.argv[2:]
cols = 2; rows = (len(cles) + 1) // 2
fig = plt.figure(figsize=(14, 3.1 * rows))
for i, c in enumerate(cles):
    x = charger(f'out/{c}.mp3')
    mono = x.mean(axis=0)
    ax1 = fig.add_axes([0.04 + (i % cols) * 0.49, 1 - (i // cols + 1) / rows + 0.6 / rows, 0.44, 0.3 / rows])
    ax2 = fig.add_axes([0.04 + (i % cols) * 0.49, 1 - (i // cols + 1) / rows + 0.08 / rows, 0.44, 0.5 / rows])
    tt = np.arange(len(mono)) / SR
    ax1.plot(tt, x[0], lw=0.3, color='#ddd'); ax1.set_xlim(0, tt[-1]); ax1.set_ylim(-1, 1)
    ax1.set_facecolor('#111'); ax1.set_xticks([]); ax1.set_yticks([])
    ax1.set_title(c + '  (%.2f s)' % tt[-1], color='w', fontsize=9, loc='left', pad=2)
    nper = 1024 if len(mono) < SR * 3 else 2048
    f, t, S = spectrogram(mono, SR, nperseg=nper, noverlap=nper * 3 // 4)
    ax2.pcolormesh(t, f, 10 * np.log10(S + 1e-14), shading='auto', cmap='magma', vmin=-125, vmax=-35)
    ax2.set_yscale('symlog', linthresh=200); ax2.set_ylim(30, 20000); ax2.set_xlim(0, tt[-1])
    ax2.tick_params(colors='w', labelsize=7)
fig.patch.set_facecolor('#111')
fig.savefig(out, dpi=62); plt.close(fig)
