# Textures des yeux du Septième : albédo (sclère sombre injectée de sang, iris rouge sombre) et émission
# (iris rouge incandescent, plus chaud près de la pupille). Projection frontale plane : carré de 24,8 mm centré sur l'axe de l'œil
# (u = 0,5 + x / 24,8 mm, v = 0,5 + y / 24,8 mm), iris de rayon 5,9 mm, pupille 2,05 mm.
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake_lib import vnoise, fbm, save
from bskin import ss, hexc, mix

F = np.float32
OUT = os.environ.get('BAKE_OUT', 'travail/stage') + '/tex'
os.makedirs(OUT, exist_ok=True)
S = 512
u = (np.arange(S) + 0.5) / S
U, Vv = np.meshgrid(u, u)
X, Y = (U - 0.5) * 24.8, (Vv - 0.5) * 24.8
r = np.hypot(X, Y); th = np.arctan2(Y, X)
P = np.stack([X, Y, np.zeros_like(X)], -1).reshape(-1, 3).astype(F)
RI, RP = 5.9, 2.05
ri = (r / RI).ravel()
rr = r.ravel()

# --- sclère : gris-rouge sombre, vaisseaux éclatés
scl = np.tile(hexc(0x3f2624), (S * S, 1))
edge = ss(6.5, 12.0, rr)
scl = mix(scl, hexc(0x24130f), edge * 0.6)
vein_n = np.abs(fbm(P + 3.0, 0.5, 5, 4) - 0.5)
vein_n2 = np.abs(fbm(P * 2.1 + 7.0, 0.5, 6, 3) - 0.5)
veins = np.maximum(ss(0.05, 0.0, vein_n), ss(0.035, 0.0, vein_n2) * 0.7) * ss(6.2, 8.0, rr)
scl = mix(scl, hexc(0x9a1a12), np.clip(veins * 0.9, 0, 1))
scl = scl * (0.92 + 0.12 * vnoise(P, 0.9, 9)[:, None])

# --- iris : fibres radiales, anneau limbique noir
fib = vnoise(np.stack([np.cos(th).ravel() * 9.0, np.sin(th).ravel() * 9.0, ri * 2.5], 1).astype(F), 1.0, 21)
fib2 = vnoise(np.stack([np.cos(th).ravel() * 24.0, np.sin(th).ravel() * 24.0, ri * 5.0], 1).astype(F), 1.0, 22)
iris = mix(hexc(0x3c0604), hexc(0x781208), ss(0.3, 0.8, fib * 0.6 + fib2 * 0.4))
limb = ss(0.84, 1.0, ri)
iris = mix(iris, hexc(0x0c0505), limb * 0.9)
col = mix(scl, iris, ss(1.03, 0.97, ri))
col = mix(col, hexc(0x050303), ss(RP / RI + 0.03, RP / RI - 0.01, ri))
save(col.reshape(S, S, 3), f'{OUT}/oeil.webp', quality=92)

# --- émission : iris rouge incandescent (rouge-orangé près de la pupille, rouge profond au bord), vaisseaux à peine
glow_in = np.array([1.0, 0.17, 0.05], F)
glow_out = np.array([0.78, 0.02, 0.01], F)
g = mix(glow_out, glow_in, ss(0.85, 0.42, ri))
strength = (0.55 + 0.45 * ss(0.25, 0.8, fib * 0.5 + fib2 * 0.5)) * ss(1.0, 0.9, ri) * ss(RP / RI - 0.02, RP / RI + 0.08, ri)
em = g * strength[:, None]
em += np.array([0.25, 0.03, 0.01], F) * (veins * 0.5 * ss(6.0, 9.0, rr))[:, None]
em += np.array([0.12, 0.01, 0.0], F) * ss(RP / RI + 0.02, 0.0, ri)[:, None]      # fond de pupille rougeoyant
save(np.clip(em, 0, 1).reshape(S, S, 3), f'{OUT}/oeil_emission.webp', quality=90)
print('yeux :', os.path.getsize(f'{OUT}/oeil.webp') // 1024, 'Ko +', os.path.getsize(f'{OUT}/oeil_emission.webp') // 1024, 'Ko')
