#!/usr/bin/env python3
"""Planche de comparaison : la source et une ou plusieurs vidéos côte à côte, sur des zones choisies, à l'échelle 1 ou
   agrandies (un écran qui étire la vidéo montre ses défauts plus gros).
   python3 -I maquettes/launcher/scene-bete/planche-video.py <dossier img_*> <sortie.jpg> --video "Titre=video.webm[@comparaison.json]" […]
                                                               --zone "i:x,y,l,h" […] [--echelle 2] [--fondu 1] [--fps 30]
   i : image de la boucle, O[i] (pour i < M, le mélange du fondu, calculé comme encoder.js). La comparaison (.json de
   comparer-video.py) donne l'image de la vidéo associée à O[i], utile pour une vidéo qui a perdu des images ; sans
   elle, l'image i de la vidéo. Sous chaque case : l'image et le PSNR de la zone. Agrandissement bicubique."""
import sys, json, subprocess, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
def options(n):
    return [args[k + 1] for k, a in enumerate(args) if a == n and k + 1 < len(args)]
def opt(n, d):
    v = options(n)
    return v[0] if v else d
pos = [a for k, a in enumerate(args) if not a.startswith('--') and (k == 0 or not args[k - 1].startswith('--'))]
D, SORTIE = pos[0], pos[1]
ECH, FPS, FONDU = float(opt('--echelle', 1)), float(opt('--fps', 30)), float(opt('--fondu', 1))
VIDEOS = []
for v in options('--video'):
    titre, reste = v.split('=', 1)
    chemin, _, comp = reste.partition('@')
    VIDEOS.append((titre, chemin, json.load(open(comp)) if comp else None))
ZONES = [(int(z.split(':')[0]), tuple(int(c) for c in z.split(':')[1].split(','))) for z in options('--zone')]
images = sorted(f for f in os.listdir(D) if re.match(r'^img_\d+\.(jpe?g|png)$', f))
N = len(images); M = round(FONDU * FPS); L = N - M
SWS = ['-sws_flags', 'accurate_rnd+full_chroma_int+bitexact']

def taille(f):
    s = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', f],
                                  check=True, capture_output=True, text=True).stdout)['streams'][0]
    return s['width'], s['height']
def brute(cmd, f):
    W, H = taille(f)
    return np.frombuffer(subprocess.run(cmd, check=True, capture_output=True).stdout, np.uint8).reshape(H, W, 3)
def source(k):
    f = os.path.join(D, images[k])
    return brute(['ffmpeg', '-v', 'error', '-nostdin', '-i', f, *SWS, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], f)
def reference(i):
    if i >= M:
        return source(i)
    a, g = (i + 0.5) / M, source(i + L).astype(np.float64)
    return np.round(g + (source(i).astype(np.float64) - g) * a).astype(np.uint8)
def image_video(f, k):
    return brute(['ffmpeg', '-v', 'error', '-nostdin', '-i', f, '-fps_mode', 'passthrough', '-vf', f'select=eq(n\\,{k})', *SWS,
                  '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], f)
def psnr(a, b):
    m = ((a.astype(np.float64) - b.astype(np.float64)) ** 2).mean()
    return 99.0 if m == 0 else 10 * np.log10(255 ** 2 / m)

police = None
for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'):
    if os.path.exists(f):
        police = ImageFont.truetype(f, 15); break
police = police or ImageFont.load_default()
BANDE, MARGE = 44, 6
lignes = []
for i, (x, y, l, h) in ZONES:
    ref = reference(i)
    zone = lambda im: im[y:y + h, x:x + l]
    cases = [(ref, f'Source : image {i} de la boucle', f'{i / FPS:.2f} s' + (' (fondu)' if i < M else '') + (f' · agrandie × {ECH:g}' if ECH != 1 else ''))]
    for titre, chemin, comp in VIDEOS:
        e = next((e for e in comp['images'] if e['i'] == i), None) if comp else {'k': i}
        if e is None:
            cases.append((None, titre, 'image perdue')); continue
        im = image_video(chemin, e['k'])
        cases.append((im, titre, f"image {e['k']} · PSNR de la zone {psnr(zone(im), zone(ref)):.1f} dB"))
    ligne = []
    for im, a, b in cases:
        c = Image.fromarray(np.ascontiguousarray(zone(im))) if im is not None else Image.new('RGB', (l, h), (40, 0, 0))
        if ECH != 1:
            c = c.resize((round(l * ECH), round(h * ECH)), Image.BICUBIC)
        ligne.append((c, a, b))
    lignes.append(ligne)
LARG = max(sum(c[0].width for c in r) + MARGE * (len(r) + 1) for r in lignes)
HAUT = sum(r[0][0].height + BANDE + MARGE for r in lignes) + MARGE
planche = Image.new('RGB', (LARG, HAUT), (16, 16, 16))
dessin = ImageDraw.Draw(planche)
y0 = MARGE
for r in lignes:
    x0 = MARGE
    for im, a, b in r:
        dessin.text((x0, y0 + 4), a, fill=(235, 235, 235), font=police)
        dessin.text((x0, y0 + 23), b, fill=(170, 200, 170), font=police)
        planche.paste(im, (x0, y0 + BANDE))
        x0 += im.width + MARGE
    y0 += r[0][0].height + BANDE + MARGE
planche.save(SORTIE, quality=95)
print(SORTIE, planche.size)
