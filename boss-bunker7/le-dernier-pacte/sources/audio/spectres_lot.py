"""Spectrogrammes de contrôle d'un lot de sons du manifeste.
Usage : python3 spectres_lot.py <dossier> <clé…> [-- <clé:t0:t1:fmax:nperseg> …]
→ <dossier>/<clé>.png (les boucles sont montrées 3 fois bout à bout), <dossier>/planche_*.png (8 sons par planche),
  <dossier>/zoom_<clé>.png pour chaque zoom demandé."""
import os, sys, json, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.sortie import decoder_mp3
from spectro import png
ICI = os.path.dirname(os.path.abspath(__file__))
os.chdir(ICI)
args = sys.argv[1:]
dossier = args[0]
cles = args[1:args.index('--')] if '--' in args else args[1:]
zooms = args[args.index('--') + 1:] if '--' in args else []
os.makedirs(dossier, exist_ok=True)
man = json.load(open('out/manifest.json'))
for c in cles:
    m = man[c]
    d = decoder_mp3('out/' + m['fichier'], m['stereo'])
    titre = f"{c} — {m['echantillons'] / 48000:.2f} s, {m['lufs']} LUFS ({m['mesure']}), crête vraie {m['creteVraie']} dBTP"
    if m['boucle']:
        a = int(round(m['boucleDebut'] * 48000)); d = d[..., a:a + m['echantillons']]
        d = np.concatenate([d, d, d], axis=-1); titre += ' — boucle ×3'
    png(d, os.path.join(dossier, c + '.png'), titre)
for i in range(0, len(cles), 8):
    subprocess.run([sys.executable, 'planche.py', os.path.join(dossier, f'planche_{i // 8 + 1}.png')] + cles[i:i + 8], check=True)
for z in zooms:
    c, t0, t1, fm, npg = z.split(':')
    subprocess.run([sys.executable, 'zoom.py', c, t0, t1, fm, os.path.join(dossier, f'zoom_{c}.png'), npg], check=True)
print(f'{len(cles)} spectrogrammes, {len(zooms)} zooms → {dossier}')
