#!/usr/bin/env python3
"""Compare une vidéo de la Mère-Vase aux images dont elle vient (décodage par ffmpeg, sans navigateur, en flux : environ 0,5 Go).
   python3 -I maquettes/launcher/scene-bete/comparer-video.py <dossier img_*.jpg> <video.webm> [--fps 30] [--fondu 1] [--json sortie.json]
   - images et rythme : paquets relus un à un (ffprobe), écarts entre images ;
   - correspondance : chaque image décodée est rapprochée de l'image de référence la plus proche (fenêtre glissante,
     dans l'ordre) : images perdues ou en double repérées ;
   - fidélité : PSNR (RVB), PSNR des zones sombres (luminance de référence < 50), SSIM (luminance, gaussienne 1,5),
     biais moyen par canal (vidéo − référence) ;
   - raccord de la boucle : écart entre la dernière et la première image, comparé aux écarts entre images voisines.
   La référence O[i] est celle de encoder.js : F[i] pour i ≥ M, mélange de F[i + L] et F[i] (poids (i + 0,5)/M) sinon."""
import sys, os, json, subprocess, re
from collections import OrderedDict
import numpy as np
from scipy.ndimage import gaussian_filter

args = sys.argv[1:]
def opt(n, d):
    return args[args.index(n) + 1] if n in args else d
DOSSIER, VIDEO = args[0], args[1]
FPS, FONDU = float(opt('--fps', 30)), float(opt('--fondu', 1))
SORTIE_JSON = opt('--json', None)

images = sorted(f for f in os.listdir(DOSSIER) if re.match(r'^img_\d+\.(jpe?g|png)$', f))
N = len(images); M = round(FONDU * FPS); L = N - M
m0 = re.match(r'^img_(\d+)\.(\w+)$', images[0])
PREMIER = int(m0.group(1))
motif = os.path.join(DOSSIER, f'img_%0{len(m0.group(1))}d.{m0.group(2)}')

def sonde(f, *a):
    return json.loads(subprocess.run(['ffprobe', '-v', 'error', *a, '-of', 'json', f], check=True, capture_output=True, text=True).stdout)

info = sonde(VIDEO, '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name,pix_fmt,color_space,color_transfer,color_primaries,color_range:format=duration,size')
W, H = info['streams'][0]['width'], info['streams'][0]['height']
T = W * H * 3

def flux(cmd):
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(T)
        if not b:
            break
        if len(b) < T:
            raise SystemExit(f'image incomplète ({len(b)} octets)')
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    if p.wait():
        raise SystemExit(f'ffmpeg : code {p.returncode}')

SWS = ['-sws_flags', 'accurate_rnd+full_chroma_int+bitexact']
def sources(debut, nombre):
    return flux(['ffmpeg', '-v', 'error', '-nostdin', '-start_number', str(PREMIER + debut), '-i', motif, '-frames:v', str(nombre),
                 *SWS, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])

fin = list(sources(L, M)) if M else []
def references():
    for i, f in enumerate(sources(0, L)):
        if i < M:
            a = (i + 0.5) / M
            g = fin[i].astype(np.float64)
            yield np.round(g + (f.astype(np.float64) - g) * a).astype(np.uint8)
        else:
            yield f
gen_ref, fenetre, prochaine = references(), OrderedDict(), 0
def ref(i):
    global prochaine
    while prochaine <= i:
        fenetre[prochaine] = next(gen_ref); prochaine += 1
    return fenetre[i]

def luma(x):
    x = x.astype(np.float64)
    return 0.299 * x[..., 0] + 0.587 * x[..., 1] + 0.114 * x[..., 2]
def mse(a, b, masque=None):
    d = (a.astype(np.float64) - b.astype(np.float64)) ** 2
    if masque is not None:
        d = d[masque]
    return float(d.mean())
def psnr(m):
    return 99.0 if m == 0 else 10 * np.log10(255 ** 2 / m)
C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
def ssim(a, b):
    a, b = luma(a), luma(b)
    g = lambda x: gaussian_filter(x, 1.5, truncate=3.5)
    ma, mb = g(a), g(b)
    saa, sbb, sab = g(a * a) - ma * ma, g(b * b) - mb * mb, g(a * b) - ma * mb
    return float((((2 * ma * mb + C1) * (2 * sab + C2)) / ((ma * ma + mb * mb + C1) * (saa + sbb + C2))).mean())

# paquets : nombre et écarts (ms)
pk = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', VIDEO],
                    check=True, capture_output=True, text=True).stdout.replace(',', ' ').split()
pts = sorted(float(x) for x in pk if x != 'N/A')
ecarts = np.round(np.diff(pts) * 1000).astype(int)
valeurs, nombres = np.unique(ecarts, return_counts=True)

# correspondance et fidélité, image par image, en flux
j, corr, res, voisins = 0, [], [], []
premiere = precedente = None
for k, img in enumerate(flux(['ffmpeg', '-v', 'error', '-nostdin', '-i', VIDEO, '-fps_mode', 'passthrough', *SWS, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])):
    cands = range(max(0, j - 1), min(L, j + 5))
    best = min(cands, key=lambda i: mse(img, ref(i)))
    corr.append(best); j = best + 1
    r = ref(best)
    sombre = luma(r) < 50
    res.append({'k': k, 'i': best, 'psnr': psnr(mse(img, r)), 'psnr_sombre': psnr(mse(img, r, sombre)), 'ssim': ssim(img, r),
                'biais': [float((img[..., c].astype(np.float64) - r[..., c]).mean()) for c in range(3)]})
    for i in [i for i in fenetre if i < j - 1]:
        del fenetre[i]
    if premiere is None:
        premiere = img
    if precedente is not None:
        voisins.append(float(np.abs(img.astype(np.int16) - precedente.astype(np.int16)).mean()))
    precedente = img
raccord = float(np.abs(premiere.astype(np.int16) - precedente.astype(np.int16)).mean())
vues = set(corr)
perdues = [i for i in range(L) if i not in vues]
doubles = sorted(i for i in vues if corr.count(i) > 1)
pures = [x for x in res if x['i'] >= M]
fondu = [x for x in res if x['i'] < M]
def resume(xs, cle):
    v = np.array([x[cle] for x in xs])
    return {'moyenne': round(float(v.mean()), 4), 'min': round(float(v.min()), 4)} if len(v) else None

bilan = {
    'video': VIDEO, 'taille_octets': int(info['format']['size']), 'duree_s': float(info['format']['duration']),
    'flux': info['streams'][0], 'paquets': len(pts), 'images_decodees': len(res), 'images_attendues': L,
    'ecarts_ms': {int(a): int(b) for a, b in zip(valeurs, nombres)}, 'ecart_min_ms': int(ecarts.min()), 'ecart_max_ms': int(ecarts.max()),
    'perdues': perdues, 'doubles': doubles, 'correspondance_identique': sum(1 for x in res if x['i'] == x['k']),
    'psnr_pures': resume(pures, 'psnr'), 'psnr_sombre_pures': resume(pures, 'psnr_sombre'), 'ssim_pures': resume(pures, 'ssim'),
    'psnr_fondu': resume(fondu, 'psnr'), 'ssim_fondu': resume(fondu, 'ssim'),
    'biais_moyen_rvb': [round(float(np.mean([x['biais'][c] for x in res])), 3) for c in range(3)],
    'raccord': {'ecart': round(raccord, 3), 'voisins_mediane': round(float(np.median(voisins)), 3), 'voisins_max': round(float(max(voisins)), 3)},
}
print(json.dumps(bilan, ensure_ascii=False, indent=1))
if SORTIE_JSON:
    json.dump({'bilan': bilan, 'images': res}, open(SORTIE_JSON, 'w'), ensure_ascii=False, indent=1)
