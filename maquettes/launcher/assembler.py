#!/usr/bin/env python3
"""Maquettes du launcher : assemble chaque direction en un seul fichier HTML autonome, à ouvrir sous Windows sans
serveur ni dossier de ressources (polices, images, styles et scripts inclus).

    python3 maquettes/launcher/assembler.py [<dossier>]      (par défaut : maquettes/launcher/sortie/, ignoré par Git)

Ressources reprises du dépôt, sans les modifier :
  polices   launcher/src/renderer/fonts/ (licences dans launcher/gamelibs/fonts/ : OFL, Apache 2.0 pour Special Elite) et la
            police Teko du HUD des points
            (engine/orig/hud-points/hud-points.js, licence LICENCE-Teko-OFL.txt)
  images    launcher/src/renderer/launcher/assets/bg.jpg (Bunker 7, rendu du jeu), launcher/src/assets/icon.png,
            portrait d'Anthony (hud-points.js), vignettes de la Lune (game/zombie-survival.html)
  notes     launcher/config/notes-history.json (notes publiées des versions 1.0.2 à 1.5.0)"""
import base64, json, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(ICI, '..', '..'))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ICI, 'sortie')
DIRECTIONS = ['A-militaire', 'B-aaa-moderne', 'C-nouvelle-generation', 'D-hybride']
os.makedirs(OUT, exist_ok=True)
lire = lambda p: open(p, encoding='utf-8').read()
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()

# ------------------------------------------------------------------ polices
FONTS = os.path.join(REPO, 'launcher', 'src', 'renderer', 'fonts')
polices = re.sub(r"url\('([^']+\.woff2)'\)", lambda m: f"url(data:font/woff2;base64,{b64(os.path.join(FONTS, m.group(1)))})",
                 lire(os.path.join(FONTS, 'fonts.css')))
hud = lire(os.path.join(REPO, 'engine', 'orig', 'hud-points', 'hud-points.js'))
teko = re.search(r"FONT_URL = '(data:font/woff2;base64,[A-Za-z0-9+/=]+)'", hud).group(1)
polices += f"\n@font-face {{ font-family: 'ZS Teko'; font-style: normal; font-weight: 600; font-display: block; src: url({teko}) format('woff2'); }}\n"

# ------------------------------------------------------------------ images
jeu = lire(os.path.join(REPO, 'game', 'zombie-survival.html'))
images = {
    'bunker': 'data:image/jpeg;base64,' + b64(os.path.join(REPO, 'launcher', 'src', 'renderer', 'launcher', 'assets', 'bg.jpg')),
    'icone': 'data:image/png;base64,' + b64(os.path.join(REPO, 'launcher', 'src', 'assets', 'icon.png')),
    'portrait': re.search(r"PORTRAIT_ANTHONY = '(data:image/webp;base64,[A-Za-z0-9+/=]+)'", hud).group(1),
    'lune': re.search(r"LUNE\.thumb = '(data:image/jpeg;base64,[A-Za-z0-9+/=]+)'", jeu).group(1),
}
# Marécages maudits (kit 2.0.7, carte non publiée) : la capture retenue, copiée dans ce worktree (ressources/marecages/README.md)
MARAIS = os.path.join(ICI, 'ressources', 'marecages', '13_la_mere_vase_se_jette_sur_un_noye.jpg')
if os.path.exists(MARAIS):
    images['marais'] = 'data:image/jpeg;base64,' + b64(MARAIS)
else:
    print('ressources/marecages/13_la_mere_vase_se_jette_sur_un_noye.jpg absente : D prendra le fond de Bunker 7')
# la vraie scène de la Mère-Vase (scene-bete/encoder.js), si elle existe ; MARAIS_VIDEO désigne une vidéo d'essai. À
# côté : la même scène sans éclairs (réglage « Éclairs de l'orage » coupé), l'affiche (celle de la version sans éclairs
# de préférence : une image sans éclat) et la boucle (instants des éclairs : le tonnerre de D part dessus)
VIDEO = os.environ.get('MARAIS_VIDEO') or os.path.join(ICI, 'ressources', 'marecages', 'fond-marais.webm')
boucle = None
if os.path.exists(VIDEO):
    images['marais_video'] = 'data:video/webm;base64,' + b64(VIDEO)
    SANS = VIDEO[:-5] + '-sans-eclairs.webm'
    if os.path.exists(SANS):
        images['marais_video_sans'] = 'data:video/webm;base64,' + b64(SANS)
    for AFFICHE in (SANS[:-5] + '-affiche.jpg', VIDEO[:-5] + '-affiche.jpg'):
        if os.path.exists(AFFICHE):
            images['marais_affiche'] = 'data:image/jpeg;base64,' + b64(AFFICHE)
            break
    if os.path.exists(VIDEO[:-5] + '.json'):
        boucle = json.load(open(VIDEO[:-5] + '.json', encoding='utf-8'))
    print('fond vidéo :', os.path.relpath(VIDEO, ICI), '· sans éclairs :', 'oui' if 'marais_video_sans' in images else 'non',
          '· éclairs dans la boucle :', len(boucle['eclairs']) if boucle else '—')
# les sons de l'ambiance de D (pluie, tonnerre, réverbération de l'orage) : les sons calculés du kit 2.0.7, exportés par
# scene-bete/exporter-sons.js (export autorisé par Anthony le 31 octobre 2026), s'ils existent ; hors de Git
SONS_DIR = os.path.join(ICI, 'ressources', 'marecages', 'sons')
SONS_D = ['pluie-eau', 'pluie-bois', 'pluie-feuillage', 'pluie-lointain', 'orage-reverberation', 'tonnerre-sol-450', 'tonnerre-sol-900',
          'tonnerre-sol-1700', 'tonnerre-sol-3000', 'tonnerre-nuages-2000', 'tonnerre-nuages-3500']
CHAMPS_SONS = ['echantillons', 'echelle', 'boucle', 'kJeu', 't0', 'niveauJeu', 'medium_dB', 'envoiReverb', 'type', 'distance']
sons = None
if os.path.exists(os.path.join(SONS_DIR, 'sons.json')):
    doc = json.load(open(os.path.join(SONS_DIR, 'sons.json'), encoding='utf-8'))['sons']
    manque = [i for i in SONS_D if i not in doc or not os.path.exists(os.path.join(SONS_DIR, i + '.ogg'))]
    if manque:
        print('sons de l’ambiance incomplets (relancer scene-bete/exporter-sons.js) :', ', '.join(manque))
    else:
        sons = {'meta': {i: {k: doc[i][k] for k in CHAMPS_SONS if k in doc[i]} for i in SONS_D},
                'fichiers': {i: 'data:audio/ogg;base64,' + b64(os.path.join(SONS_DIR, i + '.ogg')) for i in SONS_D}}
        print(f'sons de l’ambiance (D) : {len(SONS_D)} fichiers, {sum(os.path.getsize(os.path.join(SONS_DIR, i + ".ogg")) for i in SONS_D) // 1024} Ko')
notes = json.load(open(os.path.join(REPO, 'launcher', 'config', 'notes-history.json'), encoding='utf-8'))['versions']
script = lambda js: '<script>' + js.replace('</script', '<\\/script') + '</script>'
style = lambda css: '<style>' + css.replace('</style', '<\\/style') + '</style>'
# la carte des Marécages (capture, vidéos, affiche) ne sert qu'à D : les autres directions ne la reçoivent pas
D_SEULEMENT = ('marais', 'marais_video', 'marais_video_sans', 'marais_affiche')
def prelude(d):
    imgs = images if d == 'D-hybride' else {k: v for k, v in images.items() if k not in D_SEULEMENT}
    return (style(polices) + '\n'
            + script('window.ZSM_IMG = ' + json.dumps(imgs) + ';\nwindow.ZSM_NOTES_ANCIENNES = ' + json.dumps(notes, ensure_ascii=False) + ';'))

# ------------------------------------------------------------------ assemblage
for d in DIRECTIONS:
    src = os.path.join(ICI, d)
    if not os.path.exists(os.path.join(src, 'index.html')):
        print(f'{d} : pas encore de maquette')
        continue
    html = lire(os.path.join(src, 'index.html'))
    def lien(m):
        return style(lire(os.path.normpath(os.path.join(src, m.group(1)))))
    def scr(m):
        return script(lire(os.path.normpath(os.path.join(src, m.group(1)))))
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lien, html)
    html = re.sub(r'<script src="([^"]+)"></script>', scr, html)
    propre = ''
    if d == 'D-hybride':
        propre += script('window.ZSM_SONS = ' + json.dumps(sons) + ';') if sons else ''
        propre += script('window.ZSM_FOND_BOUCLE = ' + json.dumps(boucle) + ';') if boucle else ''
    html = html.replace('<!-- ressources -->', prelude(d) + propre, 1)
    if '<!-- ressources -->' in html or 'window.ZSM_IMG' not in html:
        sys.exit(f'{d} : repère <!-- ressources --> absent ou en double')
    out = os.path.join(OUT, d + '.html')
    open(out, 'w', encoding='utf-8').write(html)
    print(f'{d}.html : {len(html) // 1024} Ko')
print('écrit dans', OUT)
