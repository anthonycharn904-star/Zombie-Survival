"""Spectrogramme détaillé (fréquences linéaires) : python zoom.py cle t0 t1 fmax sortie.png [nperseg]"""
import sys, json, numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.signal import spectrogram
sys.path.insert(0, '.')
from lib.sortie import decoder_mp3
cle, t0, t1, fmax, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
nper = int(sys.argv[6]) if len(sys.argv) > 6 else 2048
import os
m = json.load(open(f'masters/meta/{cle}.json')) if os.path.exists(f'masters/meta/{cle}.json') else json.load(open('out/manifest.json'))[cle]
d = decoder_mp3('out/' + m['fichier'], m['stereo'])
d = d.mean(axis=0) if d.ndim == 2 else d
if m['boucle']:
    a = int(round(m['boucleDebut'] * 48000)); d = d[a:a + m['echantillons']]
x = d[int(t0 * 48000):int(t1 * 48000)]
f, t, S = spectrogram(x, 48000, nperseg=nper, noverlap=nper - nper // 16)
fig, ax = plt.subplots(2, 1, figsize=(11, 6), gridspec_kw={'height_ratios': [1, 3]})
tt = np.arange(len(x)) / 48000 + t0
ax[0].plot(tt, x, lw=0.4, color='#ddd'); ax[0].set_xlim(t0, t1); ax[0].set_facecolor('#111')
ax[0].set_title(f'{cle} {t0}–{t1} s', color='w', fontsize=9)
ax[1].pcolormesh(t + t0, f, 10 * np.log10(S + 1e-14), shading='auto', cmap='magma', vmin=-120, vmax=-30)
ax[1].set_ylim(0, fmax)
fig.patch.set_facecolor('#111')
for a in ax: a.tick_params(colors='w', labelsize=7)
fig.tight_layout(); fig.savefig(out, dpi=70); plt.close(fig)
