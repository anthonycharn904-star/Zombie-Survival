# Empaquetage de la tête du Septième (boss de Bunker 7) : BOSS_B7_TETE (contrat : boss/DESIGN.md, « Contrat de données de la tête »).
# python3 bpack.py [sortie.js]
import sys, os, json, base64, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmodel as HM, bbouche as BB

STAGE = os.environ.get('BAKE_OUT', 'travail/stage')
dest = sys.argv[1] if len(sys.argv) > 1 else 'out/boss-tete.js'
S = np.load(f'{STAGE}/stage.npz')
V, N, FI, UV = S['V'].astype(np.float64), S['N'], S['FI'], S['UV']
O = np.asarray(HM.HEAD_ORIGIN)
b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
M = lambda Pmm: np.asarray(Pmm, np.float64) * 0.001 + O          # repère tête (mm) → corps (m)

# --- géométrie quantifiée (positions dans le repère du corps, en mètres)
Pm = M(V)
lo_b, hi_b = Pm.min(0), Pm.max(0)
q = np.round((Pm - lo_b) / (hi_b - lo_b) * 65535).astype(np.uint16)
nq = np.round(np.clip(N, -1, 1) * 127).astype(np.int8)
uq = np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)
iq = FI.astype(np.uint16) if len(V) < 65536 else FI.astype(np.uint32)

# --- morphose « bouche ouverte » (deltas en 1/100 mm)
delta = BB.jaw_delta(V)
moved = np.linalg.norm(delta, axis=1) > 0.01
bi = np.nonzero(moved)[0].astype(np.uint16 if len(V) < 65536 else np.uint32)
bd = np.round(delta[moved] * 100).astype(np.int16)
print('morphose : sommets', moved.sum(), '/', len(V), ' déplacement max %.1f mm' % np.linalg.norm(delta, axis=1).max())

# --- poids de peau suggérés (os head / neck / chest du squelette du boss) : visage et crâne → head,
#     cou sous la ligne de la mâchoire → neck puis chest (bas du cou, caché par le col)
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)
hy, hz = V[:, 1], V[:, 2]
jaw_line = -121.0 + 0.40 * np.maximum(15.0 - hz, 0.0)
wh = sstep(-18.0, 4.0, hy - jaw_line)
yb = Pm[:, 1]
wc = (1.0 - wh) * (1.0 - sstep(1.39, 1.45, yb))
wn = 1.0 - wh - wc
W8 = np.round(np.stack([wh, wn, wc], 1) * 255).astype(np.int32)
W8[:, 1] += 255 - W8.sum(1)                      # somme exacte = 255
W8 = np.clip(W8, 0, 255).astype(np.uint8)

# --- dents et langue (repère du corps, m)
Vh, Ih, Ch = BB.teeth('haut')
Vb, Ib, Cb = BB.teeth('bas')
Vt, It = BB.tongue()
r4 = lambda a: np.round(np.asarray(a, np.float64), 5).ravel().tolist()
dents = {
    'haut': {'v': r4(M(Vh)), 'i': Ih.astype(int).tolist(), 'c': np.round(Ch, 3).tolist()},
    'bas': {'v': r4(M(Vb)), 'i': Ib.astype(int).tolist(), 'c': np.round(Cb, 3).tolist(),
            'vOuvert': r4(M(BB.rotate(Vb, HM.JAW_ANGLE)))},
    'couleur': '#7d6e51'
}
cavite = {'v': r4(M(Vt)), 'i': It.astype(int).tolist(), 'vOuvert': r4(M(BB.rotate(Vt, HM.JAW_ANGLE))), 'couleur': '#3a1a1c'}

TEX = f'{STAGE}/tex'


def tex(name):
    p = f'{TEX}/{name}'
    mime = 'image/jpeg' if name.endswith('.jpg') else 'image/webp'
    return f'data:{mime};base64,' + base64.b64encode(open(p, 'rb').read()).decode()


eyeL = (O + np.array([HM.EYE_X, 0.0, 0.0]) * 0.001).round(6).tolist()
eyeR = (O + np.array([-HM.EYE_X, 0.0, 0.0]) * 0.001).round(6).tolist()
D = {
    'version': 1, 'nom': 'tete du Septieme (boss de Bunker 7)',
    'nv': int(len(V)), 'nf': int(len(FI)),
    'bbox': [*lo_b.round(6).tolist(), *hi_b.round(6).tolist()],
    'origin': list(HM.HEAD_ORIGIN),
    'eye': {'x': HM.EYE_X / 1000, 'r': HM.EYE_R / 1000, 'lid': HM.LID_RI / 1000,
            'amande': {'rr': 15.5, 'cm': list(HM.CM), 'cl': list(HM.CL), 'hUp': HM.H_UP, 'hLo': HM.H_LO, 'unite': 'mm'}},
    'pos': b64(q), 'nrm': b64(nq), 'uv': b64(uq), 'idx': b64(iq),
    'tex': {'albedo': tex('tete_albedo.webp'), 'normal': tex('tete_normales.jpg'), 'orm': tex('tete_orm.webp'),
            'emission': tex('tete_emission.webp'), 'oeil': tex('oeil.webp'), 'oeilEmission': tex('oeil_emission.webp')},
    'bouche': {'idx': b64(bi), 'delta': b64(bd), 'n': int(moved.sum())},
    'machoire': {'pivot': M(np.array([HM.JAW_PIVOT]))[0].round(6).tolist(), 'axe': [1.0, 0.0, 0.0], 'angle': HM.JAW_ANGLE},
    'dents': dents,
    'cavite': cavite,
    'caviteBas': list(range(len(Vt))),
    'yeux': {'gauche': eyeL, 'droit': eyeR, 'rayon': HM.EYE_R / 1000},
    'peau': {'os': ['head', 'neck', 'chest'], 'poids': b64(W8), 'note': '3 octets par sommet, somme 255'},
    'cou': {'yBas': round(O[1] + HM.NECK_Y / 1000, 4), 'rayonBas': 0.0535, 'centreZ': round(O[2] - 0.098, 4), 'ferme': True},
    'orm': {'r': 'occlusion', 'g': 'rugosite', 'b': 'metal (agrafes)'}
}
js = ('// Tête du Septième, boss de Bunker 7 — personnage inventé (sculpture SDF cuite hors ligne : maillage, UV, textures,\n'
      '// morphose de mâchoire).\n'
      '// Généré par boss/tete/bpack.py — ne pas éditer à la main. Contrat : boss/tete/out/CONTRAT.md\n'
      '(function (root) {\n  var D = ' + json.dumps(D, separators=(',', ':')) + ';\n'
      '  root.BOSS_B7_TETE = D;\n  if (typeof module !== "undefined" && module.exports) module.exports = D;\n'
      '})(typeof globalThis !== "undefined" ? globalThis : this);\n')
os.makedirs(os.path.dirname(dest) or '.', exist_ok=True)
open(dest, 'w').write(js)
print(dest, len(js) // 1024, 'Ko ;', len(V), 'sommets,', len(FI), 'triangles ; dents', len(Vh) + len(Vb), 'sommets ; langue', len(Vt))
