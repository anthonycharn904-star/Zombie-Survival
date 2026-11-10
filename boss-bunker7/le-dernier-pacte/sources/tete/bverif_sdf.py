# Contrôle de continuité de la SDF : compare les normales calculées à petite et grande échelle sur des
# points de surface (sommets d'aperçu). Un saut localisé hors des arêtes vives voulues = boîte de région trop serrée.
import sys, os, json, struct, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmodel as HM
from mesh import sdf_normals
src = sys.argv[1] if len(sys.argv) > 1 else 'travail/prev.bin'
buf = open(src, 'rb').read(); hl = struct.unpack('<I', buf[:4])[0]; hdr = json.loads(buf[4:4 + hl]); o = 4 + hl
P = np.frombuffer(buf, np.float32, hdr['nv'] * 3, o).reshape(-1, 3).astype(np.float64)
P = (P - np.asarray(HM.HEAD_ORIGIN)) * 1000.0
FN = getattr(HM, os.environ.get("SDF", "head_sdf_coarse"))
n1 = sdf_normals(FN, P, e=0.06)
n2 = sdf_normals(FN, P, e=0.8)
dev = np.degrees(np.arccos(np.clip((n1 * n2).sum(1), -1, 1)))
bad = dev > 25
print('sommets :', len(P), ' écart > 25° :', bad.sum())
# regroupe par zones grossières (cellules de 8 mm) pour localiser
cells = {}
for p in P[bad]:
    k = tuple((p // 8).astype(int))
    cells[k] = cells.get(k, 0) + 1
top = sorted(cells.items(), key=lambda kv: -kv[1])[:25]
print('cellules (x,y,z en mm/8) :', [(tuple(int(c) * 8 for c in k), v) for k, v in top])
