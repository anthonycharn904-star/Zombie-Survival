"""Spectrogrammes de contrôle des chiens zombies (v1.2) : python3 spectres_chiens.py → png/chiens/
<cle>.png (la boucle du grognement est montrée 3 fois bout à bout), planche_chiens.png, zoom_*.png."""
import os, sys, json, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.sortie import decoder_mp3, momentary_max, integrated, true_peak_db
from spectro import png
ICI = os.path.dirname(os.path.abspath(__file__))
os.chdir(ICI)
man = json.load(open('out/manifest.json'))
cles = sorted(k for k in man if k.startswith('chien_'))
os.makedirs('png/chiens', exist_ok=True)
for c in cles:
    m = man[c]
    d = decoder_mp3('out/' + m['fichier'], m['stereo'])
    titre = f"{c} — {m['echantillons'] / 48000:.2f} s, {m['lufs']} LUFS ({m['mesure']}), crête vraie {m['creteVraie']} dBTP"
    if m['boucle']:
        a = int(round(m['boucleDebut'] * 48000)); d = d[a:a + m['echantillons']]
        d = np.concatenate([d, d, d]); titre += ' — boucle ×3'
    png(d, f'png/chiens/{c}.png', titre)
subprocess.run([sys.executable, 'planche.py', 'png/chiens/planche_chiens.png'] + cles, check=True)
for args in [('chien_faille', 0, 1.2, 6000, 1024), ('chien_hurlement', 0, 2.5, 3000, 4096), ('chien_aboiement', 0, 0.3, 6000, 512),
             ('chien_morsure', 0, 0.1, 12000, 256), ('chien_mort', 0, 1.2, 6000, 1024)]:
    c, t0, t1, fm, npg = args
    subprocess.run([sys.executable, 'zoom.py', c, str(t0), str(t1), str(fm), f'png/chiens/zoom_{c[6:]}.png', str(npg)], check=True)
print('\n'.join(sorted(os.listdir('png/chiens'))))
