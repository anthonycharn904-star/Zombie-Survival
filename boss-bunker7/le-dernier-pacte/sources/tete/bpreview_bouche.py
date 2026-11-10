# Aperçu de la bouche : maillage d'aperçu + dents + langue, bouche fermée (0) ou ouverte (1).
# python3 bpreview_bouche.py ouverture(0..1) sortie.bin [maillage.bin source déjà calculé]
import sys, os, json, struct, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmodel as HM, bbouche as BB
from mesh import mesh_normals, write_preview

k = float(sys.argv[1]); dest = sys.argv[2]; src = sys.argv[3] if len(sys.argv) > 3 else 'travail/prev.bin'
buf = open(src, 'rb').read()
hl = struct.unpack('<I', buf[:4])[0]; hdr = json.loads(buf[4:4 + hl]); o = 4 + hl
nv, nf = hdr['nv'], hdr['nf']
P = np.frombuffer(buf, np.float32, nv * 3, o).reshape(-1, 3).astype(np.float64); o += nv * 12 + nv * 12
I = np.frombuffer(buf, np.uint32, nf * 3, o).reshape(-1, 3).astype(np.int64)
P = (P - np.asarray(HM.HEAD_ORIGIN)) * 1000.0
P = P + k * BB.jaw_delta(P)
Vh, Ih, _ = BB.teeth('haut'); Vb, Ib, _ = BB.teeth('bas'); Vt, It = BB.tongue()
Vb = BB.rotate(Vb, HM.JAW_ANGLE * k); Vt = BB.rotate(Vt, HM.JAW_ANGLE * k)
V = np.vstack([P, Vh, Vb, Vt]); n0 = len(P)
F = np.vstack([I, Ih.reshape(-1, 3) + n0, Ib.reshape(-1, 3) + n0 + len(Vh), It.reshape(-1, 3) + n0 + len(Vh) + len(Vb)])
N = mesh_normals(V, F)
write_preview(dest, V, F, N, scale=0.001, origin=HM.HEAD_ORIGIN, extra={'eyeX': HM.EYE_X, 'eyeR': HM.EYE_R, 'origin': list(HM.HEAD_ORIGIN)})
print('ok', len(V), len(F))
