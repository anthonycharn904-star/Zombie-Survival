#!/usr/bin/env python3
"""Copie le fond « Les Marécages Maudits » de la maquette D vers le launcher (launcher/src/renderer/launcher/assets/marecages/).

    python3 maquettes/launcher/scene-bete/vers-launcher.py

Copie :
- les deux vidéos de la boucle, avec et sans éclairs (encoder.js) ;
- l'affiche, une seule : les deux versions ont la même image ;
- les 11 sons que charge ambiance.js (4 nappes de pluie, la réverbération, 6 tonnerres ; boue et toit ne servent pas ;
  avec la boucle actuelle, un seul éclair à 4,4 km, seuls tonnerre-nuages-3500 et tonnerre-sol-3000 sont joués) ;
- leurs réglages, dans sons/ambiance.json : les champs utiles.
Publication de ces ressources autorisée par Anthony le 2 novembre 2026, après l'export des sons (31 octobre 2026) et la
capture de la scène (2 novembre 2026).

Contrôles, sinon arrêt (code 2), avant toute copie :
- aucune vidéo ni affiche ne manque ;
- les deux chronologies (.json) concordent : fps, images, fondu, durée ;
- les deux affiches sont identiques ;
- aucun son ne manque.
Affiche la chronologie à reporter dans MARAIS (launcher.js) et les empreintes. Les originaux ne sont pas touchés. """
import hashlib, json, os, shutil, sys

ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(ICI, '..', 'ressources', 'marecages'))
DST = os.path.normpath(os.path.join(ICI, '..', '..', '..', 'launcher', 'src', 'renderer', 'launcher', 'assets', 'marecages'))
SONS = ['pluie-eau', 'pluie-bois', 'pluie-feuillage', 'pluie-lointain', 'orage-reverberation', 'tonnerre-sol-450', 'tonnerre-sol-900',
        'tonnerre-sol-1700', 'tonnerre-sol-3000', 'tonnerre-nuages-2000', 'tonnerre-nuages-3500']
CHAMPS = ['echantillons', 'echelle', 'boucle', 'kJeu', 't0', 'niveauJeu', 'medium_dB', 'envoiReverb', 'type', 'distance']


def refus(m):
    print('refusé :', m)
    sys.exit(2)


def empreinte(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def lire(p):
    if not os.path.exists(p):
        refus(f'fichier absent : {os.path.relpath(p, SRC)}')
    return json.load(open(p, encoding='utf-8'))


avec, sans = lire(os.path.join(SRC, 'fond-marais.json')), lire(os.path.join(SRC, 'fond-marais-sans-eclairs.json'))
for k in ('fps', 'images', 'fondu', 'duree'):
    if avec.get(k) != sans.get(k):
        refus(f'chronologies différentes ({k} : {avec.get(k)} et {sans.get(k)})')
for a in ('fond-marais.webm', 'fond-marais-sans-eclairs.webm', 'fond-marais-affiche.jpg', 'fond-marais-sans-eclairs-affiche.jpg'):
    if not os.path.isfile(os.path.join(SRC, a)):
        refus(f'fichier absent : {a}')
if empreinte(os.path.join(SRC, 'fond-marais-affiche.jpg')) != empreinte(os.path.join(SRC, 'fond-marais-sans-eclairs-affiche.jpg')):
    refus('les deux affiches diffèrent')
doc = lire(os.path.join(SRC, 'sons', 'sons.json'))
manque = [i for i in SONS if i not in doc['sons'] or not os.path.exists(os.path.join(SRC, 'sons', i + '.ogg'))]
if manque:
    refus('sons absents : ' + ', '.join(manque))

os.makedirs(os.path.join(DST, 'sons'), exist_ok=True)
copies = [('fond-marais.webm', 'fond-marais.webm'), ('fond-marais-sans-eclairs.webm', 'fond-marais-sans-eclairs.webm'),
          ('fond-marais-affiche.jpg', 'fond-marais-affiche.jpg')] + [(f'sons/{i}.ogg', f'sons/{i}.ogg') for i in SONS]
for a, b in copies:
    shutil.copyfile(os.path.join(SRC, a), os.path.join(DST, b))
ambiance = {
    'origine': 'sons calculés par le jeu du kit 2.0.7 (pluie, orage), exportés par maquettes/launcher/scene-bete/exporter-sons.js',
    'autorisation': 'export : Anthony, 31 octobre 2026 ; publication dans le launcher : Anthony, 2 novembre 2026',
    'source': doc.get('source', {}),
    'fs': doc.get('fs', 48000),
    'sons': {i: {k: doc['sons'][i][k] for k in CHAMPS if k in doc['sons'][i]} for i in SONS},
}
with open(os.path.join(DST, 'sons', 'ambiance.json'), 'w', encoding='utf-8') as f:
    json.dump(ambiance, f, ensure_ascii=False, indent=1)
    f.write('\n')

total = 0
for _, b in copies + [(None, 'sons/ambiance.json')]:
    p = os.path.join(DST, b)
    total += os.path.getsize(p)
    print(f'{b:40} {os.path.getsize(p):>9} octets  {empreinte(p)[:16]}…')
print(f'total : {total / 1e6:.2f} Mo dans {os.path.relpath(DST, os.getcwd())}')
print('chronologie à reporter dans MARAIS (launcher.js) :', json.dumps({k: avec[k] for k in ('fps', 'images', 'fondu', 'duree', 'eclairs')}, ensure_ascii=False))
