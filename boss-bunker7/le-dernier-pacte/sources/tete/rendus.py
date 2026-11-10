# Rendus de contrôle de la tête du Septième : python3 rendus.py  (serveur statique sur 127.0.0.1:8791 à la racine
# du scratchpad). Vue : [azimut, élévation, distance, dy, fov, dz, bouche 0..1, éclairage qui suit la caméra].
import subprocess, os
from PIL import Image, ImageDraw, ImageFont
W, H = 520, 640
VUES = [('face', 'Face', [0, 0.04, 0.66, 0.01, 22]),
        ('trois_quarts_gauche', '3/4 gauche', [0.75, 0.04, 0.66, 0.01, 22]),
        ('trois_quarts_droit', '3/4 droit (cicatrice)', [-0.75, 0.04, 0.66, 0.01, 22]),
        ('profil_droit', 'Profil droit', [-1.5708, 0.04, 0.66, 0.01, 22]),
        ('contre_plongee', 'Contre-plongée', [0.25, -0.5, 0.66, -0.03, 22, 0.0]),
        ('dos_du_crane', 'Dos du crâne', [3.1416, 0.25, 0.66, 0.03, 22, -0.03, 0, 1]),
        ('dessus_sceau', 'Dessus : sceau entier', [0.3, 1.2, 0.6, 0.07, 22, -0.04, 0, 1]),
        ('gros_plan_sceau', 'Gros plan sceau', [0.15, 0.55, 0.36, 0.085, 22, -0.01]),
        ('gros_plan_cicatrice', 'Gros plan cicatrice', [-1.45, 0.0, 0.30, -0.03, 22, -0.05, 0, 1]),
        ('bouche_ouverte_face', 'Bouche ouverte', [0, 0.0, 0.42, -0.04, 22, 0.0, 1]),
        ('bouche_ouverte_34', 'Bouche ouverte 3/4', [0.6, -0.1, 0.42, -0.04, 22, 0.0, 1]),
        ('cri_contre_plongee', 'Cri, contre-plongée', [-0.5, -0.35, 0.50, -0.04, 22, 0.0, 1])]
COLS = 4
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception:
    font = ImageFont.load_default()
os.makedirs('out/rendus', exist_ok=True)
for eclairage, prefix in (('boss', ''), ('neutre', 'n_')):
    tmp = f'out/rendus/_{eclairage}.png'
    subprocess.run(['node', 'shoot_apercu.js', tmp, str([v[2] for v in VUES]).replace(' ', ''), str(COLS), eclairage], check=True)
    im = Image.open(tmp).convert('RGB')
    tiles = []
    for i, (nm, lb, _) in enumerate(VUES):
        t = im.crop(((i % COLS) * W, (i // COLS) * H, (i % COLS + 1) * W, (i // COLS + 1) * H))
        t.save(f'out/rendus/{prefix}{nm}.png')
        d = ImageDraw.Draw(t); d.rectangle((0, 0, W, 34), fill=(0, 0, 0)); d.text((10, 5), lb, fill=(235, 230, 220), font=font)
        tiles.append(t.resize((W // 2, H // 2)))
    rows = (len(VUES) + COLS - 1) // COLS
    sh = Image.new('RGB', (W // 2 * COLS, H // 2 * rows))
    for i, t in enumerate(tiles):
        sh.paste(t, ((i % COLS) * W // 2, (i // COLS) * H // 2))
    sh.save(f'out/rendus/planche_eclairage_{eclairage}.png')
    os.remove(tmp)
print('rendus :', len(os.listdir('out/rendus')), 'fichiers')
