"""Effets sonores du boss de Bunker 7 — tout est synthétisé ici.
Usage : python3 effets.py            (tous)
        python3 effets.py cle1 cle2  (seulement ceux-là)
Chaque recette renvoie un signal (mono ou stéréo, 48 kHz) ; l'export normalise, limite, encode et décrit."""
import sys, os, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.dsp import SR, secs, mtof, saw, pulse, sine, lp, bp, hp, svf, butter_hp, butter_lp, peak_eq, shelf, \
    smooth_noise, noise, saturate, env_perc, env_adsr, limiter
from lib import instr as I
from lib.voix import voix, murmures, rugissement, courbe, formants
from lib.sfx import *
from lib.sortie import exporter

REG = {}


def effet(cle, *, stereo=False, cible=-14.0, mesure='M', pic=None, boucle=False, cat='effet', desc='', notes=None):
    def deco(fn):
        REG[cle] = dict(fn=fn, stereo=stereo, cible=cible, mesure=mesure, pic=pic, boucle=boucle, cat=cat, desc=desc, notes=notes)
        return fn
    return deco


def coupe(x, L, fin=0.06):
    """Ajuste à L secondes avec un fondu de sortie."""
    return fondu(ajuste(x, secs(L)), 0.0, fin)


def mono(x):
    return x.mean(axis=0) if x.ndim == 2 else x


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-12)


def S(*xs):
    """Somme de signaux de longueurs différentes (alignés au début) ; passe en stéréo si l'un l'est."""
    st = any(np.asarray(x).ndim == 2 for x in xs)
    n = max(np.asarray(x).shape[-1] for x in xs)
    out = np.zeros((2, n)) if st else np.zeros(n)
    for x in xs:
        x = np.asarray(x)
        if st and x.ndim == 1:
            out[:, :len(x)] += x
        else:
            out[..., :x.shape[-1]] += x
    return out


def ech(x, f):
    """Change la vitesse (et la hauteur) d'un signal mono par rééchantillonnage."""
    from scipy.signal import resample
    n = int(len(x) / f)
    return resample(x, n)


# ════════════════════════════ BOSS : vocalises ════════════════════════════

@effet('boss_apparition', stereo=True, cible=-10, pic=1.4, desc="Matérialisation du boss : souffle inversé, impact grave, rugissement distordu")
def boss_apparition():
    L = 3.5; n = secs(L); out = np.zeros((2, n))
    # 0 → 1,4 s : montée (souffle aspiré, murmures qui tournent, sous-grave qui monte, réverbération inversée)
    asp = aspiration(1.4, 3, 150, 5200, fin_net=True)
    place(out, stereo_large(asp, 1, 0.8), 0.0, 0.55)
    mur = murmures(1.4, voix_n=5, debit=8, graine=11, stereo=True, env=[(0, 0), (0.9, 0.7), (1.38, 1.0), (1.4, 0)])
    place(out, mur, 0.0, 0.35)
    m = secs(1.4); t = np.arange(m) / SR
    sub = np.sin(2 * np.pi * np.cumsum(28 + 30 * (t / 1.4) ** 2) / SR) * (t / 1.4) ** 2
    place(out, sub, 0.0, 0.45)
    burst = lp(rose(secs(0.3), 4), 3000) * np.exp(-np.arange(secs(0.3)) / SR / 0.05)
    inv = salle(burst, 2.4, 0.9, 0.01, 5, stereo_out=True)[:, ::-1]
    inv = inv[:, -secs(1.4):] if inv.shape[1] > secs(1.4) else inv
    place(out, inv * 0.8, 1.4 - inv.shape[1] / SR)
    # 1,4 s : impact
    imp = S(chute_grave(2.0, 120, 30, 0.07, 0.6) * 1.1, coup_sourd(0.7, 62, 0.14, 7, 0.8))
    crack = hp(noise(secs(0.08), 8), 1800) * np.exp(-np.arange(secs(0.08)) / SR / 0.012)
    imp[:len(crack)] += crack * 0.7
    cl = I.anvil(310, 0.6, 1.6, 9) * 0.35
    imp[:len(cl)] += cl
    imp = saturate(imp * 1.4, 1.6)
    place(out, salle(imp, 2.8, 0.35, 0.02, 6, stereo_out=True), 1.4)
    # rugissement distordu
    rug = rugissement(1.95, base=72, graine=21, cri=0.5, grave=1.15)
    rug = saturate(rug * 1.6, 2.2) * 0.8
    place(out, salle(stereo_large(rug, 2, 0.7), 2.6, 0.3, 0.02, 7), 1.46, 0.9)
    return coupe(out, L, 0.25)


@effet('boss_rugissement', cible=-10, desc="Rugissement de colère : couches graves rauques + cri aigu, salle sombre")
def boss_rugissement():
    r = rugissement(1.9, base=86, graine=31, cri=0.42)
    inspire = voix(0.22, [(0, 70), (0.22, 80)], [(0, 'O'), (0.22, 'a')], echelle=0.7, rauque=0.2, souffle=1.5,
                   env=[(0, 0), (0.15, 0.3), (0.22, 0.1)], graine=32) * 0.5
    x = np.concatenate([inspire, r])
    x = peak_eq(x, 120, 3, 0.8)
    x = peak_eq(x, 2600, 2, 1.0)
    return coupe(salle(x, 1.8, 0.2, 0.012, 8), 2.0, 0.15)


@effet('boss_douleur_1', cible=-13, desc="Cri de douleur (variante 1)")
def boss_douleur_1():
    L = 1.3
    a = voix(L, [(0, 170), (0.1, 255), (0.45, 270), (0.9, 190), (1.3, 130)], [(0, 'a'), (0.5, 'a'), (0.9, 'o'), (1.3, 'u')],
             echelle=0.86, rauque=0.45, sous=0.25, souffle=0.45, gigue=0.03, graine=41,
             env=[(0, 0), (0.035, 1.0), (0.4, 0.85), (0.9, 0.45), (1.25, 0.0)])
    b = voix(L, [(0, 520), (0.12, 690), (0.5, 640), (1.0, 380)], [(0, 'a'), (0.6, 'E'), (1.3, 'a')], echelle=1.05,
             rauque=0.3, souffle=0.6, gigue=0.035, graine=42, env=[(0, 0), (0.05, 0.8), (0.45, 0.6), (1.0, 0.0)]) * 0.45
    g = voix(L, [(0, 85), (1.3, 65)], [(0, 'a'), (1.3, 'o')], echelle=0.7, rauque=0.6, sous=0.5, souffle=0.3, graine=43,
             env=[(0, 0), (0.04, 0.6), (0.6, 0.4), (1.2, 0)]) * 0.5
    x = saturate(norm(a + b + g) * 1.5, 1.4)
    return coupe(salle(x, 1.5, 0.18, 0.01, 9), L, 0.1)


@effet('boss_douleur_2', cible=-13, desc="Cri de douleur (variante 2) : souffle coupé puis cri étranglé")
def boss_douleur_2():
    L = 1.05
    gasp = voix(0.16, [(0, 120), (0.16, 140)], [(0, 'O'), (0.16, 'a')], echelle=0.8, rauque=0.3, souffle=2.0,
                env=[(0, 0), (0.06, 1.0), (0.16, 0.0)], graine=51) * 0.5
    a = voix(0.89, [(0, 230), (0.08, 330), (0.35, 310), (0.89, 175)], [(0, 'E'), (0.3, 'a'), (0.89, 'O')], echelle=0.9,
             rauque=0.55, sous=0.35, souffle=0.5, gigue=0.045, scintil=0.25, graine=52,
             env=[(0, 0), (0.03, 1.0), (0.3, 0.8), (0.75, 0.3), (0.89, 0)])
    lo = voix(0.89, [(0, 115), (0.89, 85)], [(0, 'a'), (0.89, 'o')], echelle=0.7, rauque=0.7, sous=0.6, souffle=0.3, graine=53,
              env=[(0, 0), (0.03, 0.7), (0.5, 0.5), (0.85, 0)]) * 0.55
    x = np.concatenate([gasp, saturate(norm(a + lo) * 1.6, 1.5)])
    return coupe(salle(x, 1.4, 0.18, 0.01, 10), L, 0.08)


@effet('boss_souffle', cible=-22, mesure='I', boucle=True, cat='boucle', desc="Respiration rauque surnaturelle (boucle 4 s)")
def boss_souffle():
    L = 4.0; X = 0.35
    n = secs(L + X); out = np.zeros(n)
    # inspiration rauque (1,5 s) : souffle + friture vocale
    ins = voix(1.5, [(0, 38), (1.5, 44)], [(0, 'O'), (0.7, 'u'), (1.5, 'O')], echelle=0.68, rauque=0.8, sous=0.4,
               souffle=2.2, oq=0.75, graine=61, env=[(0, 0), (0.4, 0.55), (1.2, 0.8), (1.5, 0)])
    place(out, ins, 0.15)
    # expiration grondante (2,1 s)
    exp_ = voix(2.1, [(0, 58), (0.6, 62), (2.1, 42)], [(0, 'a'), (1.0, 'o'), (2.1, 'u')], echelle=0.66, rauque=0.65,
                sous=0.5, souffle=1.4, graine=62, env=[(0, 0), (0.15, 1.0), (1.2, 0.7), (2.1, 0)])
    place(out, exp_, 1.75)
    out = salle(out, 1.2, 0.12, 0.01, 11)[:n]
    return boucle_fondue(out, L, X)


@effet('boss_impact_balle', cible=-18, desc="Balle qui touche le boss : chair + crépitement d'énergie")
def boss_impact_balle():
    L = 0.25
    c = chair(L, 101, mouille=0.8, grave=0.55)
    tt = np.arange(secs(L)) / SR
    c += bp(rose(secs(L), 103), 1200, 0.9) * np.exp(-tt / 0.012) * 0.9      # claque
    cr = crepitement(0.14, 160, 102, 2500, 9000, [(0, 1), (0.14, 0.1)], bourdon=0.25, f_bourdon=110) * 0.45
    x = c.copy(); x[:len(cr)] += cr
    return coupe(x, L, 0.05)


@effet('boss_immunise', cible=-17, desc="Balle déviée par le bouclier : ricochet cristallin")
def boss_immunise():
    L = 0.35; n = secs(L); t = np.arange(n) / SR
    ping = modes(L, 2650, [1.0, 1.47, 2.09, 2.56, 3.91], [1.0, 0.6, 0.5, 0.35, 0.2], [0.16, 0.11, 0.08, 0.06, 0.04], 111, 0.7, 6000, 0.001)
    sif = np.sin(2 * np.pi * np.cumsum(3900 * np.exp(-t / 0.09) + 2100) / SR) * np.exp(-t / 0.07) * 0.25
    sc = scintillement(L, 6500, 10, 112, 0.4, [(0, 1), (L, 0)]) * 0.35
    th = coup_sourd(0.15, 140, 0.02, 113, 0.2) * 0.4
    x = ping + sif + sc
    x[:len(th)] += th
    return coupe(salle(x, 0.9, 0.12, 0.005, 12, sombre=False), L, 0.05)


# ════════════════════════════ PHASE 1 ════════════════════════════

@effet('incantation_charge', cible=-14, desc="Énergie qui se forme dans les mains : murmures, chœur qui monte, crépitements (finit au sommet)")
def incantation_charge():
    L = 1.2; n = secs(L); out = np.zeros(n)
    mur = murmures(L, voix_n=4, debit=8, graine=121, env=[(0, 0.2), (0.8, 0.7), (1.15, 1.0), (1.2, 0)])
    out += mur * 0.55
    for i, (f0, f1) in enumerate([(110, 147), (147, 208), (196, 277)]):   # grappe qui monte (quarte + triton)
        out += voix(L, [(0, f0), (L, f1)], [(0, 'u'), (0.7, 'o'), (L, 'a')], echelle=0.92, rauque=0.15, souffle=0.7,
                    gigue=0.01, graine=122 + i, env=[(0, 0), (0.5, 0.35), (1.15, 1.0), (1.2, 0)]) * 0.45
    out += crepitement(L, 70, 125, 2000, 9000, [(0, 0.1), (0.8, 0.6), (1.2, 1.0)], bourdon=0.25, f_bourdon=73) * 0.6
    t = np.arange(n) / SR
    out += np.sin(2 * np.pi * np.cumsum(40 + 25 * t / L) / SR) * (t / L) ** 2 * 0.5
    out += souffle(L, 400, 5000, 0.95, 1.4, 126) * 0.35
    out = saturate(norm(out) * 1.2, 1.2)
    out[-secs(0.03):] *= np.linspace(1, 0, secs(0.03))
    return out


@effet('incantation_lancer', cible=-13, pic=0.03, desc="Libération du sort : souffle et éclat")
def incantation_lancer():
    L = 0.6; n = secs(L)
    w = souffle(L, 3200, 380, 0.08, 1.0, 131) * 1.2
    th = coup_sourd(0.45, 65, 0.09, 132, 0.6)
    cr = crepitement(0.35, 140, 133, 2000, 9000, [(0, 1), (0.35, 0)]) * 0.5
    sc = scintillement(0.4, 3500, 10, 134, 0.5, [(0, 1), (0.4, 0)]) * 0.3
    x = w.copy(); x[:len(th)] += th; x[:len(cr)] += cr; x[:len(sc)] += sc
    return coupe(salle(saturate(x, 1.3), 1.2, 0.15, 0.008, 13), L, 0.08)


@effet('projectile_boucle', cible=-18, mesure='I', boucle=True, cat='boucle', desc="Projectile magique en vol (boucle 1 s)")
def projectile_boucle():
    L = 1.0; n = secs(L); t = np.arange(n) / SR
    f1, f2 = frequence_boucle(110, L), frequence_boucle(55, L)
    fm = np.sin(2 * np.pi * f1 * t + 3.0 * np.sin(2 * np.pi * f2 * t))
    buzz = sum(np.sin(2 * np.pi * frequence_boucle(82 * k, L) * t) / k for k in range(1, 18))
    buzz = buzz * am_boucle(L, 12, 0.35)
    hiss = bruit_periodique(n, bande(700, 2600, 2.0), 141) * am_boucle(L, 3, 0.4)
    rum = bruit_periodique(n, bande(60, 260, 2.0), 142)
    x = 0.5 * fm + 0.25 * buzz / 3 + 0.5 * hiss + 0.4 * rum
    # crépitements placés de façon circulaire
    cr = crepitement(1.3, 25, 143, 2500, 9000) * 0.6
    x += boucle_circulaire(cr, L)
    return x


@effet('impact_magique', cible=-10, pic=0.005, desc="Impact du sort au sol : explosion grave, anneau magique, crépitements")
def impact_magique():
    L = 1.5; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 151, (105, 34), 0.6, 150, 1.0, 0.55, 0.6)
    ring = modes(1.2, 520, [1.0, 1.5, 2.24, 2.92, 3.71, 4.6], [1.0, 0.6, 0.45, 0.3, 0.2, 0.12], [0.5, 0.35, 0.25, 0.18, 0.12, 0.08], 153, 0.3, 4000, 0.004)
    place(out, ring * 0.35, 0.0)
    place(out, crepitement(0.9, 90, 154, 1800, 9000, [(0, 1.0), (0.9, 0.0)], bourdon=0.3, f_bourdon=73) * 0.45, 0.02)
    place(out, debris(1.2, 25, 155, 0.05, 0.6, 1200, 6000) * 0.35, 0.0)
    out = saturate(out * 1.3, 1.5)
    return coupe(salle(out, 2.2, 0.3, 0.015, 14), L, 0.25)


@effet('zone_maudite', cible=-22, mesure='I', boucle=True, cat='boucle', desc="Bourdonnement d'une zone dangereuse (boucle 2 s)")
def zone_maudite():
    L = 2.0; n = secs(L); t = np.arange(n) / SR
    f0 = frequence_boucle(73.5, L)
    dr = bourdon_harmonique(L, f0, (1, 2, 3, 4, 5, 7), [1, 0.6, 0.45, 0.3, 0.2, 0.12], 161, battement=0.5, boucle=True)
    tri = np.sin(2 * np.pi * frequence_boucle(f0 * 1.414, L) * t) * 0.25 + np.sin(2 * np.pi * frequence_boucle(f0 * 2.828, L) * t) * 0.12
    siz = bruit_periodique(n, bande(2500, 9000, 2.0), 162) * am_boucle(L, 6, 0.6) * 0.18
    gr = bruit_periodique(n, bande(40, 180, 2.0), 163) * 0.4
    x = (dr * 0.5 + tri) * am_boucle(L, 2, 0.35) + siz + gr
    return circulaire(lambda y: saturate(y * 0.8, 1.2), x)


@effet('zombie_emergence', cible=-14, desc="Zombie qui sort du sol : sol qui craque, terre, grondement, râle")
def zombie_emergence():
    L = 1.6; n = secs(L); out = np.zeros(n)
    place(out, pierre_fracture(1.1, [(0, 20), (0.3, 160), (0.7, 220), (1.1, 30)], 171, 350, 2600, 0.45, 1.2), 0.0)
    terre = lp(rose(n, 172), 1300, 0.7) * env([(0, 0), (0.25, 0.6), (0.8, 1.0), (1.3, 0.3), (1.6, 0)], n)
    terre *= 1 + 0.8 * np.tanh(2 * smooth_noise(n, 25, 173))
    out += terre * 0.5
    out += grondement(L, 174, 110, 0.9, [(0, 0), (0.2, 1), (1.0, 0.8), (1.6, 0)]) * 0.9
    place(out, debris(1.2, 35, 175, 0.1, 0.9, 300, 1800, 1) * 0.6, 0.15)
    rale = voix(0.9, [(0, 92), (0.3, 122), (0.9, 84)], [(0, 'O'), (0.35, 'a'), (0.9, 'u')], echelle=0.82, rauque=0.6,
                sous=0.3, souffle=0.6, gigue=0.03, graine=176, env=[(0, 0), (0.12, 0.9), (0.6, 0.7), (0.9, 0)])
    place(out, rale * 0.55, 0.72)
    return coupe(salle(saturate(out, 1.2), 1.6, 0.2, 0.01, 15), L, 0.1)


@effet('trait_maudit', cible=-14, pic=0.01, desc="Projectile direct : sifflement qui file, trainée d'étincelles")
def trait_maudit():
    L = 0.8; n = secs(L); t = np.arange(n) / SR
    f = 2300 * np.exp(-t / 0.35) + 700
    sif = (np.sin(2 * np.pi * np.cumsum(f * (1 + 0.004 * np.sin(2 * np.pi * 31 * t))) / SR) * 0.6 +
           np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.2) * env([(0, 0), (0.01, 1), (0.5, 0.6), (0.8, 0)], n)
    hiss = hp(rose(n, 181), 2500) * env([(0, 0), (0.005, 1), (0.3, 0.4), (0.8, 0)], n) * 0.5
    th = coup_sourd(0.25, 90, 0.04, 182, 0.7) * 0.6
    cr = crepitement(L, 50, 183, 3000, 9000, [(0, 1), (0.8, 0.1)]) * 0.3
    x = sif + hiss + cr; x[:len(th)] += th
    return coupe(salle(x, 1.0, 0.15, 0.008, 16), L, 0.08)


# ════════════════════════════ PHASE 2 ════════════════════════════

@effet('absorption_debut', cible=-14, desc="Début de l'absorption : aspiration, chœur qui inspire")
def absorption_debut():
    L = 1.5; n = secs(L); out = np.zeros(n)
    out += aspiration(L, 191, 180, 4000, fin_net=False) * env([(0, 0.2), (1.2, 1.0), (1.5, 0.6)], n) * 0.7
    for i, f in enumerate([98, 131, 147, 196]):
        out += voix(L, [(0, f), (L, f * 1.06)], [(0, 'a'), (0.8, 'o'), (L, 'u')], echelle=0.9, rauque=0.15, souffle=2.5,
                    graine=192 + i, env=[(0, 0), (0.6, 0.6), (1.3, 1.0), (1.5, 0.7)]) * 0.25
    t = np.arange(n) / SR
    out += np.sin(2 * np.pi * np.cumsum(32 + 22 * t / L) / SR) * (t / L) * 0.35
    sc = scintillement(L, 2800, 12, 196, 0.6, [(0, 0), (1.5, 1)]) * 0.15
    out = out + sc
    return coupe(salle(out, 1.8, 0.2, 0.01, 17), L, 0.1)


@effet('ame_extraction', cible=-14, desc="Âme arrachée : cri éthéré court")
def ame_extraction():
    L = 0.9; n = secs(L); t = np.arange(n) / SR
    a = voix(L, [(0, 860), (0.15, 1240), (0.5, 1180), (0.9, 690)], [(0, 'i'), (0.4, 'E'), (0.9, 'i')], echelle=1.18,
             rauque=0.08, souffle=0.9, gigue=0.03, graine=201, env=[(0, 0), (0.05, 1.0), (0.45, 0.7), (0.85, 0)])
    b = np.sin(2 * np.pi * np.cumsum(1700 + 900 * np.sin(np.pi * t / L)) / SR) * env([(0, 0), (0.08, 0.5), (0.6, 0.3), (0.9, 0)], n)
    c = voix(L, [(0, 430), (0.2, 620), (0.9, 345)], [(0, 'u'), (0.9, 'o')], echelle=1.0, souffle=1.2, graine=202,
             env=[(0, 0), (0.06, 0.5), (0.5, 0.35), (0.9, 0)]) * 0.5
    x = a + b * 0.3 + c
    # réverbération inversée : l'âme est « aspirée » juste avant le cri
    rv = salle(x[:secs(0.3)], 1.0, 1.0, 0.0, 18)[::-1]
    pre = secs(0.14)
    out = np.zeros(pre + n)
    out[:pre] += rv[-pre:] * 0.5 * np.linspace(0, 1, pre) ** 2
    out[pre:] += x
    return coupe(salle(out, 1.6, 0.3, 0.01, 19, sombre=False), L, 0.12)


@effet('ame_arrivee', cible=-15, pic=0.004, desc="Âme absorbée par le boss : choc sourd + scintillement")
def ame_arrivee():
    L = 0.7; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 211, (85, 40), 0.45, 165, 0.6, 0.0, 0.0, dec_sub=0.18) * 0.9
    out += scintillement(L, 4200, 14, 212, 0.5, [(0, 1.0), (0.12, 0.6), (0.7, 0)]) * 0.35
    out += ajuste(crepitement(0.3, 80, 213, 3000, 9000, [(0, 1), (0.3, 0)]), n) * 0.25
    return coupe(salle(out, 1.4, 0.2, 0.008, 20), L, 0.1)


@effet('ailes_deploiement', cible=-12, pic=0.5, desc="Ailes qui se déploient : tension de la membrane, claquement, déflagration d'énergie")
def ailes_deploiement():
    L = 1.8; n = secs(L); out = np.zeros(n)
    # 0 → 0,5 : craquements de membrane qui se tend, inspiration, grondement
    creak = pierre_fracture(0.5, [(0, 30), (0.4, 140), (0.5, 60)], 221, 180, 900, 0.3, 0.6) * 0.6
    place(out, creak, 0.0)
    g = voix(0.55, [(0, 48), (0.55, 56)], [(0, 'o'), (0.55, 'a')], echelle=0.66, rauque=0.8, sous=0.6, souffle=1.2, graine=222,
             env=[(0, 0), (0.3, 0.6), (0.5, 1.0), (0.55, 0.3)]) * 0.45
    place(out, g, 0.0)
    # 0,5 : claquement des deux ailes + déflagration
    for k, d in enumerate([0.0, 0.025]):
        place(out, battement_aile(0.9, 223 + k, 2.2) * 1.0, 0.5 + d)
    place(out, coup_sourd(0.6, 68, 0.12, 225, 0.7) * 0.9, 0.5)
    place(out, crepitement(0.6, 150, 226, 1800, 9000, [(0, 1), (0.6, 0)], bourdon=0.3, f_bourdon=73) * 0.4, 0.5)
    place(out, scintillement(0.8, 3200, 12, 227, 0.6, [(0, 1), (0.8, 0)]) * 0.25, 0.5)
    place(out, souffle(1.0, 1800, 320, 0.1, 0.9, 228) * 0.6, 0.5)
    place(out, battement_aile(0.6, 229, 1.8) * 0.45, 1.15)
    return coupe(salle(saturate(out, 1.3), 2.0, 0.25, 0.012, 21), L, 0.15)


@effet('ailes_battement', cible=-15, desc="Battement d'aile")
def ailes_battement():
    L = 0.6
    x = battement_aile(L, 231, 1.8) + ajuste(coup_sourd(0.3, 48, 0.08, 232, 0.2), secs(L)) * 0.4
    return coupe(salle(x, 1.2, 0.12, 0.008, 22), L, 0.08)


@effet('pique_alerte', cible=-11, desc="Avertissement du piqué : cri strident montant en triton, très reconnaissable")
def pique_alerte():
    L = 1.0; n = secs(L); t = np.arange(n) / SR
    vib = [(0, 0)]
    f_a = [(0, 590), (0.65, 1120), (1.0, 1240)]
    a = voix(L, f_a, [(0, 'a'), (0.6, 'E'), (1.0, 'i')], echelle=1.08, rauque=0.3, souffle=0.4, gigue=0.015, scintil=0.2,
             graine=241, env=[(0, 0), (0.04, 0.7), (0.7, 1.0), (0.95, 0.9), (1.0, 0)])
    b = voix(L, [(p, f * 1.414) for p, f in f_a], [(0, 'E'), (1.0, 'i')], echelle=1.12, rauque=0.25, souffle=0.4,
             graine=242, env=[(0, 0), (0.1, 0.5), (0.8, 0.8), (1.0, 0)]) * 0.55
    # sirène : vibrato de plus en plus large
    sir = np.sin(2 * np.pi * np.cumsum((600 + 640 * (t / L) ** 1.3) * (1 + 0.03 * (t / L) * np.sin(2 * np.pi * 7.5 * t))) / SR)
    sir = lp(saturate(sir * 2, 2.5), 4500) * env([(0, 0), (0.05, 0.5), (0.9, 0.8), (1.0, 0)], n) * 0.35
    ring = (a + b) * np.sin(2 * np.pi * 330 * t) * 0.25
    w = souffle(L, 300, 3000, 0.9, 1.2, 243) * 0.25
    x = saturate(norm(a + b + sir + ring + w) * 1.4, 1.6)
    return coupe(salle(x, 1.3, 0.15, 0.008, 23), L, 0.04)


@effet('pique_charge', cible=-12, desc="Le piqué : souffle de passage et rugissement en mouvement")
def pique_charge():
    L = 1.0; n = secs(L)
    pas = mono(passage(L, 251, 4200, 380, 0.45, 0.0)) * 1.4
    r = rugissement(0.95, base=100, graine=252, cri=0.55)
    x = pas + ajuste(r, n) * 0.6
    x += ajuste(battement_aile(0.5, 253, 2.0), n) * 0.5
    return coupe(salle(saturate(x, 1.3), 1.2, 0.12, 0.01, 24), L, 0.08)


@effet('pique_impact', cible=-10, pic=0.004, desc="Atterrissage brutal du piqué : choc, pierre broyée, débris")
def pique_impact():
    L = 1.5; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 261, (125, 31), 0.7, 120, 1.1, 0.9, 0.5)
    place(out, debris(1.3, 45, 263, 0.04, 0.8, 600, 5000, 2) * 0.5, 0.0)
    place(out, battement_aile(0.5, 264, 2.2) * 0.4, 0.0)
    out = saturate(out * 1.3, 1.6)
    return coupe(salle(out, 2.0, 0.28, 0.012, 25), L, 0.2)


@effet('ailes_dissipation', cible=-15, desc="Ailes qui s'effritent : crépitements qui s'éteignent, cendres")
def ailes_dissipation():
    L = 1.2; n = secs(L); out = np.zeros(n)
    out += crepitement(L, 90, 271, 1500, 9000, [(0, 1.0), (0.6, 0.4), (1.2, 0.05)], bourdon=0.2, f_bourdon=73) * 0.6
    sc = scintillement(L, 3000, 14, 272, 0.6, [(0, 1.0), (1.2, 0)])
    t = np.arange(n) / SR
    out += sc * 0.3 * np.exp(-t / 0.5)
    out += hp(rose(n, 273), 3000) * env([(0, 0.6), (0.3, 0.4), (1.2, 0)], n) * 0.25
    out += voix(L, [(0, 64), (L, 50)], [(0, 'a'), (L, 'u')], echelle=0.7, rauque=0.3, souffle=1.4, graine=274,
                env=[(0, 0), (0.1, 0.4), (1.0, 0.1), (1.2, 0)]) * 0.35
    return coupe(salle(out, 1.6, 0.25, 0.01, 26), L, 0.15)


# ════════════════════════════ TÉLÉPORTATION ET PHASE 3 ════════════════════════════

@effet('teleport_depart', cible=-13, pic=1.0, desc="Téléportation (départ) : implosion qui se referme d'un coup sec à 1,0 s")
def teleport_depart():
    L = 1.2; n = secs(L); out = np.zeros(n)
    place(out, aspiration(1.0, 281, 150, 6500, fin_net=True) * 1.1, 0.0)
    m = secs(1.0); t = np.arange(m) / SR
    place(out, np.sin(2 * np.pi * np.cumsum(34 + 50 * (t / 1.0) ** 2) / SR) * (t / 1.0) ** 2.5 * 0.6, 0.0)
    sc = scintillement(1.0, 3500, 12, 282, 0.5, [(0, 0), (0.98, 1), (1.0, 0)]) * 0.25
    place(out, sc, 0.0)
    place(out, impact_lourd(0.2, 283, (95, 50), 0.3, 170, 0.9, 0.0, 0.6), 1.0)
    place(out, crepitement(0.2, 120, 284, 2500, 9000, [(0, 1), (0.2, 0)]) * 0.4, 1.0)
    return coupe(salle(out, 1.0, 0.12, 0.006, 31), L, 0.05)


@effet('teleport_arrivee', cible=-12, pic=0.01, desc="Téléportation (arrivée) : déflagration, souffle vers l'extérieur, crépitements")
def teleport_arrivee():
    L = 1.5; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 291, (140, 40), 0.6, 150, 0.8, 0.2, 0.6)
    place(out, souffle(0.9, 3200, 260, 0.05, 0.9, 292) * 0.9, 0.0)
    place(out, crepitement(1.0, 90, 293, 1800, 9000, [(0, 1.0), (1.0, 0)], bourdon=0.25, f_bourdon=73) * 0.4, 0.0)
    place(out, scintillement(1.0, 3000, 12, 294, 0.5, [(0, 1.0), (1.0, 0)]) * 0.25, 0.0)
    return coupe(salle(saturate(out, 1.3), 1.8, 0.22, 0.01, 30), L, 0.15)


@effet('retour_rage', stereo=True, cible=-10, pic=0.8, desc="Retour spectaculaire du boss : tonnerre qui monte, éclair, déflagration, rugissement")
def retour_rage():
    L = 3.0; n = secs(L); out = np.zeros((2, n))
    # 0 → 0,8 : tonnerre qui gronde et monte, électricité
    g = np.stack([grondement(0.85, 301, 120, 1.0, [(0, 0.1), (0.8, 1.0), (0.85, 0.6)]),
                  grondement(0.85, 302, 120, 1.0, [(0, 0.1), (0.8, 1.0), (0.85, 0.6)])])
    place(out, g * 0.9, 0.0)
    cr = crepitement(0.8, 60, 303, 1500, 9000, [(0, 0.1), (0.8, 1.0)], bourdon=0.3, f_bourdon=55)
    place(out, stereo_large(cr, 304, 0.8) * 0.45, 0.0)
    place(out, stereo_large(I.reverse_cymbal(0.8), 305, 0.6) * 0.5, 0.0)
    # 0,8 : éclair (rafale de claquements très brillants) + déflagration
    ecl = np.zeros(secs(0.12))
    rr = np.random.default_rng(306)
    for k in range(7):
        b = hp(noise(secs(0.012), rr.integers(1 << 30)), 1500 + 1500 * k) * np.exp(-np.arange(secs(0.012)) / SR / 0.003)
        place(ecl, b * rr.uniform(0.5, 1.0), k * rr.uniform(0.008, 0.016))
    place(out, stereo_large(ecl, 307, 0.9) * 1.2, 0.8)
    place(out, stereo_large(impact_lourd(2.2, 308, (150, 28), 0.8, 120, 1.2, 0.6, 0.8), 309, 0.5), 0.8)
    # rugissement
    rug = rugissement(1.7, base=74, graine=310, cri=0.55, grave=1.2)
    place(out, stereo_large(saturate(rug * 1.5, 2.0), 311, 0.6) * 0.85, 0.92)
    # traîne du tonnerre, débris
    tr = np.stack([grondement(2.1, 312, 160, 1.2, [(0, 1), (0.6, 0.6), (2.1, 0)]), grondement(2.1, 313, 160, 1.2, [(0, 1), (0.7, 0.6), (2.1, 0)])])
    place(out, tr * 0.7, 0.85)
    place(out, stereo_large(debris(1.8, 40, 314, 0.1, 0.9, 600, 5000), 315, 0.9) * 0.4, 0.82)
    out = saturate(out * 1.2, 1.4)
    return coupe(salle(out, 3.0, 0.3, 0.02, 32), L, 0.3)


@effet('zombies_cendres', stereo=True, cible=-13, pic=0.06, desc="Tous les zombies réduits en cendres : embrasements dispersés, braises, cendres qui retombent")
def zombies_cendres():
    L = 1.5; n = secs(L); out = np.zeros((2, n))
    r = np.random.default_rng(321)
    # embrasement collectif immédiat (l'instant où tous les zombies prennent feu)
    place(out, stereo_large(flamme(0.9, 320, pic=0.06), 319, 0.9) * 1.5, 0.0)
    place(out, stereo_large(impact_lourd(0.5, 318, (90, 45), 0.3, 120, 0.7, 0.0, 0.2), 317, 0.5) * 0.6, 0.0)
    for k in range(9):
        t0 = r.uniform(0.04, 0.35)
        f = flamme(r.uniform(0.7, 1.1), r.integers(1 << 30), pic=r.uniform(0.15, 0.3)) * r.uniform(0.3, 0.6)
        place(out, pan(f, r.uniform(-0.9, 0.9)), t0)
    for k in range(5):
        gm = voix(0.5, [(0, r.uniform(90, 130)), (0.5, r.uniform(60, 80))], [(0, 'a'), (0.5, 'u')], echelle=0.8, rauque=0.6,
                  souffle=0.6, graine=int(r.integers(1 << 30)), env=[(0, 0), (0.05, 0.6), (0.5, 0)]) * 0.18
        place(out, pan(gm, r.uniform(-0.8, 0.8)), r.uniform(0.0, 0.25))
    cendres = np.stack([hp(rose(n, 322), 2500), hp(rose(n, 323), 2500)]) * env([(0, 0), (0.3, 0.5), (1.5, 0)], n) * 0.18
    out += cendres
    return coupe(salle(out, 2.0, 0.25, 0.015, 33), L, 0.2)


@effet('mur_fissure', cible=-14, desc="Fissuration de la pierre : craquements qui s'accélèrent, plainte sourde du mur")
def mur_fissure():
    L = 1.0; n = secs(L); out = np.zeros(n)
    out += pierre_fracture(L, [(0, 8), (0.4, 60), (0.8, 220), (1.0, 300)], 331, 500, 5200, 0.25, 0.6) * 1.1
    t = np.arange(n) / SR
    plainte = bp(brun(n, 332), 160 + 90 * smooth_noise(n, 1.5, 333), 6.0) * env([(0, 0), (0.3, 0.5), (1.0, 1.0)], n) * 1.4
    out += plainte
    out += grondement(L, 334, 90, 0.8, [(0, 0), (0.5, 0.5), (1.0, 1.0)]) * 0.5
    return coupe(salle(out, 1.5, 0.18, 0.01, 34), L, 0.05)


@effet('mur_arrachement', cible=-11, pic=0.3, desc="Bloc arraché du mur : tension, rupture nette, frottement de pierre, éboulis")
def mur_arrachement():
    L = 1.4; n = secs(L); out = np.zeros(n)
    place(out, pierre_fracture(0.3, [(0, 80), (0.3, 400)], 341, 600, 5000, 0.3, 0.3), 0.0)
    place(out, pierre_fracture(0.25, [(0, 1400), (0.25, 120)], 342, 400, 5500, 0.5, 0.5) * 1.3, 0.3)
    place(out, impact_lourd(1.0, 343, (90, 40), 0.5, 110, 0.9, 0.5, 0.5), 0.3)
    m = secs(0.9); tt = np.arange(m) / SR
    fr = bp(rose(m, 344), 260 + 140 * smooth_noise(m, 3, 345), 1.2) * (1 + 0.9 * np.tanh(2 * smooth_noise(m, 18, 346)))
    fr *= env([(0, 0), (0.08, 1.0), (0.6, 0.6), (0.9, 0)], m)
    place(out, fr * 0.8, 0.32)
    place(out, debris(1.0, 55, 347, 0.05, 0.6, 500, 4000, 2) * 0.7, 0.34)
    return coupe(salle(saturate(out, 1.3), 1.8, 0.22, 0.012, 35), L, 0.12)


@effet('bloc_levitation', cible=-20, mesure='I', boucle=True, cat='boucle', desc="Bloc qui flotte : grondement, frottements, gravillons, bourdonnement magique (boucle 2 s)")
def bloc_levitation():
    L = 2.0; n = secs(L); t = np.arange(n) / SR
    hum = bourdon_harmonique(L, frequence_boucle(55.0, L), (1, 2, 3, 5), [1, 0.5, 0.3, 0.15], 351, battement=0.5, boucle=True) * 0.35
    fr = bruit_periodique(n, bande(180, 650, 2.0), 352) * am_boucle(L, 4, 0.6, 0.0, 1.5) * 0.7
    rum = bruit_periodique(n, bande(30, 120, 2.0), 353) * 0.6
    mag = (sinus_boucle(L, 880) * 0.5 + sinus_boucle(L, 1320) * 0.3) * am_boucle(L, 6, 0.8) * 0.06
    gr = boucle_circulaire(debris(2.6, 10, 354, 0.0, 2.4, 1200, 6000, 1), L) * 0.25
    return hum + fr + rum + mag + gr


@effet('bloc_lancer', cible=-13, desc="Projection du bloc : souffle lourd d'une masse énorme")
def bloc_lancer():
    L = 0.7; n = secs(L)
    w = souffle(L, 900, 180, 0.32, 0.8, 361) * 1.4
    air = lp(rose(n, 362), 220, 0.8) * env([(0, 0), (0.2, 1.0), (0.7, 0)], n) * 1.2
    cr = pierre_fracture(0.15, [(0, 200), (0.15, 0)], 363, 600, 4000, 0.1, 0.0) * 0.4
    x = w + air; x[:len(cr)] += cr
    return coupe(salle(x, 1.2, 0.12, 0.008, 36), L, 0.08)


@effet('bloc_impact', cible=-10, pic=0.004, desc="Impact massif d'un bloc de pierre : choc, éclatement, éboulis, grondement")
def bloc_impact():
    L = 2.0; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 371, (130, 28), 0.8, 105, 1.2, 1.2, 0.6, 400, 4800)
    place(out, pierre_fracture(0.5, [(0, 700), (0.2, 250), (0.5, 20)], 372, 300, 3500, 0.6, 0.5) * 0.9, 0.0)
    place(out, debris(1.8, 70, 373, 0.05, 1.0, 400, 5000, 2) * 0.6, 0.0)
    out += grondement(L, 374, 110, 1.0, [(0, 1.0), (0.5, 0.6), (2.0, 0)]) * 0.7
    return coupe(salle(saturate(out * 1.2, 1.5), 2.5, 0.28, 0.015, 37), L, 0.25)


@effet('bloc_reconstruction', cible=-15, pic=1.85, desc="Pierres qui se réassemblent : éboulis à l'envers, frottement qui monte, verrou de pierre")
def bloc_reconstruction():
    L = 2.0; n = secs(L); out = np.zeros(n)
    inv = debris(1.9, 60, 381, 0.0, 1.4, 500, 5000, 1)[::-1]
    place(out, inv * 0.8, 1.9 - len(inv) / SR)
    m = secs(1.85)
    fr = bp(rose(m, 382), 200 + 500 * (np.arange(m) / m) ** 2, 1.3) * env([(0, 0), (1.0, 0.5), (1.85, 1.0)], m) * 0.7
    place(out, fr, 0.0)
    place(out, scintillement(1.85, 2600, 12, 383, 0.6, [(0, 0), (1.8, 1.0), (1.85, 0)]) * 0.2, 0.0)
    place(out, impact_lourd(0.15, 384, (120, 70), 0.2, 190, 0.7, 0.5, 0.4), 1.85)
    return coupe(salle(out, 1.5, 0.18, 0.01, 38), L, 0.05)


@effet('onde_choc', cible=-11, pic=0.004, desc="Onde de choc au sol : coup grave, souffle qui balaie, crépitements")
def onde_choc():
    L = 1.2; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 391, (90, 34), 0.8, 95, 1.0, 0.3, 0.3)
    t = np.arange(n) / SR
    bl = lp(rose(n, 392), 3200 * np.exp(-t / 0.25) + 180, 0.8) * env([(0, 0), (0.02, 1.0), (1.2, 0)], n) * 1.1
    out += bl
    place(out, crepitement(0.6, 80, 393, 1500, 7000, [(0, 1), (0.6, 0)]) * 0.3, 0.0)
    place(out, debris(0.9, 20, 394, 0.05, 0.5, 900, 5000) * 0.35, 0.0)
    return coupe(salle(saturate(out, 1.3), 1.8, 0.2, 0.01, 39), L, 0.12)


# ════════════════════════════ PHASE 4 ════════════════════════════

def carillon(L, notes, seed, eclat=0.4):
    """Carillon de verre / petites cloches : partiels presque harmoniques, attaque cristalline."""
    out = np.zeros(secs(L))
    for k, (t0, m, g) in enumerate(notes):
        f = float(mtof(m))
        c = modes(L - t0, f, [1.0, 2.0, 2.76, 4.07, 5.4], [1.0, 0.45, 0.35, 0.2, 0.12], [2.2, 1.4, 0.9, 0.5, 0.3], seed + k, eclat, 6000, 0.0012)
        place(out, c * g, t0)
    return out


@effet('rituel_apparition', stereo=True, cible=-14, desc="Tracé du cercle rituel en 4 étapes : carillons, bourdon qui monte, éclat final")
def rituel_apparition():
    L = 4.0; n = secs(L); out = np.zeros((2, n))
    etapes = [(0.0, [62, 69], -0.6), (1.0, [65, 72], 0.6), (2.0, [69, 74, 77], -0.3), (3.0, [74, 77, 81, 86], 0.3)]
    for t0, ms, p in etapes:
        c = carillon(L - t0, [(i * 0.07, m, 0.8 - 0.1 * i) for i, m in enumerate(ms)], int(400 + t0 * 10))
        place(out, pan(c, p) * 0.9, t0)
        place(out, pan(coup_sourd(0.5, 55, 0.12, int(410 + t0 * 10), 0.1), 0) * 0.5, t0)
    dr = bourdon_harmonique(L, 73.4, (1, 1.5, 2, 3, 4), [1, 0.5, 0.6, 0.3, 0.2], 401, battement=0.4)
    dr *= env([(0, 0), (3.0, 0.7), (4.0, 1.0)], n)
    out += stereo_large(dr, 402, 0.5) * 0.35
    out += scintillement(L, 3500, 18, 403, 0.6, [(0, 0), (3.2, 0.6), (3.9, 1.0), (4.0, 0.8)], stereo=True) * 0.25
    return coupe(salle(out, 2.8, 0.3, 0.02, 40, sombre=False), L, 0.2)


@effet('rituel_boucle', cible=-20, mesure='I', boucle=True, cat='boucle', desc="Cercle rituel actif : bourdon harmonique, chœur lointain, scintillement (boucle 4 s)")
def rituel_boucle():
    L = 4.0; n = secs(L)
    out = np.zeros(n)
    for f, g in [(73.5, 1.0), (110.25, 0.6), (147.0, 0.5), (174.75, 0.3), (220.5, 0.25), (294.0, 0.15)]:
        out += sinus_boucle(L, f, 0.3 * f) * g + sinus_boucle(L, f + 0.25, 0.7 * f) * g * 0.6
    out *= am_boucle(L, 2, 0.25)
    ch = bruit_periodique(n, lambda fr: np.exp(-((fr - 300) / 60.0) ** 2) + 0.6 * np.exp(-((fr - 870) / 80.0) ** 2) + 0.2 * np.exp(-((fr - 2240) / 110.0) ** 2), 411)
    out += ch * am_boucle(L, 1, 0.5, 1.0) * 0.18
    sc = sum(sinus_boucle(L, f, f) * g for f, g in [(1760, 0.5), (2349.25, 0.35), (2637, 0.25), (3520, 0.15)])
    out += sc * am_boucle(L, 8, 0.9) * 0.05
    return out


@effet('rituel_conteste', cible=-14, desc="Alerte « contesté » : deux impulsions dissonantes")
def rituel_conteste():
    L = 0.6; n = secs(L); out = np.zeros(n)
    for t0 in (0.0, 0.28):
        m = secs(0.2); t = np.arange(m) / SR
        tone = (pulse(np.full(m, 587.33), 0.5, 0.0) * 0.5 + pulse(np.full(m, 622.25), 0.5, 0.3) * 0.5)
        tone = lp(tone, 2400) * env([(0, 0), (0.005, 1.0), (0.15, 0.8), (0.2, 0)], m)
        place(out, tone * 0.6, t0)
        place(out, coup_sourd(0.25, 80, 0.05, 421 + int(t0 * 10), 0.3) * 0.6, t0)
    return coupe(salle(out, 0.9, 0.12, 0.006, 41), L, 0.05)


@effet('rituel_recul', cible=-16, desc="La progression du rituel recule : glissando descendant")
def rituel_recul():
    L = 0.8; n = secs(L); t = np.arange(n) / SR
    f = 440 * (293.66 / 440) ** (t / L)
    tone = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)) * env([(0, 0), (0.02, 1), (0.8, 0)], n)
    sc = scintillement(L, 2600, 10, 431, 0.5, [(0, 0.8), (0.8, 0)]) * 0.2
    wh = ajuste(coup_sourd(0.4, 60, 0.12, 432, 0.1), n) * 0.5
    return coupe(salle(tone * 0.5 + sc + wh, 1.2, 0.15, 0.008, 42), L, 0.06)


@effet('rituel_fin', stereo=True, cible=-10, pic=2.6, desc="Fin du rituel : charge qui monte, faisceau, tremblement, explosion de lumière")
def rituel_fin():
    L = 4.0; n = secs(L); out = np.zeros((2, n))
    for i, (f0, f1) in enumerate([(146.8, 155.6), (220.0, 233.1), (293.7, 311.1), (349.2, 370.0)]):
        v = voix(2.6, [(0, f0), (2.6, f1)], [(0, 'u'), (1.5, 'o'), (2.6, 'a')], echelle=0.95, rauque=0.1, souffle=0.5,
                 graine=441 + i, env=[(0, 0), (1.0, 0.4), (2.5, 1.0), (2.6, 0.2)])
        place(out, pan(v, (-0.6, 0.6, -0.3, 0.3)[i]) * 0.3, 0.0)
    place(out, stereo_large(I.riser(2.6, 250, 9000, 0.8, 445), 446, 0.7) * 0.5, 0.0)
    g = np.stack([grondement(2.7, 447, 120, 1.0, [(0, 0), (2.6, 1.0), (2.7, 0.5)]), grondement(2.7, 448, 120, 1.0, [(0, 0), (2.6, 1.0), (2.7, 0.5)])])
    place(out, g * 0.7, 0.0)
    place(out, stereo_large(crepitement(2.6, 70, 449, 2000, 9000, [(0, 0.1), (2.6, 1.0)]), 450, 0.8) * 0.3, 0.0)
    # 2,6 : explosion de lumière
    place(out, stereo_large(impact_lourd(1.4, 451, (140, 30), 0.8, 130, 1.1, 0.3, 0.8), 452, 0.5), 2.6)
    place(out, scintillement(1.4, 3600, 24, 453, 0.8, [(0, 1.0), (1.4, 0)], stereo=True) * 0.5, 2.6)
    for i, m in enumerate([50, 57, 62, 66, 69]):   # ré majeur lumineux
        ch = voix(1.4, [(0, float(mtof(m))), (1.4, float(mtof(m)))], [(0, 'a'), (1.4, 'o')], echelle=1.0, rauque=0.05,
                  souffle=0.3, graine=460 + i, env=[(0, 0), (0.05, 1.0), (0.8, 0.7), (1.4, 0)])
        place(out, pan(ch, (-0.7, 0.7, -0.35, 0.35, 0)[i]) * 0.22, 2.62)
    place(out, pan(I.bell(293.7, 0.8, 1.4, 470), 0.0) * 0.4, 2.6)
    return coupe(salle(saturate(out, 1.2), 3.2, 0.3, 0.02, 43, sombre=False), L, 0.25)


@effet('boss_faible', cible=-15, desc="Boss affaibli : gémissement brisé, souffle haché")
def boss_faible():
    L = 2.5; n = secs(L); out = np.zeros(n)
    m = voix(1.5, [(0, 125), (0.4, 108), (1.5, 78)], [(0, 'a'), (0.7, 'o'), (1.5, 'u')], echelle=0.8, rauque=0.6, sous=0.3,
             souffle=1.0, gigue=0.05, scintil=0.3, graine=481, env=[(0, 0), (0.1, 0.9), (0.9, 0.6), (1.5, 0)])
    place(out, m, 0.1)
    for k, t0 in enumerate([1.65, 2.05]):
        b = voix(0.32, [(0, 42), (0.32, 48)], [(0, 'O'), (0.32, 'a')], echelle=0.7, rauque=0.9, souffle=2.5, oq=0.8,
                 graine=482 + k, env=[(0, 0), (0.1, 0.8), (0.32, 0)]) * 0.6
        place(out, b, t0)
    return coupe(salle(out, 1.6, 0.2, 0.01, 44), L, 0.1)


# ════════════════════════════ PHASE 5 ════════════════════════════

@effet('capture_ames', stereo=True, cible=-13, pic=4.5, desc="Capture de l'âme des joueurs : aspiration profonde, chœur distordu, cœur qui ralentit, sons étouffés, chute dans le noir")
def capture_ames():
    L = 5.0; n = secs(L); out = np.zeros((2, n))
    asp = aspiration(4.5, 491, 100, 3000, fin_net=False) * env([(0, 0.2), (3.5, 1.0), (4.5, 0.4)], secs(4.5))
    place(out, stereo_large(asp, 492, 0.9) * 0.6, 0.0)
    for i, (f0, f1) in enumerate([(110, 104), (146.8, 138.6), (155.6, 146.8), (220, 207.7)]):
        v = voix(4.4, [(0, f0), (4.4, f1)], [(0, 'a'), (2.0, 'o'), (4.4, 'u')], echelle=0.85, rauque=0.4, sous=0.2,
                 souffle=0.8, graine=493 + i, env=[(0, 0), (1.5, 0.6), (3.6, 1.0), (4.4, 0)])
        place(out, pan(saturate(v * 2.5, 2.5), (-0.7, 0.7, -0.3, 0.3)[i]) * 0.22, 0.1)
    hb = battement_coeur(5.0, [0.0, 0.75, 1.6, 2.6, 3.8], 497, 1.2)
    out += np.stack([hb, hb]) * 0.8
    place(out, murmures(4.5, 5, 6, 1.0, 498, stereo=True, env=[(0, 0.2), (3.0, 1.0), (4.5, 0)]) * 0.35, 0.0)
    # étouffement : passe-bas qui se referme
    t = np.arange(n) / SR
    fc = 12000 * (350 / 12000) ** np.clip(t / 4.5, 0, 1)
    out = np.stack([lp(out[0], fc, 0.7), lp(out[1], fc, 0.7)])
    place(out, np.stack([coup_sourd(0.5, 45, 0.15, 500, 0.0)] * 2) * 1.2, 4.5)
    out *= env([(0, 1), (4.5, 1), (5.0, 0.0)], n)
    return coupe(salle(out, 2.6, 0.25, 0.02, 45), L, 0.1)


@effet('obscurite', stereo=True, cible=-14, desc="L'obscurité tombe : bourdon qui descend, murmures inversés, souffle qui retombe")
def obscurite():
    L = 2.5; n = secs(L); t = np.arange(n) / SR
    f = 146.8 * (0.5) ** (t / L)
    dr = sum(np.sin(2 * np.pi * np.cumsum(f * k * (1 + 0.003 * k)) / SR) / k for k in range(1, 7))
    dr = lp(dr, 1200) * env([(0, 0), (0.3, 1.0), (2.2, 0.8), (2.5, 0)], n)
    out = stereo_large(dr, 511, 0.6) * 0.5
    mur = murmures(L, 4, 6, 0.95, 512, stereo=True)[:, ::-1] * env([(0, 0), (1.8, 1.0), (2.4, 0.2), (2.5, 0)], n)
    out += mur * 0.4
    out += stereo_large(souffle(L, 3500, 90, 0.35, 0.8, 513), 514, 0.8) * 0.5
    out += np.stack([chute_grave(L, 70, 28, 0.3, 0.9)] * 2) * 0.35
    return coupe(salle(out, 2.6, 0.25, 0.02, 46), L, 0.2)


@effet('lames_apparition', cible=-13, pic=1.7, desc="Formation des lames : chair qui se déchire, métal qui se forme, énergie, tranchant final")
def lames_apparition():
    L = 2.0; n = secs(L); out = np.zeros(n)
    r = np.random.default_rng(521)
    for k in range(5):
        t0 = 0.05 + k * 0.28 + r.uniform(-0.05, 0.05)
        place(out, chair(0.4, int(r.integers(1 << 30)), 1.0, 0.4) * 0.6, t0)
        m = secs(0.3); tt = np.arange(m) / SR
        rip = bp(rose(m, int(r.integers(1 << 30))), 600 + 2500 * tt / 0.3, 3.0) * env([(0, 0), (0.05, 1), (0.3, 0)], m) * 0.5
        place(out, rip, t0 + 0.05)
    m = secs(1.7)
    ring = metal_lame(1.7, 1650, 522, 0.0)[::-1] * env([(0, 0), (1.6, 1.0), (1.7, 1.0)], m) * 0.35
    place(out, ring, 0.0)
    hum = crepitement(1.7, 50, 523, 1500, 8000, [(0, 0.2), (1.7, 1.0)], bourdon=0.4, f_bourdon=73) * 0.4
    place(out, hum, 0.0)
    place(out, metal_lame(0.3, 2100, 524, 0.8) * 0.8, 1.7)
    place(out, souffle(0.3, 1500, 6000, 0.6, 1.5, 525) * 0.5, 1.55)
    return coupe(salle(out, 1.5, 0.18, 0.01, 47), L, 0.06)


def _swish(seed, f0, f1, L=0.5, ton=1850):
    n = secs(L)
    x = souffle(0.36, f0, f1, 0.45, 1.6, seed) * 1.2
    out = np.zeros(n); place(out, x, 0.02)
    t = np.arange(n) / SR
    out += metal_lame(L, ton, seed + 1, 0.0) * env([(0, 0), (0.15, 0.4), (L, 0)], n) * 0.18
    return coupe(salle(out, 0.9, 0.1, 0.006, seed % 97), L, 0.06)


@effet('lame_mouvement_1', cible=-17, desc="Sifflement de lame (variante 1)")
def lame_mouvement_1():
    return _swish(531, 900, 5200, ton=1850)


@effet('lame_mouvement_2', cible=-17, desc="Sifflement de lame (variante 2)")
def lame_mouvement_2():
    return _swish(541, 1400, 3800, ton=2230)


@effet('frappe_preparation', cible=-11, desc="Préparation de la frappe spéciale : cri strident et lames qui raclent, immédiatement reconnaissable")
def frappe_preparation():
    L = 0.7; n = secs(L); t = np.arange(n) / SR
    a = voix(L, [(0, 720), (0.55, 1320), (0.7, 1380)], [(0, 'E'), (0.5, 'i'), (0.7, 'i')], echelle=1.12, rauque=0.35,
             souffle=0.4, gigue=0.02, graine=551, env=[(0, 0), (0.03, 0.8), (0.6, 1.0), (0.7, 0.6)])
    b = voix(L, [(0, 509), (0.55, 933), (0.7, 976)], [(0, 'a'), (0.7, 'E')], echelle=1.05, rauque=0.4, souffle=0.4,
             graine=552, env=[(0, 0), (0.05, 0.6), (0.6, 0.8), (0.7, 0.4)]) * 0.6
    sc = metal_frotte(L, 800, 553, [(0, 0), (0.2, 0.6), (0.7, 1.0)], 0.15) * 0.5
    sc2 = np.sin(2 * np.pi * np.cumsum(1700 + 1300 * (t / L) ** 1.5) / SR) * env([(0, 0), (0.1, 0.2), (0.7, 0.7)], n) * 0.25
    x = saturate(norm(a + b + sc + sc2) * 1.5, 1.6)
    return coupe(salle(x, 1.1, 0.12, 0.006, 48), L, 0.03)


@effet('frappe_impact', cible=-10, pic=0.004, desc="La frappe touche : double entaille, métal, coup grave")
def frappe_impact():
    L = 1.2; n = secs(L); out = np.zeros(n)
    place(out, chair(0.6, 561, 1.0, 0.8) * 1.0, 0.0)
    place(out, chair(0.6, 562, 1.0, 0.6) * 0.8, 0.045)
    out += impact_lourd(L, 563, (120, 40), 0.45, 125, 1.0, 0.35, 0.5, dec_sub=0.2)
    place(out, metal_lame(0.7, 1900, 564, 0.9) * 0.4, 0.0)
    place(out, metal_lame(0.6, 2250, 565, 0.6) * 0.3, 0.045)
    return coupe(salle(saturate(out * 1.2, 1.5), 1.6, 0.2, 0.01, 49), L, 0.15)


@effet('frappe_ratee', cible=-13, pic=0.18, desc="Frappe manquée : lames qui fendent l'air puis frappent la pierre")
def frappe_ratee():
    L = 0.8; n = secs(L); out = np.zeros(n)
    place(out, souffle(0.25, 1200, 5000, 0.6, 1.5, 571) * 1.0, 0.0)
    place(out, souffle(0.25, 1000, 4200, 0.6, 1.5, 572) * 0.9, 0.05)
    place(out, modes(0.6, 1120, [1.0, 2.41, 3.95, 5.6], [1.0, 0.6, 0.35, 0.2], [0.25, 0.15, 0.1, 0.06], 573, 0.9, 4000, 0.002) * 0.7, 0.18)
    place(out, pierre_fracture(0.2, [(0, 600), (0.2, 0)], 574, 600, 5000, 0.4, 0.0) * 0.8, 0.18)
    place(out, debris(0.5, 12, 575, 0.0, 0.3, 1200, 6000) * 0.4, 0.2)
    return coupe(salle(out, 1.2, 0.15, 0.008, 50), L, 0.06)


@effet('etat_critique', stereo=True, cible=-18, mesure='I', boucle=True, cat='boucle', desc="Joueur à 1 % : battement de cœur sourd et sifflement d'oreille (boucle 1 s)")
def etat_critique():
    L = 1.0; n = secs(L)
    hb = battement_coeur(1.6, [0.0], 581, 1.4, 0.6)
    hb = boucle_circulaire(hb, L)
    sang = bruit_periodique(n, bande(40, 260, 2.5), 582) * am_boucle(L, 1, 0.7, -np.pi / 2, 2.0) * 0.25
    tin = sinus_boucle(L, 4300) * 0.012 + sinus_boucle(L, 4302) * 0.008
    m = hb + sang
    return np.stack([m + tin, m + sinus_boucle(L, 4296) * 0.012 + sinus_boucle(L, 4301) * 0.008])


@effet('boss_proche', cible=-22, mesure='I', boucle=True, cat='boucle', desc="Murmures quand le boss approche (boucle 4 s)")
def boss_proche():
    L = 4.0; X = 0.4
    m = murmures(L + X, 4, 6, 0.9, 591)
    br = voix(L + X, [(0, 40), (L + X, 42)], [(0, 'O'), (2.0, 'u'), (L + X, 'O')], echelle=0.68, rauque=0.8, souffle=2.0, oq=0.75,
              graine=592, env=[(0, 0.3), (1.0, 0.7), (2.2, 0.4), (3.3, 0.8), (L + X, 0.3)]) * 0.5
    hum = bourdon_harmonique(L + X, 55.0, (1, 2, 3), [1, 0.4, 0.2], 593, 0.4) * 0.12
    x = salle(m * 0.8 + br + hum, 1.4, 0.25, 0.01, 51)
    return boucle_fondue(ajuste(x, secs(L + X)), L, X)


@effet('goutte_sang', cible=-22, desc="Goutte de sang qui tombe au sol")
def goutte_sang():
    L = 0.15
    x = goutte(620, L, 601) + ajuste(chair(0.08, 602, 0.6, 0.0), secs(L)) * 0.15
    return coupe(x, L, 0.02)


# ════════════════════════════ FIN ════════════════════════════

@effet('boss_defaite', stereo=True, cible=-10, pic=2.8, desc="Défaite du boss : cri final, étranglement, effondrement, libération d'énergie")
def boss_defaite():
    L = 5.0; n = secs(L); out = np.zeros((2, n))
    cri = rugissement(1.6, base=96, graine=611, cri=0.75, contour=[(0, 0.9), (0.3, 1.3), (1.0, 1.2), (1.6, 0.7)])
    place(out, stereo_large(saturate(cri * 1.5, 2.0), 612, 0.6) * 0.9, 0.0)
    et = voix(0.7, [(0, 110), (0.7, 55)], [(0, 'o'), (0.7, 'u')], echelle=0.7, rauque=0.95, sous=0.6, souffle=0.9, gigue=0.06,
              graine=613, env=[(0, 0), (0.05, 0.8), (0.7, 0)])
    place(out, pan(et, 0) * 0.5, 1.55)
    place(out, stereo_large(impact_lourd(0.8, 614, (80, 40), 0.5, 95, 1.0, 0.4, 0.2), 615, 0.4) * 0.8, 2.3)
    place(out, stereo_large(debris(0.7, 15, 616, 0.0, 0.3, 500, 3000), 617, 0.8) * 0.4, 2.32)
    place(out, stereo_large(impact_lourd(2.0, 618, (150, 30), 0.8, 140, 0.9, 0.1, 0.6), 619, 0.6), 2.8)
    place(out, passage(1.2, 620, 5000, 200, 0.1, 0.9) * 0.6, 2.8)
    place(out, scintillement(2.0, 3200, 24, 621, 0.8, [(0, 1.0), (2.0, 0)], stereo=True) * 0.45, 2.8)
    place(out, stereo_large(crepitement(1.6, 120, 622, 1500, 9000, [(0, 1.0), (1.6, 0)]), 623, 0.8) * 0.35, 2.8)
    m = secs(2.2); tt = np.arange(m) / SR
    dr = sum(np.sin(2 * np.pi * np.cumsum(73.4 * k * (1 - 0.25 * tt / 2.2)) / SR) / k for k in range(1, 6)) * env([(0, 0.6), (2.2, 0)], m)
    place(out, stereo_large(lp(dr, 900), 624, 0.6) * 0.35, 2.8)
    return coupe(salle(saturate(out, 1.3), 3.4, 0.3, 0.02, 52), L, 0.4)


@effet('lames_desintegration', cible=-15, desc="Lames qui s'effritent : métal qui sonne et se brise en poussière")
def lames_desintegration():
    L = 2.0; n = secs(L); out = np.zeros(n)
    out += ajuste(metal_lame(1.8, 1750, 631, 0.5), n) * 0.45
    out += ajuste(metal_lame(1.6, 2080, 632, 0.3), n) * 0.35
    out += crepitement(L, 140, 633, 2000, 9500, [(0, 1.0), (1.2, 0.5), (2.0, 0)]) * 0.45
    out += pierre_fracture(L, [(0, 300), (1.0, 120), (2.0, 0)], 634, 1500, 7000, 0.0, 0.0) * 0.6
    out += hp(rose(n, 635), 4000) * env([(0, 0.4), (2.0, 0)], n) * 0.15
    return coupe(salle(out, 1.6, 0.2, 0.01, 53), L, 0.2)


@effet('interaction_maintien', cible=-20, mesure='I', boucle=True, cat='boucle', desc="Maintien de l'interaction : pulsation douce et lumineuse (boucle 1 s ; monter la hauteur au fil de la progression)")
def interaction_maintien():
    L = 1.0; n = secs(L)
    x = sum(sinus_boucle(L, f, f) * g for f, g in [(293.0, 0.5), (440.0, 0.35), (587.0, 0.3), (880.0, 0.12), (1760.0, 0.06), (2640.0, 0.04)])
    x = x * am_boucle(L, 4, 0.45)
    x += bruit_periodique(n, bande(1500, 6000, 2.0), 641) * am_boucle(L, 4, 0.8, 1.0) * 0.05
    return x * 0.6


@effet('recompense', stereo=True, cible=-14, desc="Récompense : cloches et chœur lumineux en ré majeur")
def recompense():
    L = 3.0; n = secs(L); out = np.zeros((2, n))
    c = carillon(L, [(0.0, 74, 1.0), (0.12, 78, 0.8), (0.24, 81, 0.8), (0.36, 86, 0.7)], 651, 0.5)
    out += stereo_large(c, 652, 0.6) * 0.6
    out += pan(I.bell(587.3, 0.9, L, 653), -0.3) * 0.35 + pan(I.bell(440.0, 0.7, L, 654), 0.3) * 0.25
    for i, m in enumerate([62, 66, 69, 74]):
        v = voix(2.6, [(0, float(mtof(m))), (2.6, float(mtof(m)))], [(0, 'a'), (2.6, 'o')], echelle=1.0, rauque=0.05,
                 souffle=0.3, graine=655 + i, env=[(0, 0), (0.35, 1.0), (1.8, 0.7), (2.6, 0)])
        place(out, pan(v, (-0.6, 0.6, -0.2, 0.2)[i]) * 0.2, 0.1)
    out += scintillement(L, 4000, 20, 660, 0.7, [(0, 0.3), (0.5, 1.0), (3.0, 0)], stereo=True) * 0.3
    return coupe(salle(out, 2.6, 0.3, 0.02, 54, sombre=False), L, 0.3)


@effet('recompense_objet', stereo=True, cible=-16, desc="Une récompense distribuée : tintement clair")
def recompense_objet():
    L = 0.5; n = secs(L)
    c = carillon(L, [(0.0, 81, 1.0), (0.05, 88, 0.5)], 671, 0.6)
    s = scintillement(L, 5000, 10, 672, 0.4, [(0, 1.0), (0.5, 0)], stereo=True) * 0.3
    return coupe(salle(stereo_large(c, 673, 0.5) + s, 1.2, 0.2, 0.01, 55, sombre=False), L, 0.08)


@effet('message_final', stereo=True, cible=-14, desc="Message final : cuivres graves en ré majeur, chœur, glas, scintillement")
def message_final():
    L = 3.5; n = secs(L); out = np.zeros((2, n))
    for i, m in enumerate([38, 45, 50, 54, 57]):
        b = I.brass(m, 3.2, 0.7, 4, 0.25, 0.8, 0.0, 681 + i)
        place(out, pan(b, (-0.4, 0.4, -0.2, 0.2, 0)[i]) * 0.3, 0.0)
    for i, m in enumerate([62, 66, 69]):
        v = voix(3.2, [(0, float(mtof(m))), (3.2, float(mtof(m)))], [(0, 'o'), (3.2, 'a')], echelle=1.0, rauque=0.05,
                 souffle=0.3, graine=690 + i, env=[(0, 0), (0.6, 1.0), (2.4, 0.7), (3.2, 0)])
        place(out, pan(v, (-0.5, 0.5, 0)[i]) * 0.2, 0.05)
    out += pan(I.bell(146.8, 0.9, L, 695), 0.0) * 0.5
    out += scintillement(L, 3800, 16, 696, 0.6, [(0, 0), (0.6, 0.8), (3.5, 0)], stereo=True) * 0.25
    return coupe(salle(out, 3.0, 0.3, 0.02, 56, sombre=False), L, 0.3)


# ════════════════════════════ AMBIANCES ════════════════════════════

@effet('amb_salle', stereo=True, cible=-28, mesure='I', boucle=True, cat='ambiance', desc="Salle secrète : bourdon grave, air, gouttes, grincements lointains (boucle 8 s)")
def amb_salle():
    L = 8.0; n = secs(L); out = np.zeros((2, n))
    dr = sum(sinus_boucle(L, f, f) * g for f, g in [(36.75, 1.0), (55.125, 0.5), (73.5, 0.35), (110.25, 0.12)])
    dr *= am_boucle(L, 2, 0.3)
    out += np.stack([dr, dr]) * 0.3
    air = np.stack([bruit_periodique(n, bande(80, 1800, 1.5), 701), bruit_periodique(n, bande(80, 1800, 1.5), 702)])
    out += air * am_boucle(L, 1, 0.4) * 0.12
    r = np.random.default_rng(703)
    gouttes = np.zeros((2, n + secs(1.0)))
    for k in range(9):
        t0 = r.uniform(0, L)
        g = salle(goutte(r.uniform(500, 1100), 0.15, int(r.integers(1 << 30))), 1.8, 0.5, 0.02, 57)
        place(gouttes, pan(g, r.uniform(-0.8, 0.8)) * r.uniform(0.08, 0.2), t0)
    out += boucle_circulaire(gouttes, L)
    gr = metal_frotte(2.5, 380, 704, [(0, 0), (0.8, 1.0), (2.5, 0)], 0.1)
    gr = salle(gr, 2.6, 0.6, 0.03, 58, stereo_out=True)
    tmp = np.zeros((2, n + gr.shape[1])); place(tmp, gr * 0.12, 5.2)
    out += boucle_circulaire(tmp, L)
    return out


@effet('amb_bunker_sombre', stereo=True, cible=-28, mesure='I', boucle=True, cat='ambiance', desc="Bunker 7 plongé dans le noir : ronflement de ventilation, vent, râles lointains, chocs sourds (boucle 8 s)")
def amb_bunker_sombre():
    L = 8.0; n = secs(L); out = np.zeros((2, n))
    hum = sum(sinus_boucle(L, f, f) * g for f, g in [(50.0, 0.6), (100.0, 0.5), (150.0, 0.25), (200.0, 0.1)])
    out += np.stack([hum, hum]) * 0.15 * am_boucle(L, 4, 0.15)
    vent = np.stack([bruit_periodique(n, bande(300, 900, 3.0), 711), bruit_periodique(n, bande(300, 900, 3.0), 712)])
    out += vent * am_boucle(L, 1, 0.6, 0.0, 2.0) * 0.1
    sous = np.stack([bruit_periodique(n, bande(25, 90, 2.0), 713), bruit_periodique(n, bande(25, 90, 2.0), 714)])
    out += sous * 0.25
    tmp = np.zeros((2, n + secs(4.0)))
    r = np.random.default_rng(715)
    for k, t0 in enumerate([1.2, 4.6]):
        v = voix(1.1, [(0, r.uniform(85, 110)), (1.1, r.uniform(65, 80))], [(0, 'O'), (0.5, 'a'), (1.1, 'u')], echelle=0.82,
                 rauque=0.6, souffle=0.6, graine=int(r.integers(1 << 30)), env=[(0, 0), (0.2, 0.8), (1.1, 0)])
        v = lp(salle(v, 2.8, 0.8, 0.04, 59), 1600)
        place(tmp, pan(v, (-0.7, 0.6)[k]) * 0.18, t0)
    ch = lp(salle(impact_lourd(0.6, 716, (90, 45), 0.4, 110, 0.8, 0.2, 0.0), 2.8, 0.7, 0.05, 60), 700)
    place(tmp, pan(ch, 0.3) * 0.2, 6.3)
    out += boucle_circulaire(tmp, L)
    return out


@effet('intro_transition', stereo=True, cible=-12, pic=2.35, desc="Déclenchement du combat : grondement, distorsion, aspiration vers la salle secrète, coup sourd à 2,35 s")
def intro_transition():
    L = 2.5; n = secs(L); out = np.zeros((2, n))
    g = np.stack([grondement(2.35, 721, 140, 1.0, [(0, 0.1), (2.3, 1.0), (2.35, 0.8)]), grondement(2.35, 722, 140, 1.0, [(0, 0.1), (2.3, 1.0), (2.35, 0.8)])])
    m = secs(2.35); t = np.arange(m) / SR
    g = saturate(g * (1 + 3 * (t / 2.35) ** 2), 2.0)
    place(out, g * 0.6, 0.0)
    place(out, stereo_large(aspiration(2.35, 723, 150, 7000, fin_net=True), 724, 0.8) * 0.8, 0.0)
    place(out, murmures(2.35, 5, 7, 1.0, 725, stereo=True, env=[(0, 0), (2.0, 1.0), (2.35, 0)])[:, ::-1] * 0.35, 0.0)
    sub = np.sin(2 * np.pi * np.cumsum(30 + 40 * (t / 2.35) ** 2) / SR) * (t / 2.35) ** 2
    place(out, np.stack([sub, sub]) * 0.5, 0.0)
    place(out, stereo_large(impact_lourd(0.15, 726, (80, 50), 0.6, 100, 1.0, 0.0, 0.3), 727, 0.3), 2.35)
    return coupe(out, L, 0.03)


# ════════════════════════════ CHIENS ZOMBIES (v1.2, API.md §14.6) ════════════════════════════
# Chiens décharnés et monstrueux : voix rauque et pourrie (source glottique très irrégulière, sous-harmonique,
# pulsation roulée de la gorge, formants de gueule énorme), gargouillis, salle sombre courte. Tous mono et
# positionnels. Aucune voix de chien enregistrée : tout est synthétisé.

def _fin(x, L, fin):
    """Coupe à L s avec fondu de sortie, après un passe-haut à 32 Hz (aucune énergie infrasonore : elle ne
    s'entend pas mais consomme la marge de crête et s'additionne d'un chien à l'autre)."""
    return coupe(butter_hp(x, 32, 2), L, fin)


def _gorge(L, f0, voyelles, env_pts, graine, *, rauque=0.75, sous=0.55, souffle=1.1, roule=27.0, prof=0.55,
           echelle=0.72, gigue=0.04, scintil=0.3, oq=0.68):
    """Grondement de gorge de chien zombie (base des grognements, queues d'aboiement, râles)."""
    return voix(L, f0, voyelles, echelle=echelle, rauque=rauque, sous=sous, souffle=souffle, gigue=gigue,
                scintil=scintil, oq=oq, env=env_pts, graine=graine, roule=roule, roule_prof=prof)


@effet('chien_faille', cible=-15, pic=0.9, desc="Chien zombie — faille de braises qui s'ouvre au sol : le sceau craque, la fissure court, souffle de feu grave qui monte, crépitements ; jaillissement à 0,9 s",
       notes="Le jaillissement (pic) tombe à 0,9 s = chiens.faille.duree : lancer le son à l'évènement chien « faille ».")
def chien_faille():
    L = 1.2; n = secs(L); out = np.zeros(n)
    # 0 s : le sceau craque — claquement sec, éclats, petit coup sourd (attaque nette)
    place(out, pierre_fracture(0.09, [(0, 1400), (0.09, 80)], 801, 600, 6000, 0.5, 0.0) * 1.3, 0.0)
    place(out, impact_lourd(0.45, 802, (95, 48), 0.4, 150, 0.7, 0.2, 0.7, dec_sub=0.16), 0.0)
    # 0,1 → 0,88 s : la fissure court sous terre — craquements de plus en plus serrés et forts
    fis = pierre_fracture(0.8, [(0, 15), (0.35, 60), (0.65, 180), (0.8, 320)], 803, 300, 3500, 0.45, 0.6)
    fis *= env([(0, 0.25), (0.4, 0.45), (0.8, 1.0)], len(fis))
    place(out, fis * 0.7, 0.1)
    # grondement de terre + souffle de feu grave qui monte d'en dessous (crescendo jusqu'au jaillissement)
    cres = env([(0, 0.0), (0.15, 0.05), (0.5, 0.2), (0.8, 0.6), (0.9, 1.0), (1.05, 0.45), (1.2, 0.0)], n)
    out += butter_hp(lp(brun(n, 804), 90 + 160 * cres, 0.9), 38, 4) * cres * 3.0
    out += butter_hp(lp(rose(n, 806), 180 + 1000 * cres ** 1.5, 0.7), 45, 2) * cres * 0.9
    out += crepitement(L, 110, 807, 1800, 8500, [(0, 0.05), (0.5, 0.3), (0.88, 1.0), (1.05, 0.5), (1.2, 0.1)]) * 0.4
    # 0,9 s : la faille s'ouvre et le chien jaillit — coup grave, bouffée de feu, mottes de terre
    place(out, impact_lourd(0.32, 808, (120, 42), 0.7, 115, 1.0, 0.6, 0.5, dec_sub=0.14) * 1.1, 0.9)
    m = secs(0.3); tt = np.arange(m) / SR
    bouffee = lp(rose(m, 809), 2600 * np.exp(-tt / 0.08) + 300, 0.8) * np.exp(-tt / 0.09) * np.minimum(1, tt / 0.004)
    place(out, bouffee * 1.2, 0.9)
    place(out, debris(0.3, 22, 810, 0.02, 0.2, 350, 2500, 1) * 0.55, 0.91)
    return _fin(salle(saturate(norm(out) * 1.4, 1.2), 1.3, 0.16, 0.01, 60), L, 0.08)


def _hurleur(L, f_bas, f_haut, f_fin, graine, t_haut=0.4, t_casse=None, echelle=1.0, rauque=0.4, sous=0.2,
             vacille=0.025, derive=0.05):
    """Une voix de hurlement : montée glissée avec léger dépassement, tenue qui vacille et dérive, à-coups de
    raucité, cassure de voix puis chute qui s'éteint."""
    r = np.random.default_rng(graine)
    t_casse = t_casse or L * 0.72
    f0 = [(0, f_bas), (t_haut * 0.55, f_haut * 0.9), (t_haut, f_haut * 1.02), (t_haut + 0.12, f_haut)]
    t, k = t_haut + 0.28, 1
    while t < t_casse - 0.12:                       # vacillement lent et irrégulier (2,5-4 Hz), dérive en arche
        prog = (t - t_haut) / (t_casse - t_haut)
        f0.append((t, f_haut * (1 + derive * np.sin(np.pi * prog)) * (1 + vacille * k * r.uniform(0.6, 1.2))))
        t += r.uniform(0.13, 0.22); k = -k
    f0 += [(t_casse, f_haut * (1 + derive * 0.3)), (t_casse + 0.05, f_haut * 0.72), (t_casse + 0.12, f_haut * 0.76),
           (L * 0.97, f_fin)]                       # la voix casse et retombe
    voy = [(0, 'u'), (t_haut * 0.8, 'o'), (t_casse, 'O'), (L, 'u')]
    env_pts = [(0, 0), (0.04, 0.45), (t_haut, 1.0), (t_casse, 0.9), (t_casse + 0.05, 0.8), (L * 0.88, 0.3), (L, 0)]
    span = t_casse - 0.25 - t_haut
    rq, ss = [(0, rauque)], [(0, sous)]
    for tc in (t_haut + span * r.uniform(0.05, 0.4), t_haut + span * r.uniform(0.6, 0.95)):   # à-coups éraillés
        rq += [(tc, rauque), (tc + 0.05, rauque + 0.3), (tc + 0.15, rauque)]
        ss += [(tc, sous), (tc + 0.05, sous + 0.35), (tc + 0.15, sous)]
    rq += [(t_casse - 0.03, rauque), (t_casse + 0.05, rauque + 0.4), (L, rauque + 0.4)]
    ss += [(t_casse - 0.03, sous), (t_casse + 0.05, sous + 0.5), (L, sous + 0.35)]
    return voix(L, f0, voy, echelle=echelle, rauque=rq, sous=ss, souffle=0.8, gigue=0.015, scintil=0.2, oq=0.55,
                env=env_pts, graine=graine)


@effet('chien_hurlement', cible=-14, notes="Hurlement court (apparition) : arrêter avec un fondu de 0,4 s vers 1,3 s (la montée et la tenue du meneur sont dans la première seconde).", desc="Chiens zombies — hurlement de meute : quatre voix éraillées en grappe chromatique (sol, sol♯, la) et triton (ré), dont une lointaine, qui se cassent ; gorge pourrie dessous")
def chien_hurlement():
    L = 2.5; n = secs(L); pres = np.zeros(n); loin = np.zeros(n)
    place(pres, _hurleur(2.3, 230, 415, 250, 821, t_haut=0.42, rauque=0.4, sous=0.22), 0.0)                 # meneur
    place(pres, _hurleur(2.1, 210, 392, 230, 822, t_haut=0.45, rauque=0.45, sous=0.28, echelle=0.94) * 0.75, 0.25)
    place(pres, _hurleur(1.9, 330, 587, 380, 823, t_haut=0.35, rauque=0.35, sous=0.15, echelle=1.06) * 0.5, 0.5)
    place(loin, _hurleur(1.65, 270, 440, 300, 826, t_haut=0.4, rauque=0.4, sous=0.2, echelle=1.0), 0.75)  # chien lointain
    gorge = _gorge(2.3, [(0, 84), (0.42, 104), (1.6, 110), (2.3, 78)], [(0, 'O'), (0.45, 'a'), (1.7, 'o'), (2.3, 'u')],
                   [(0, 0), (0.1, 0.7), (0.45, 1.0), (1.8, 0.8), (2.3, 0)], 824, souffle=0.9, roule=24, prof=0.45)
    place(pres, gorge * 0.35, 0.0)
    place(pres, gargouillis(2.2, 14, 825, 200, 600, [(0, 0.3), (1.6, 0.6), (2.2, 1.0)]) * 0.06, 0.1)
    p = salle(saturate(norm(pres) * 1.5, 1.4), 2.0, 0.22, 0.02, 64)
    l = salle(lp(norm(loin), 2800) * 0.38, 2.8, 0.7, 0.04, 66)
    return _fin(S(p, l), L, 0.25)


@effet('chien_grognement', cible=-21, mesure='I', boucle=True, cat='effet',
       desc="Chien zombie — grognement guttural continu (boucle 2,0 s : expiration roulée, inspiration rauque, gargouillis)",
       notes="Boucler entre boucleDebut et boucleFin. Périodique par construction (aucun fondu enchaîné) ; la jointure tombe au milieu d'une expiration.")
def chien_grognement():
    L = 2.0; n = secs(L)
    buf = np.zeros(n)
    # temps du cycle : expiration 0 → 1,3 s, inspiration 1,25 → 2,03 s (les deux se chevauchent : pas de trou) ;
    # la boucle commence 0,65 s après le début de l'expiration
    dec = 0.65
    expi = _gorge(1.3, [(0, 56), (0.25, 66), (0.55, 63), (0.8, 64), (1.3, 54)], [(0, 'u'), (0.3, 'O'), (0.9, 'o'), (1.3, 'u')],
                  [(0, 0), (0.08, 0.85), (0.3, 1.0), (1.0, 0.85), (1.18, 0.45), (1.3, 0)], 831,
                  rauque=0.7, sous=0.55, souffle=1.1, roule=26, prof=0.55)
    inspi = _gorge(0.78, [(0, 44), (0.35, 50), (0.78, 46)], [(0, 'u'), (0.35, 'O'), (0.78, 'u')],
                   [(0, 0), (0.07, 0.55), (0.4, 0.75), (0.7, 0.5), (0.78, 0)], 832,
                   rauque=0.85, sous=0.4, souffle=2.2, roule=32, prof=0.6, echelle=0.76)
    m = secs(0.78); tt = np.arange(m) / SR
    sif = bp(rose(m, 833), 1300 + 900 * tt / 0.78, 1.5) * env([(0, 0), (0.1, 0.5), (0.65, 0.7), (0.78, 0)], m) * 0.25
    place_circulaire(buf, expi, 0.0 - dec)
    place_circulaire(buf, (inspi + sif) * 0.6, 1.25 - dec)
    # gargouillis (rendu sur L + 0,05 s puis replié : une bulle qui chevauche la fin de la boucle continue au début)
    g = gargouillis(L + 0.05, 20, 835, 200, 700, [(0, 1.0), (0.6, 0.8), (0.7, 0.2), (1.3, 0.3), (1.4, 1.0), (2.05, 1.0)])
    gg = np.zeros(n); place_circulaire(gg, g, 0.0)
    buf += gg * 0.12
    x = circulaire(lambda y: saturate(y * 2.0 / (np.max(np.abs(y)) + 1e-9), 1.5), buf)
    return circulaire(lambda y: butter_hp(salle(y, 1.1, 0.12, 0.008, 65)[:len(y)], 32, 2), x)


@effet('chien_aboiement', cible=-15, desc="Chien zombie — aboiement rauque et agressif : coup de glotte, « ouarf » chaotique et râpeux, queue grondante et mouillée",
       notes="Un seul aboiement enregistré : pour les aboiements aléatoires, varier la vitesse de lecture (0,85–1,1, plus lent = plus gros chien) et en enchaîner parfois deux à 0,25–0,35 s d'écart.")
def chien_aboiement():
    L = 0.5; n = secs(L); out = np.zeros(n)
    m = secs(0.03); tt = np.arange(m) / SR
    place(out, bp(rose(m, 851), 1600, 0.8) * np.exp(-tt / 0.006) * 0.8, 0.0)          # coup de glotte
    voy = [(0, 'O'), (0.03, 'a'), (0.11, 'ae'), (0.17, 'O'), (0.22, 'u')]
    e = [(0, 0), (0.004, 1.0), (0.06, 0.95), (0.14, 0.5), (0.22, 0)]
    corps = voix(0.22, [(0, 170), (0.03, 250), (0.08, 232), (0.16, 145), (0.22, 115)], voy, echelle=0.8, rauque=0.8,
                 sous=[(0, 0.4), (0.05, 0.75), (0.12, 0.5), (0.22, 0.8)], souffle=1.2, gigue=0.08, scintil=0.5, oq=0.5,
                 inclinaison=7000.0, env=e, graine=852)
    place(out, corps, 0.002)
    m = secs(0.22)
    rape = formants(rose(m, 856), voy, m, 0.8, 1.3) * env(e, m)                     # râpe (souffle dans la gueule)
    place(out, rape * 0.12, 0.002)
    poitrine = _gorge(0.2, [(0, 88), (0.04, 125), (0.2, 70)], [(0, 'O'), (0.05, 'a'), (0.2, 'u')],
                      [(0, 0), (0.005, 1.0), (0.1, 0.6), (0.2, 0)], 853, rauque=0.8, sous=0.6, souffle=0.6, roule=30, prof=0.5, echelle=0.7)
    place(out, poitrine * 0.6, 0.002)
    queue = _gorge(0.3, [(0, 70), (0.3, 55)], [(0, 'u'), (0.3, 'O')], [(0, 0), (0.04, 0.5), (0.2, 0.3), (0.3, 0)], 854,
                   rauque=0.7, sous=0.5, souffle=1.3, roule=27, prof=0.6)
    place(out, queue * 0.4, 0.17)
    place(out, gargouillis(0.3, 25, 855, 220, 700) * 0.15, 0.15)
    x = saturate(norm(out) * 2.2, 2.0)
    return _fin(salle(x, 1.0, 0.14, 0.006, 61), L, 0.05)


@effet('chien_morsure', cible=-15.5, pic=0.0, desc="Chien zombie — morsure : claquement de mâchoire, crocs qui se referment (deux contacts à 16 ms), salive, rictus grondant et soufflé",
       notes="Joué à chaque morsure : varier la vitesse de lecture (0,92–1,08) pour éviter l'effet mitraillette.")
def chien_morsure():
    L = 0.35; n = secs(L)
    # lit : rictus (grondement bref + souffle râpeux entre les crocs) + salive + gargouillis
    lit = np.zeros(n)
    gr = _gorge(0.32, [(0, 110), (0.05, 135), (0.32, 72)], [(0, 'a'), (0.08, 'ae'), (0.32, 'u')],
                [(0, 0), (0.008, 1.0), (0.1, 0.7), (0.32, 0)], 875, rauque=0.8, sous=0.6, souffle=1.3, roule=30, prof=0.5, echelle=0.75)
    place(lit, gr, 0.0)
    place(lit, chair(0.14, 874, 1.0, 0.3) * 0.7, 0.008)                    # salive, chair
    place(lit, gargouillis(0.25, 30, 876, 250, 800) * 0.2, 0.03)
    m = secs(0.3)
    voy = [(0, 'ae'), (0.1, 'E'), (0.3, 'a')]
    rape = formants(rose(m, 877), voy, m, 0.85, 1.4) * env([(0, 0), (0.006, 1.0), (0.09, 0.6), (0.3, 0)], m)
    lit = norm(lit) + norm(ajuste(rape, n)) * 0.8
    lit = saturate(norm(lit) * 1.8, 1.5)
    # le lit est tassé (limiteur −8 dB) : sa sonie monte sans que ses crêtes ne masquent le claquement
    lit = norm(limiter(norm(lit), -8.0, 0.03, 0.002))
    # claquement : canines (0 s) puis fermeture complète (16 ms), crissement entre les deux ; écrêtage doux
    cl = np.zeros(n)
    place(cl, claquement_dents(871, 2400, L=0.15), 0.0)
    place(cl, claquement_dents(872, 1900, sec=1.4, L=0.15) * 0.9, 0.016)
    place(cl, pierre_fracture(0.03, [(0, 1500), (0.03, 0)], 873, 2500, 7000, 0.0, 0.0) * 0.4, 0.004)
    cl = np.tanh(norm(cl) * 3.0) / np.tanh(3.0)
    x = lit * 0.5 + cl * 0.65
    return _fin(salle(x, 0.8, 0.1, 0.004, 62), L, 0.04)


@effet('chien_mort', cible=-15, pic=0.38, desc="Chien zombie — mort : jappement étranglé qui se casse, déglutition, chute de la carcasse (0,38 s), os, souffle de cendres et dernier râle")
def chien_mort():
    L = 1.2; n = secs(L); out = np.zeros(n)
    jap = voix(0.3, [(0, 560), (0.04, 780), (0.12, 720), (0.17, 540), (0.2, 380), (0.3, 300)],
               [(0, 'E'), (0.05, 'i'), (0.15, 'E'), (0.3, 'a')], echelle=0.95,
               rauque=[(0, 0.2), (0.15, 0.4), (0.2, 0.9), (0.3, 0.9)], sous=[(0, 0), (0.15, 0), (0.19, 0.7), (0.3, 0.7)],
               souffle=0.7, gigue=0.03, scintil=0.3,
               env=[(0, 0), (0.006, 0.9), (0.05, 1.0), (0.16, 0.85), (0.24, 0.5), (0.27, 0.12), (0.3, 0)], graine=881)
    place(out, jap * 0.62, 0.0)
    m = secs(0.03); tt = np.arange(m) / SR
    place(out, bp(noise(m, 882), 1100, 3.0) * np.exp(-tt / 0.008) * 0.5, 0.26)       # déglutition
    place(out, gargouillis(0.35, 40, 883, 200, 650) * 0.25, 0.24)
    place(out, impact_lourd(0.6, 884, (90, 40), 0.75, 100, 1.5, 0.5, 0.25, dec_sub=0.16) * 1.2, 0.38)   # chute de la carcasse
    place(out, os_cliquetis(0.5, 7, 885) * 0.6, 0.39)
    place(out, souffle(0.78, 2600, 350, 0.25, 0.9, 886) * 0.6, 0.42)               # cendres
    place(out, crepitement(0.78, 120, 887, 1800, 8500, [(0, 1), (0.78, 0)]) * 0.35, 0.42)
    m = secs(0.78)
    place(out, hp(rose(m, 888), 3500) * env([(0, 0), (0.1, 0.5), (0.78, 0)], m) * 0.15, 0.42)
    rale = _gorge(0.55, [(0, 48), (0.55, 38)], [(0, 'O'), (0.55, 'u')], [(0, 0), (0.08, 0.6), (0.4, 0.3), (0.55, 0)], 889,
                  rauque=0.9, sous=0.5, souffle=2.4, roule=22, prof=0.6, oq=0.75)
    place(out, rale * 0.35, 0.5)
    return _fin(salle(out, 1.4, 0.16, 0.01, 63), L, 0.1)


# ════════════════════════════ CUVES ET MINI-BOSS (v1.3, API.md §15.6) ════════════════════════════
# Cuves de verre épais pleines d'un liquide vert, Le Survolté (électricien de ligne foudroyé) et L'Irradié (technicien
# de centrale irradié). Tout est synthétisé ; mono et positionnel sauf le stinger miniboss_apparition (stéréo).

def _electrise(x, seed, f_bz=100.0, prof=0.45, hachures=5):
    """Déformation électrique d'une voix : modulation par un bourdon à f_bz (bandes latérales grinçantes), hachures
    (un grain de 8-20 ms répété pendant 30-70 ms, fondus de 1 ms) et blocage d'échantillons sur un passage."""
    r = np.random.default_rng(seed); x = np.array(x, dtype=np.float64); n = len(x); t = np.arange(n) / SR
    y = x * (1 - prof + prof * (0.5 + 0.5 * np.sin(TAU * f_bz * t)) ** 2 / 0.375)
    xf = secs(0.001)
    for _ in range(hachures):
        i0 = int(r.integers(secs(0.08), n - secs(0.15)))
        g = secs(r.uniform(0.008, 0.02)); d = secs(r.uniform(0.03, 0.07))
        w = np.ones(g); w[:xf] = np.linspace(0, 1, xf); w[-xf:] = np.linspace(1, 0, xf)
        rep = np.tile(y[i0:i0 + g] * w, d // g + 1)[:d]
        f = np.ones(d); f[:xf] = np.linspace(0, 1, xf); f[-xf:] = np.linspace(1, 0, xf)
        y[i0:i0 + d] = y[i0:i0 + d] * (1 - f) + rep * f
    i0 = int(r.integers(secs(0.2), n - secs(0.2))); d = secs(0.09); k = 6; e = secs(0.005)
    held = y[i0:i0 + d][(np.arange(d) // k) * k]
    f = np.ones(d); f[:e] = np.linspace(0, 1, e); f[-e:] = np.linspace(1, 0, e)
    y[i0:i0 + d] = y[i0:i0 + d] * (1 - f) + held * f
    return y


def _rafale(n_eclairs=6, seed=1, g=1.0):
    """Claquement d'arc : rafale de décharges très brillantes sur ≈ 12 ms."""
    r = np.random.default_rng(seed); out = np.zeros(secs(0.03)); t = 0.0
    for k in range(n_eclairs):
        m = secs(0.01); tt = np.arange(m) / SR
        place(out, hp(noise(m, int(r.integers(1 << 30))), 1200 + 1300 * k) * np.exp(-tt / 0.0022) * r.uniform(0.6, 1.0), t)
        t += r.uniform(0.0015, 0.003)
    return out * g


@effet('tube_siphon', cible=-15, desc="Cuve siphonnée : le liquide épais est aspiré (glouglous qui s'accélèrent), bouillonnement qui s'affole, grondement qui monte jusqu'à l'éclatement",
       notes="Évènement tube « siphon » (début de l'étape aspiration, 2,2 s). Finit au sommet à 2,2 s, quand tube « eclate » lance tube_eclatement ; tube_fissure se superpose à 1,32 s.")
def tube_siphon():
    L = 2.2; n = secs(L); out = np.zeros(n); r = np.random.default_rng(901)
    k = env([(0, 0.12), (0.3, 0.18), (1.2, 0.5), (2.0, 0.9), (2.2, 1.0)], n)        # progression générale
    m = secs(0.12); tt = np.arange(m) / SR                                           # « schlup » d'amorçage
    place(out, lp(rose(m, 900), 1400, 0.8) * np.exp(-tt / 0.03) * np.minimum(1, tt / 0.002) * 0.5, 0.0)
    place(out, bulle(95, 0.1, 0.9, 899, 0.3) * 0.6, 0.0)
    t = 0.12
    while t < L - 0.05:                         # glouglous : grosses bulles graves de plus en plus rapprochées
        p = t / L
        place(out, bulle(70 + 60 * p + r.uniform(-10, 10), r.uniform(0.07, 0.12), r.uniform(0.6, 1.0), int(r.integers(1 << 30)), 0.3)
              * (0.5 + 0.6 * p) * r.uniform(0.7, 1.0), t)
        t += r.uniform(0.75, 1.25) * (0.26 - 0.17 * p)
    out += gargouillis(L, 90, 902, 180, 1200, [(0, 0.05), (0.6, 0.25), (1.4, 0.6), (2.2, 1.0)]) * 0.35   # bouillonnement
    suc = bp(rose(n, 903), 220 * (1500 / 220) ** env([(0, 0), (2.2, 1.0)], n), 1.3)                     # succion
    suc *= 1 + 0.6 * np.tanh(2 * smooth_noise(n, 9, 904))
    out += suc * k * 0.5
    tt = np.arange(n) / SR                                                           # grondement 38 → 72 Hz
    f = 38 * (72 / 38) ** (tt / L) ** 1.3
    gr = sum(np.sin(TAU * np.cumsum(f * h) / SR) / h for h in range(1, 7))
    out += lp(saturate(gr * 0.6, 2.0), 500) * k ** 1.5 * 0.7
    out += scintillement(L, 2200, 12, 905, 0.5, [(0, 0), (1.0, 0.3), (2.2, 1.0)]) * 0.06                 # énergie verte
    return _fin(salle(out, 1.4, 0.15, 0.01, 70), L, 0.03)


@effet('tube_fissure', cible=-15, pic=0.0, desc="Le verre épais de la cuve se fend sous la pression : craquement cristallin, fissure qui court, verre qui résonne et gémit, jet de liquide qui fuse",
       notes="Évènement tube « fissure » (1,32 s après le début du siphon), par-dessus tube_siphon.")
def tube_fissure():
    L = 0.8; n = secs(L); out = np.zeros(n); r = np.random.default_rng(911)
    m = secs(0.02); tt = np.arange(m) / SR
    place(out, hp(noise(m, 912), 1800) * np.exp(-tt / 0.0025) * 1.2, 0.0)          # contact sec
    m = secs(0.03); tt = np.arange(m) / SR                                           # craquement de contrainte : chirp dispersif
    place(out, np.sin(TAU * np.cumsum(900 + 5200 * np.exp(-tt / 0.005)) / SR) * np.exp(-tt / 0.009) * 0.9, 0.0)
    place(out, pierre_fracture(0.04, [(0, 1500), (0.04, 100)], 919, 1500, 8000, 0.0, 0.0) * 0.8, 0.0)
    place(out, verre(L, 1150, 913, 0.9, 0.3) * 0.55, 0.0)                            # le verre sonne, étouffé par le liquide
    t = 0.03
    while t < 0.6:                                                                   # la fissure court
        g = r.uniform(0.25, 0.6)
        place(out, verre(0.15, r.uniform(1800, 4200), int(r.integers(1 << 30)), 1.0, 0.12) * g * 0.5, t)
        place(out, craquement(r.uniform(0.004, 0.012), int(r.integers(1 << 30)), r.uniform(3000, 7000), r.uniform(2, 6)) * g, t)
        t += r.uniform(0.012, 0.05) * (1 + 2.5 * (t / 0.6) ** 2)
    place(out, verre(0.3, 980, 914, 1.0, 0.3) * 0.6, 0.5)                            # dernier éclat
    place(out, pierre_fracture(0.03, [(0, 1200), (0.03, 80)], 920, 1500, 8000, 0.0, 0.0) * 0.6, 0.5)
    pl = bp(brun(n, 915), 300 + 120 * smooth_noise(n, 3, 916), 6.0) * env([(0, 0.6), (0.3, 0.4), (0.8, 0)], n) * 2.2
    out += butter_hp(pl, 60, 2)                                                       # le verre gémit
    out += bp(rose(n, 917), 4200 + 800 * smooth_noise(n, 5, 918), 1.4) * env([(0, 0), (0.12, 0.0), (0.25, 0.5), (0.6, 0.35), (0.8, 0)], n) * 0.6
    return _fin(salle(saturate(norm(out) * 1.4, 1.3), 1.0, 0.15, 0.008, 71, sombre=False), L, 0.06)


@effet('tube_eclatement', cible=-11, pic=0.0, desc="Cuve qui explose : déflagration, fracas et gerbe de tessons, éclaboussure de liquide épais, verre qui retombe, gouttes",
       notes="Évènement tube « eclate ». Le mini-boss est libéré 0,6 s plus tard (miniboss_apparition).")
def tube_eclatement():
    L = 1.5; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 921, (120, 40), 0.75, 125, 1.0, 0.3, 0.8, dec_sub=0.3)
    m = secs(0.08); tt = np.arange(m) / SR
    place(out, hp(rose(m, 922), 2500) * np.exp(-tt / 0.02) * 1.3, 0.0)               # fracas
    place(out, tessons(0.4, 70, 923, 0.0, 0.08, 2500, 9000, 0) * 0.9, 0.0)            # gerbe
    place(out, tessons(1.4, 45, 924, 0.15, 0.9, 1800, 8000, 2) * 0.6, 0.05)           # tessons qui retombent
    place(out, verre(1.2, 820, 925, 0.8, 0.9) * 0.35, 0.0)
    sp = lp(rose(n, 926), 2200 * np.exp(-np.arange(n) / SR / 0.15) + 400, 0.8) * env([(0, 0), (0.01, 1.0), (0.15, 0.5), (0.5, 0.15), (1.5, 0)], n)
    sp *= 1 + 0.8 * np.tanh(2 * smooth_noise(n, 30, 927))
    out += sp * 0.8                                                                   # éclaboussure
    out += gargouillis(L, 60, 928, 300, 1500, [(0, 1.0), (0.4, 0.5), (1.5, 0.1)]) * 0.35
    r = np.random.default_rng(929)
    for _ in range(14):                                                               # gouttes
        t0 = 0.15 + r.exponential(0.35)
        if t0 < L - 0.1:
            place(out, goutte(r.uniform(600, 1300), 0.15, int(r.integers(1 << 30))) * r.uniform(0.15, 0.4), t0)
    return _fin(salle(saturate(out * 1.1, 1.3), 1.8, 0.22, 0.012, 72), L, 0.15)


@effet('miniboss_apparition', stereo=True, cible=-12, pic=0.0, desc="Stinger d'arrivée d'un mini-boss (stéréo, non positionnel) : impact, braam de cuivres graves en ré mineur, chœur, début du leitmotiv (ré–fa–mi) aux cuivres",
       notes="Évènement miniBoss « libere », non positionnel. Musical (ré mineur, comme la partition) : bus effets ou musique au choix. Lancer le cri du mini-boss (survolte_cri / irradie_cri, positionnel) ≈ 0,2 s après.")
def miniboss_apparition():
    from lib.musique import Morceau
    M = Morceau(2.0, boucle=False, queue=0.5)
    pe, br, ch, fx = M.bus('perc', 0.2), M.bus('cuivres', 0.3), M.bus('choeur', 0.45), M.bus('fx', 0.3)
    pe.add(I.boom(34, 2.4, 1.0), 0.0, 1.3, 0.0)
    pe.add(I.taiko(50, 1.0, 2.0, 931), 0.0, 1.1, 0.0)
    pe.add(I.anvil(700, 0.7, 2.0, 932), 0.0, 0.7, 0.15)
    pe.add(I.crash(0.8, 2.4, 933), 0.0, 0.6, 0.25)
    br.add(I.braam([26, 38, 45, 50], 2.2, 1.0, 934), 0.0, 1.2, 0.0)
    for k, (t0, m) in enumerate([(0.55, 50), (0.85, 53), (1.15, 52)]):            # ré–fa–mi : le leitmotiv
        d = 0.5 if k < 2 else 1.0
        br.add(I.brass(m - 12, d, 0.85, 4, 0.04, 0.3, 0.5, 935 + k), t0, 0.9, -0.15)
        br.add(I.brass(m, d, 0.7, 4, 0.04, 0.3, 0.3, 940 + k), t0, 0.6, 0.15)
    for i, m in enumerate([50, 57, 62, 65]):
        ch.add(I.choir(m, 2.2, 'a', 0.8, 10, 0.04, 1.0, 'o', 945 + i), 0.0, 1.0, (-0.4, 0.4, -0.2, 0.2)[i])
    ch.add(I.choir(75, 1.6, 'a', 0.45, 8, 0.3, 0.8, None, 950), 0.35, 0.5, 0.3)       # mi♭ aigu : menace
    fx.add(murmures(1.8, 4, 7, 1.0, 951, stereo=True, env=[(0, 0.6), (1.8, 0)]), 0.05, 0.4)
    ir = make_ir(2.6, 0.02, seed=952)
    cib = {'perc': -16, 'cuivres': -18, 'choeur': -23, 'fx': -27}
    fxs = {'choeur': lambda x: peak_eq(butter_hp(x, 140, 2), 340, -3, 0.9), 'cuivres': lambda x: butter_hp(x, 38, 2)}
    out, _ = M.rendu(ir, cib, fxs, -14.0, fin_fondu=0.6)
    return _fin(out, 2.5, 0.05)


@effet('survolte_bourdon', cible=-22, mesure='I', boucle=True, cat='boucle', desc="Le Survolté — bourdonnement électrique autour de lui : ronflement de transformateur (50/100 Hz), effluves hachées qui grésillent, petits arcs (boucle 2,0 s)",
       notes="Boucle sur le Survolté vivant, entre boucleDebut et boucleFin. Peut monter de 3 dB et accélérer (vitesse 1,05) pendant survolte_charge.")
def survolte_bourdon():
    L = 2.0; n = secs(L); t = np.arange(n) / SR
    hum = sum(a * np.sin(TAU * 50.0 * k * t + 0.7 * k) for k, a in
              [(1, 0.5), (2, 1.0), (3, 0.8), (4, 0.45), (5, 0.3), (6, 0.35), (7, 0.15), (8, 0.18), (10, 0.1), (12, 0.08), (14, 0.05)])
    hum = hum * am_boucle(L, 3, 0.25) * am_boucle(L, 5, 0.15, 1.3)
    hum = circulaire(lambda y: saturate(y * 0.5, 2.5), hum)
    cour = bruit_periodique(n, bande(2500, 9000, 2.0), 961) * (0.5 + 0.5 * np.sin(TAU * 100.0 * t)) ** 4   # effet couronne
    cour *= am_boucle(L, 2, 0.6, 0.4) * am_boucle(L, 7, 0.4, 2.0)
    buf = np.zeros(n)
    place_circulaire(buf, crepitement(L + 0.05, 30, 962, 1800, 9000), 0.0)           # grésillements (repliés)
    r = np.random.default_rng(963)
    for t0 in (0.31, 0.88, 1.47, 1.71):                                                 # petits arcs
        d = r.uniform(0.04, 0.09)
        place_circulaire(buf, arc_electrique(d, int(r.integers(1 << 30)), 100.0, r.uniform(2500, 4500),
                                             [(0, 0), (0.004, 1.0), (d * 0.6, 0.6), (d, 0)]) * r.uniform(0.25, 0.5), t0)
    x = hum * 0.6 + cour * 0.35 + buf * 0.5
    return circulaire(lambda y: butter_hp(salle(y, 0.9, 0.1, 0.006, 73)[:len(y)], 32, 2), x)


@effet('survolte_charge', cible=-15, desc="Le Survolté — montée de charge avant la décharge : sifflement de condensateur qui grimpe, bourdon haché qui s'accélère, crépitements de plus en plus serrés ; sommet à 0,8 s",
       notes="audio.sonMiniBoss('survolte', 'charge') ≈ 0,8 s avant la décharge : le sommet (fin du son) doit tomber sur le claquement de survolte_decharge.")
def survolte_charge():
    L = 0.8; n = secs(L); t = np.arange(n) / SR; k = t / L
    f = 180 * (2600 / 180) ** (k ** 1.4)
    whine = (np.sin(TAU * np.cumsum(f) / SR) + 0.35 * np.sin(TAU * np.cumsum(f * 2.01) / SR) + 0.2 * np.sin(TAU * np.cumsum(f * 3.03) / SR)) * k ** 1.6
    rate = 12 + 90 * k ** 1.5
    pul = (0.5 + 0.5 * np.sin(TAU * np.cumsum(rate) / SR)) ** 3
    bz = bp(saturate(saw(np.full(n, 100.0), 0.0), 3.0), 900 + 2500 * k, 0.8) * pul * (0.3 + 0.7 * k)
    cr = crepitement(L, 120, 971, 2000, 9000, [(0, 0.1), (0.5, 0.4), (0.8, 1.0)])
    sw = bp(rose(n, 972), 400 * (6000 / 400) ** k, 1.5) * k ** 2.5
    x = whine * 0.35 + bz * 0.5 + cr * 0.35 + sw * 0.4
    return _fin(salle(x, 0.8, 0.08, 0.005, 74, sombre=False), L, 0.012)


@effet('survolte_decharge', cible=-12, pic=0.0, desc="Le Survolté — décharge : claquement d'arc violent, arc qui crache et siffle (4,2 → 1,5 kHz), crépitements qui retombent",
       notes="audio.sonMiniBoss('survolte', 'decharge') au tir (claquement à 0 s).")
def survolte_decharge():
    L = 0.6; n = secs(L); out = np.zeros(n)
    place(out, _rafale(6, 981), 0.0)
    place(out, impact_lourd(0.3, 982, (110, 55), 0.35, 150, 0.8, 0.0, 0.6, dec_sub=0.08) * 0.7, 0.0)
    place(out, arc_electrique(0.42, 983, 100.0, 3600, [(0, 0), (0.003, 1.0), (0.15, 0.75), (0.42, 0)], siffle=[(0, 4200), (0.42, 1500)]) * 0.9, 0.0)
    place(out, crepitement(0.55, 150, 984, 2000, 9000, [(0, 1.0), (0.55, 0)]) * 0.45, 0.04)
    return _fin(salle(saturate(out, 1.4), 1.0, 0.14, 0.006, 75, sombre=False), L, 0.05)


@effet('survolte_spasme', cible=-16, desc="Le Survolté — spasme : grésillement bref et râle saccadé (le courant le secoue)",
       notes="audio.sonMiniBoss('survolte', 'spasme'). Varier la vitesse (0,9–1,1) d'un spasme à l'autre.")
def survolte_spasme():
    L = 0.4; n = secs(L); out = np.zeros(n); r = np.random.default_rng(991)
    v = voix(0.36, [(0, 125), (0.1, 150), (0.36, 105)], [(0, 'a'), (0.15, 'E'), (0.36, 'a')], echelle=0.86, rauque=0.6, sous=0.4,
             souffle=0.8, gigue=0.05, scintil=0.3, env=[(0, 0), (0.01, 1.0), (0.25, 0.7), (0.36, 0)], graine=992)
    m = len(v); gate = np.zeros(m); t0 = 0.0
    while t0 < 0.36:                                                                   # à-coups irréguliers
        d = r.uniform(0.025, 0.05); i0, i1 = secs(t0), min(m, secs(t0 + d))
        if i1 > i0:
            gate[i0:i1] = np.maximum(gate[i0:i1], np.sin(np.linspace(0, np.pi, i1 - i0)) ** 0.6 * r.uniform(0.6, 1.0))
        t0 += d + r.uniform(0.008, 0.03)
    place(out, v * gate, 0.0)
    place(out, arc_electrique(0.2, 993, 100.0, 3000, [(0, 0), (0.003, 1.0), (0.2, 0)]) * 0.5, 0.0)
    place(out, crepitement(0.3, 140, 994, 2000, 9000, [(0, 1), (0.3, 0)]) * 0.3, 0.0)
    return _fin(salle(saturate(norm(out) * 1.6, 1.5), 0.8, 0.1, 0.005, 76), L, 0.04)


@effet('survolte_cri', cible=-13, desc="Le Survolté — cri rauque déformé par le courant (libération) : voix qui grince sur le 100 Hz, hachures, sauts de hauteur, arcs",
       notes="À la libération (miniBoss « libere », type survolte), positionnel, ≈ 0,2 s après miniboss_apparition.")
def survolte_cri():
    L = 1.5; n = secs(L); out = np.zeros(n)
    f0 = [(0, 170), (0.08, 255), (0.35, 290), (0.44, 300), (0.46, 390), (0.52, 385), (0.54, 295), (0.9, 280), (0.92, 210),
          (0.98, 215), (1.0, 270), (1.25, 230), (1.45, 150)]
    e = [(0, 0), (0.025, 1.0), (0.5, 0.9), (1.1, 0.6), (1.45, 0)]
    a = voix(1.45, f0, [(0, 'a'), (0.3, 'E'), (0.8, 'a'), (1.45, 'o')], echelle=0.9, rauque=0.6, sous=0.35, souffle=0.6, gigue=0.03,
             scintil=0.3, env=e, graine=1051)
    g = voix(1.45, [(t, f * 0.5) for t, f in f0], [(0, 'a'), (1.45, 'o')], echelle=0.75, rauque=0.8, sous=0.6, souffle=0.5, env=e,
             graine=1052) * 0.45
    place(out, saturate(_electrise(norm(a + g), 1053, 100.0, 0.45, 6) * 1.5, 1.6), 0.0)
    for t0 in (0.0, 0.46, 0.92):                                                       # arcs aux sauts de hauteur
        place(out, arc_electrique(0.12, int(1054 + 100 * t0), 100.0, 3400, [(0, 0), (0.003, 1.0), (0.12, 0)]) * 0.35, t0)
    out += crepitement(L, 50, 1057, 2000, 9000, [(0, 0.8), (1.5, 0.2)]) * 0.2
    return _fin(salle(out, 1.4, 0.16, 0.01, 80), L, 0.12)


@effet('survolte_mort', cible=-13, pic=0.0, desc="Le Survolté — mort : court-circuit (claquement, arc qui saute à 0,2 s), gerbe d'étincelles, chute du corps et des outils (0,55 s), dernier ronflement qui s'éteint",
       notes="À la mort du Survolté (miniBoss « mort »), positionnel ; couper survolte_bourdon au même instant (fondu 0,1 s) : le son prend le relais.")
def survolte_mort():
    L = 1.5; n = secs(L); out = np.zeros(n); r = np.random.default_rng(1001)
    place(out, _rafale(7, 1002, 1.1), 0.0)
    out += impact_lourd(L, 1003, (100, 45), 0.5, 140, 0.9, 0.2, 0.9, dec_sub=0.12) * 0.8
    place(out, arc_electrique(0.2, 1004, 100.0, 3200, [(0, 0), (0.003, 1.0), (0.18, 0.9), (0.2, 0)]) * 0.7, 0.0)
    place(out, _rafale(4, 1005, 0.7), 0.2)                                             # le disjoncteur saute
    out += crepitement(L, 220, 1006, 2500, 10000, [(0, 0.2), (0.05, 1.0), (0.45, 0.5), (1.1, 0)]) * 0.4   # étincelles
    for _ in range(16):                                                                 # éclats d'étincelles qui tintent
        t0 = 0.04 + r.exponential(0.25)
        if t0 < L - 0.1:
            place(out, modes(0.06, r.uniform(5000, 9000), [1.0, 1.5], [1.0, 0.4], [0.02, 0.012], int(r.integers(1 << 30)), 0.3, 7000, 0.002) * r.uniform(0.05, 0.15), t0)
    place(out, impact_lourd(0.6, 1007, (85, 45), 0.45, 110, 1.1, 0.3, 0.15, dec_sub=0.12), 0.55)   # chute
    place(out, os_cliquetis(0.5, 8, 1008, 1400, 4200) * 0.45, 0.56)                    # ceinture à outils
    m = secs(1.25); tt = np.arange(m) / SR                                             # ronflement qui s'éteint
    f = 100 * (32 / 100) ** (tt / 1.25)
    hm = sum(np.sin(TAU * np.cumsum(f * h) / SR) / h for h in (1, 2, 3, 4))
    hm *= env([(0, 0), (0.03, 0.8), (0.6, 0.4), (1.25, 0)], m) * (0.6 + 0.4 * (smooth_noise(m, 14, 1009) > -0.3))
    place(out, saturate(hm * 0.6, 2.0) * 0.5, 0.22)
    return _fin(salle(out, 1.6, 0.18, 0.01, 81), L, 0.12)


@effet('irradie_geiger', cible=-24, mesure='I', boucle=True, cat='boucle', desc="L'Irradié — aura : crépitement irrégulier de compteur Geiger (rafales et accalmies) sur un léger souffle radioactif (boucle 2,0 s)",
       notes="Boucle sur l'Irradié vivant. Conseil : gain selon la distance au joueur, nettement plus fort sous 3 m (aura.rayon) ; vitesse 1,0 → 1,3 quand le joueur est dans l'aura (le compteur s'affole).")
def irradie_geiger():
    L = 2.0; n = secs(L); r = np.random.default_rng(1011); buf = np.zeros(n)
    tt = np.arange(n) / SR
    taux = 40 * (1 + 0.6 * np.sin(TAU * tt / L + 0.4) + 0.35 * np.sin(TAU * 3 * tt / L + 1.9) + 0.25 * np.sin(TAU * 5 * tt / L + 0.2))
    taux = np.maximum(taux, 4)
    t = 0.0
    while True:
        t += r.exponential(1.0 / taux[min(n - 1, secs(t))])
        if t >= L:
            break
        place_circulaire(buf, tic_geiger(int(r.integers(1 << 30)), r.uniform(0.75, 1.0)), t)
        if r.uniform() < 0.12:                                                          # petite rafale
            for _ in range(int(r.integers(1, 4))):
                t += r.uniform(0.004, 0.012)
                place_circulaire(buf, tic_geiger(int(r.integers(1 << 30)), r.uniform(0.6, 0.95)), t % L)
    hum = (bruit_periodique(n, bande(80, 400, 2.0), 1012) * 0.02 + sinus_boucle(L, 55.0) * 0.012 + sinus_boucle(L, 110.0, 0.5) * 0.008) * 3
    return circulaire(lambda y: butter_hp(salle(y, 0.6, 0.06, 0.004, 77, sombre=False)[:len(y)], 32, 2), buf + hum)


@effet('irradie_rale', cible=-22, mesure='I', boucle=True, cat='boucle', desc="L'Irradié — respiration lourde et gargouillante à travers un masque : inspiration sifflée, expiration grondante, clapets de caoutchouc, bulles (boucle 3,0 s)",
       notes="Boucle sur l'Irradié vivant, entre boucleDebut et boucleFin ; la jointure tombe au milieu de l'expiration.")
def irradie_rale():
    L = 3.0; n = secs(L); buf = np.zeros(n); dec = 0.75                # la boucle commence 0,75 s après le début de l'expiration
    ins = voix(1.1, [(0, 44), (0.5, 50), (1.1, 46)], [(0, 'u'), (0.5, 'O'), (1.1, 'u')], echelle=0.72, rauque=0.8, sous=0.3,
               souffle=3.0, oq=0.78, gigue=0.04, env=[(0, 0), (0.12, 0.55), (0.7, 0.75), (1.0, 0.4), (1.1, 0)], graine=1021,
               roule=30, roule_prof=0.45)
    m = secs(1.1); tt = np.arange(m) / SR
    sif = bp(rose(m, 1022), 900 + 700 * tt / 1.1, 2.0) * env([(0, 0), (0.15, 0.6), (0.9, 0.8), (1.1, 0)], m) * 0.3   # filtre du masque
    exp_ = voix(1.55, [(0, 60), (0.4, 64), (1.55, 50)], [(0, 'O'), (0.8, 'o'), (1.55, 'u')], echelle=0.68, rauque=0.85, sous=0.55,
                souffle=1.8, oq=0.7, gigue=0.04, env=[(0, 0), (0.1, 0.9), (0.5, 1.0), (1.3, 0.6), (1.55, 0)], graine=1023,
                roule=24, roule_prof=0.55)
    clapet = lambda s: S(bulle(150, 0.035, 0.3, s, 0.6), bp(noise(secs(0.03), s + 1), 900, 3.0) * np.exp(-np.arange(secs(0.03)) / SR / 0.006) * 0.6)
    flut = np.zeros(secs(0.12))
    for k in range(4):                                                                  # le clapet bat à l'expiration
        place(flut, clapet(1030 + k) * (1 - 0.18 * k), k * 0.026)
    # temps du cycle : expiration 0 → 1,55 s, inspiration 1,7 → 2,8 s
    place_circulaire(buf, exp_, 0.0 - dec)
    place_circulaire(buf, flut * 0.5, 0.0 - dec)
    place_circulaire(buf, (ins + sif) * 0.75, 1.7 - dec)
    place_circulaire(buf, clapet(1040) * 0.4, 1.7 - dec)
    g = gargouillis(L + 0.05, 26, 1041, 140, 650, [(0, 1.0), (0.8, 0.9), (0.95, 0.3), (2.05, 0.4), (2.25, 1.0), (3.05, 1.0)])
    place_circulaire(buf, g * 0.25, 0.0)
    def masque(y):   # saturation puis étouffement du masque (passe-bas raide), résonance de boîte, creux à 1,5 kHz
        y = saturate(y / (np.max(np.abs(y)) + 1e-9) * 1.6, 1.4)
        y = butter_lp(y, 2600, 4)
        y = peak_eq(y, 760, 6.0, 3.0)
        return peak_eq(y, 1500, -4.0, 1.5)
    x = circulaire(masque, buf)
    return circulaire(lambda y: butter_hp(salle(y, 0.8, 0.08, 0.006, 82)[:len(y)], 32, 2), x)


@effet('irradie_cri', cible=-13, desc="L'Irradié — beuglement lourd et humide (libération) : gorge énorme pleine de liquide, bouillonnement, bave qui gicle",
       notes="À la libération (miniBoss « libere », type irradie), positionnel, ≈ 0,2 s après miniboss_apparition.")
def irradie_cri():
    L = 2.0; n = secs(L); out = np.zeros(n)
    f0 = [(0, 70), (0.25, 98), (0.9, 104), (1.4, 92), (1.9, 60)]
    e = [(0, 0), (0.02, 0.6), (0.3, 1.0), (1.4, 0.85), (1.8, 0.3), (1.9, 0)]
    voy = [(0, 'O'), (0.3, 'a'), (1.2, 'o'), (1.9, 'u')]
    bas = voix(1.9, f0, voy, echelle=0.66, rauque=0.7, sous=0.6, souffle=0.9, gigue=0.03, env=e, graine=1061, roule=18, roule_prof=0.35)
    mil = voix(1.9, [(t, f * 2.02) for t, f in f0], voy, echelle=0.8, rauque=0.5, sous=0.3, souffle=0.8, gigue=0.025, env=e, graine=1062) * 0.5
    place(out, saturate(norm(bas + mil) * 1.6, 1.6), 0.0)
    place(out, gargouillis(1.9, 70, 1063, 120, 700, [(0, 0.4), (0.3, 1.0), (1.5, 0.8), (1.9, 0.2)]) * 0.45, 0.0)
    place(out, chair(0.3, 1064, 1.0, 0.0) * 0.25, 0.05)                                 # bave qui gicle
    place(out, chair(0.3, 1065, 1.0, 0.0) * 0.2, 0.62)
    return _fin(salle(out, 1.6, 0.2, 0.012, 83), L, 0.15)


@effet('irradie_mort', cible=-13, pic=0.45, desc="L'Irradié — mort : râle qui s'étrangle, effondrement de la masse (0,3 s), éclatement humide des pustules (0,45 s), grésillement acide et compteur qui s'éteignent",
       notes="À la mort de l'Irradié (miniBoss « mort »), positionnel ; couper irradie_geiger et irradie_rale (fondu 0,3 s) et enchaîner flaque_toxique (boucle) au même point pendant flaque.duree (5 s).")
def irradie_mort():
    L = 1.8; n = secs(L); out = np.zeros(n); r = np.random.default_rng(1031)
    place(out, voix(0.4, [(0, 95), (0.15, 82), (0.4, 55)], [(0, 'a'), (0.4, 'u')], echelle=0.68, rauque=0.85, sous=0.6, souffle=1.4,
                    env=[(0, 0), (0.008, 0.9), (0.3, 0.6), (0.4, 0)], graine=1032, roule=20, roule_prof=0.4) * 0.6, 0.0)
    m = secs(0.15); tt = np.arange(m) / SR
    place(out, bp(rose(m, 1033), 600, 1.2) * np.sin(np.pi * tt / 0.15) * 0.4, 0.15)     # combinaison qui froisse
    place(out, impact_lourd(0.6, 1034, (80, 38), 0.8, 90, 1.3, 0.3, 0.2, dec_sub=0.18), 0.3)   # la masse s'effondre
    place(out, chair(0.5, 1035, 1.0, 0.8), 0.45)                                        # pustules qui éclatent
    place(out, chair(0.4, 1036, 1.0, 0.5) * 0.7, 0.48)
    m = secs(0.6); tt = np.arange(m) / SR
    place(out, lp(rose(m, 1037), 1800 * np.exp(-tt / 0.1) + 300, 0.8) * np.exp(-tt / 0.12) * np.minimum(1, tt / 0.003) * 0.7, 0.45)
    place(out, gargouillis(0.9, 80, 1038, 200, 1200, [(0, 1.0), (0.9, 0.1)]) * 0.35, 0.45)
    place(out, friture(1.35, 500, 1039, 2500, 9000, [(0, 1.0), (0.6, 0.6), (1.35, 0)]) * 0.5, 0.45)   # grésillement acide
    m = secs(1.35)
    place(out, hp(rose(m, 1040), 3000) * env([(0, 0), (0.05, 0.5), (1.35, 0)], m) * 0.15, 0.45)       # vapeur
    t = 0.45
    while t < 1.6:                                                                      # le compteur s'éteint
        place(out, tic_geiger(int(r.integers(1 << 30)), 0.3), t)
        t += r.exponential(0.02 + 0.2 * (t - 0.45))
    return _fin(salle(out, 1.5, 0.18, 0.01, 84), L, 0.15)


@effet('flaque_toxique', cible=-22, mesure='I', boucle=True, cat='boucle', desc="Flaque toxique : l'acide grésille et ronge le sol (friture serrée, bulles qui éclatent, vapeur) (boucle 2,0 s)",
       notes="Au point de mort de l'Irradié pendant flaque.duree (5 s), entre boucleDebut et boucleFin ; arrêt avec un fondu de 0,5 s.")
def flaque_toxique():
    L = 2.0; n = secs(L); buf = np.zeros(n); r = np.random.default_rng(1071)
    place_circulaire(buf, friture(L + 0.01, 420, 1072, 2500, 9500), 0.0)
    place_circulaire(buf, friture(L + 0.01, 60, 1073, 1200, 4000) * 0.6, 0.0)
    t = 0.0
    while True:                                                                         # bulles qui éclatent
        t += r.exponential(1 / 6.0)
        if t >= L:
            break
        place_circulaire(buf, bulle(r.uniform(500, 1500), r.uniform(0.02, 0.05), r.uniform(0.4, 0.9), int(r.integers(1 << 30)), 0.4) * r.uniform(0.15, 0.4), t)
    for t0 in (0.37, 1.12, 1.66):                                                       # gros « blop »
        place_circulaire(buf, bulle(r.uniform(250, 400), 0.08, 0.7, int(r.integers(1 << 30)), 0.5) * 0.45, t0)
    vap = bruit_periodique(n, bande(3000, 10000, 2.0), 1074) * am_boucle(L, 3, 0.4) * 0.08
    return circulaire(lambda y: butter_hp(salle(y, 0.5, 0.05, 0.004, 79, sombre=False)[:len(y)], 32, 2), buf + vap)


def _pas_geant(seed, g=1.0):
    """Pas du Démembré géant (×2) : choc très grave, pierre qui crisse, gravillons."""
    r = np.random.default_rng(seed)
    x = impact_lourd(0.5, int(r.integers(1 << 30)), (62, 34), 0.6, 78, 0.9, 0.35, 0.0, 300, 2500, dec_sub=0.12)
    return (x + ajuste(debris(0.4, 8, int(r.integers(1 << 30)), 0.02, 0.2, 700, 3500, 1) * 0.3, len(x))) * g


def _geant(L, f0, voyelles, env_pts, graine, echelle=0.5, rauque=0.85, sous=0.6, souffle=1.0, gigue=0.04, roule=14.0, prof=0.35, oq=0.65):
    """Voix du Démembré géant (×2) : conduit vocal énorme (formants ×0,5), fondamentale très basse."""
    return voix(L, f0, voyelles, echelle=echelle, rauque=rauque, sous=sous, souffle=souffle, gigue=gigue, oq=oq, env=env_pts,
                graine=graine, roule=roule, roule_prof=prof)


# ════════════════════════════ v1.4 (API.md §16.8) ════════════════════════════
# Le Démembré (colosse, bras arraché pendu par les tendons, utilisé comme fléau), Irradié et Survolté renforcés,
# crochets et paliers de la phase 5 (illusions retirées en v1.5). Mono et positionnels sauf survolte_etourdi et les paliers (stéréo).

def _fin14(x, L, fin):
    """Coupe à L s (fondu de sortie) après un passe-haut 32 Hz et un passe-bas 16 kHz : le MP3 coupe ces aigus de toute
    façon, et sans ce filtre le limiteur d'export écrase les transitoires pour des crêtes qui disparaîtront au codage."""
    return coupe(butter_lp(butter_hp(x, 32, 2), 16000, 4), L, fin)


@effet('demembre_cri', cible=-13, desc="Le Démembré (géant ×2) — beuglement rauque énorme à la libération : poitrine de colosse, voix très grave qui se déchire, mâchoire béante qui bave",
       notes="À la libération (miniBoss « libere », type demembre), positionnel, ≈ 0,2 s après miniboss_apparition. v1.5 : voix du géant, plus grave.")
def demembre_cri():
    L = 1.6; n = secs(L); out = np.zeros(n)
    rug = rugissement(1.55, base=54, graine=1101, cri=0.25, grave=1.3, echelle=0.8,
                      contour=[(0, 0.8), (0.2, 1.05), (0.7, 1.12), (1.2, 0.95), (1.55, 0.68)],
                      voyelles=[(0, 'O'), (0.15, 'a'), (0.5, 'ae'), (1.0, 'a'), (1.55, 'o')])
    place(out, rug, 0.0)
    sub = voix(1.5, [(0, 27), (0.2, 29), (1.0, 30), (1.5, 24)], [(0, 'O'), (0.3, 'a'), (1.5, 'u')], echelle=0.5, rauque=0.9, sous=0.6,
               souffle=0.6, gigue=0.04, env=[(0, 0), (0.02, 0.9), (0.4, 1.0), (1.2, 0.7), (1.5, 0)], graine=1102, roule=12, roule_prof=0.4)
    place(out, sub * 0.55, 0.0)
    place(out, gargouillis(1.4, 25, 1103, 120, 500, [(0, 0.5), (1.4, 0.2)]) * 0.12, 0.05)
    return _fin14(salle(saturate(norm(out) * 1.8, 1.8), 2.0, 0.22, 0.015, 85), L, 0.15)


@effet('demembre_mort', cible=-13, pic=0.8, desc="Le Démembré (géant ×2) — mort : râle très grave qui s'étouffe, il tombe à genoux (0,45 s) puis s'effondre de tout son poids (0,8 s), le moignon et le flanc claquent au sol, pierre et poussière",
       notes="À la mort du Démembré (miniBoss « mort »), positionnel ; couper demembre_rale (fondu 0,2 s). v1.5 : géant, voix plus grave et chute plus lourde.")
def demembre_mort():
    L = 1.8; n = secs(L); out = np.zeros(n)
    rale = voix(0.55, [(0, 60), (0.2, 52), (0.55, 34)], [(0, 'a'), (0.3, 'O'), (0.55, 'u')], echelle=0.5, rauque=0.9, sous=0.6, souffle=1.3,
                gigue=0.05, env=[(0, 0), (0.008, 0.9), (0.3, 0.6), (0.5, 0.15), (0.55, 0)], graine=1111, roule=14, roule_prof=0.45)
    place(out, rale * 0.7, 0.0)
    place(out, saturate(impact_lourd(0.6, 1112, (70, 34), 0.6, 80, 1.0, 0.4, 0.1, dec_sub=0.14) * 1.5, 1.5) * 0.55, 0.45)    # genoux
    place(out, saturate(impact_lourd(1.0, 1113, (75, 28), 1.0, 68, 1.5, 0.7, 0.2, dec_sub=0.32) * 1.6, 1.6) * 0.85, 0.8)     # le corps
    place(out, chair(0.4, 1114, 0.9, 0.8) * 0.6, 0.93)
    place(out, os_cliquetis(0.4, 5, 1115, 500, 1400) * 0.4, 0.95)
    place(out, debris(0.9, 45, 1116, 0.02, 0.6, 500, 4000, 1) * 0.4, 0.82)
    m = secs(0.9)
    place(out, butter_hp(lp(rose(m, 1117), 900, 0.8), 60, 2) * env([(0, 0), (0.05, 0.6), (0.9, 0)], m) * 0.45, 0.82)   # poussière
    exh = voix(0.6, [(0, 30), (0.6, 25)], [(0, 'O'), (0.6, 'u')], echelle=0.5, rauque=0.6, souffle=2.5, oq=0.8,
               env=[(0, 0), (0.1, 0.4), (0.6, 0)], graine=1118)
    place(out, exh * 0.3, 1.15)
    return _fin14(salle(saturate(norm(out) * 1.3, 1.2), 2.0, 0.22, 0.015, 86), L, 0.15)


@effet('demembre_fleau', cible=-14, pic=0.7, desc="Le Démembré (géant) — fléau : l'énorme bras tournoie au bout de ses tendons qui grincent, souffles et sifflement qui accélèrent et montent ; sommet à 0,7 s, au coup",
       notes="audio.sonMiniBoss('demembre', 'fleau') à l'état 'preparation' ; le sommet tombe 0,7 s après (= fleau.preparation du géant), sur la frappe. demembre_impact à 'impact'. Pour les petits Démembrés (preparation 0,6 s) : vitesse 1,17.")
def demembre_fleau():
    L = 0.75; n = secs(L); t = np.arange(n) / SR; out = np.zeros(n)
    k = np.clip(t / 0.7, 0, 1)
    vit = 2.5 + 5.5 * k ** 1.5                                     # 2,5 → 8 tours/s (≈ 3,3 tours avant le coup)
    passe = (0.5 + 0.5 * np.cos(TAU * np.cumsum(vit) / SR)) ** 6
    fc = 220 + 2000 * k ** 1.4 + 500 * passe                       # le sifflement monte (bras énorme : plus grave)
    out += bp(rose(n, 1121), fc, 1.6) * (0.25 + 0.75 * passe) * (0.3 + 0.7 * k ** 1.2)
    out += np.sin(TAU * np.cumsum(380 + 1100 * k ** 1.5) / SR) * passe * k ** 2 * 0.15
    place(out, souffle(0.13, 2800, 450, 0.6, 1.2, 1122) * 1.3, 0.612)   # dernier passage : le coup (sommet à 0,69 s)
    for i, t0 in enumerate([0.0, 0.25, 0.42, 0.55, 0.64]):            # les tendons grincent à chaque traction
        place(out, grincement(0.14, 1123 + i, (0.01, 0.024), (320.0, 700.0, 1300.0), 8.0, [(0, 0), (0.01, 1.0), (0.14, 0)], 0.5) * 0.35, t0)
    place(out, chair(0.1, 1129, 0.8, 0.0) * 0.12, 0.0)
    return _fin14(salle(out, 1.0, 0.1, 0.006, 87), L, 0.03)


@effet('demembre_impact', cible=-12, pic=0.0, desc="Le Démembré — coup du bras-fléau : masse de chair qui s'écrase, os qui craquent, éclaboussure",
       notes="audio.sonMiniBoss('demembre', 'impact') au point d'impact.")
def demembre_impact():
    L = 0.6; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 1131, (100, 45), 0.4, 105, 1.2, 0.0, 0.3, dec_sub=0.14)
    place(out, chair(0.4, 1132, 1.0, 0.9) * 1.2, 0.0)
    place(out, chair(0.3, 1133, 0.8, 0.4) * 0.5, 0.012)
    place(out, pierre_fracture(0.06, [(0, 900), (0.06, 50)], 1134, 1200, 5000, 0.0, 0.0) * 0.9, 0.004)   # os qui craquent
    place(out, os_cliquetis(0.25, 3, 1135, 900, 2200) * 0.5, 0.008)
    m = secs(0.3); tt = np.arange(m) / SR
    place(out, bp(rose(m, 1136), 900 + 1200 * np.exp(-tt / 0.03), 2.0) * np.exp(-tt / 0.07) * 0.4, 0.01)
    return _fin14(salle(saturate(norm(out) * 2.2, 1.8), 1.0, 0.12, 0.006, 88), L, 0.05)


@effet('demembre_rale', cible=-22, mesure='I', boucle=True, cat='boucle', desc="Le Démembré (géant ×2) — souffle très grave, lourd et humide, tendons qui grincent, pas boiteux de colosse (un écrasant, un traîné) (boucle 3,0 s)",
       notes="Boucle sur le Démembré vivant, entre boucleDebut et boucleFin. Les pas sont dans la boucle (foulée boiteuse de 1,5 s) : baisser le volume quand il est immobile (fléau, rage, préparation de charge). v1.5 : voix et pas du géant.")
def demembre_rale():
    L = 3.0; n = secs(L); buf = np.zeros(n); dec = 0.75
    expi = voix(1.5, [(0, 40), (0.4, 44), (1.5, 35)], [(0, 'O'), (0.7, 'a'), (1.5, 'O')], echelle=0.52, rauque=0.8, sous=0.5, souffle=2.0,
                oq=0.72, gigue=0.04, env=[(0, 0), (0.12, 0.85), (0.5, 1.0), (1.25, 0.6), (1.5, 0)], graine=1141, roule=16, roule_prof=0.45)
    inspi = voix(1.1, [(0, 31), (0.5, 35), (1.1, 32)], [(0, 'u'), (0.5, 'O'), (1.1, 'u')], echelle=0.54, rauque=0.85, sous=0.3, souffle=3.0,
                 oq=0.8, gigue=0.04, env=[(0, 0), (0.15, 0.5), (0.7, 0.7), (1.0, 0.35), (1.1, 0)], graine=1142, roule=22, roule_prof=0.4)
    place_circulaire(buf, expi, 0.0 - dec)
    place_circulaire(buf, inspi * 0.7, 1.65 - dec)
    place_circulaire(buf, gargouillis(L + 0.05, 22, 1143, 120, 500, None) * 0.2, 0.0)
    pas = np.zeros(n)
    for t0, tr, gg, s in [(0.0, False, 1.0, 1144), (0.62, True, 0.7, 1145), (1.5, False, 0.95, 1146), (2.12, True, 0.65, 1147)]:
        place_circulaire(pas, pas_lourd(s, gg * 1.2, True) if tr else _pas_geant(s, gg * 0.9), t0 - dec)
    for i, t0 in enumerate([0.3, 0.95, 1.8, 2.45]):                   # le bras se balance : les tendons grincent
        place_circulaire(pas, grincement(0.3, 1150 + i, (0.012, 0.032), (300.0, 650.0, 1200.0), 9.0,
                                         [(0, 0), (0.05, 1.0), (0.2, 0.7), (0.3, 0)], 0.4) * 0.25, t0 - dec)
    x = circulaire(lambda y: saturate(y / (np.max(np.abs(y)) + 1e-9) * 1.5, 1.3), buf) + pas * 0.5
    return circulaire(lambda y: butter_hp(salle(y, 1.2, 0.12, 0.01, 89)[:len(y)], 32, 2), x)


@effet('irradie_boule', cible=-15, pic=0.12, desc="L'Irradié — lancer d'une boule radioactive : effort grondant et mouillé, puis gerbe liquide qui se décolle et part en sifflant (0,12 s)",
       notes="audio.sonMiniBoss('irradie', 'boule') à l'état 'lancer', une fois par boule ; varier la vitesse (0,92–1,08) dans une volée.")
def irradie_boule():
    L = 0.6; n = secs(L); out = np.zeros(n)
    eff = voix(0.3, [(0, 95), (0.08, 120), (0.3, 80)], [(0, 'u'), (0.1, 'a'), (0.3, 'O')], echelle=0.66, rauque=0.8, sous=0.5, souffle=1.2,
               gigue=0.04, env=[(0, 0), (0.008, 0.8), (0.12, 1.0), (0.3, 0)], graine=1161, roule=20, roule_prof=0.35)
    place(out, eff * 0.6, 0.0)
    place(out, gargouillis(0.25, 50, 1162, 150, 700) * 0.2, 0.0)
    m = secs(0.15); tt = np.arange(m) / SR
    place(out, lp(rose(m, 1163), 2500 * np.exp(-tt / 0.04) + 500, 0.8) * np.exp(-tt / 0.05) * np.minimum(1, tt / 0.002) * 0.9, 0.12)
    place(out, bulle(220, 0.06, 0.8, 1164, 0.5) * 0.5, 0.13)
    place(out, bulle(330, 0.05, 0.9, 1165, 0.5) * 0.35, 0.16)
    place(out, mono(passage(0.45, 1166, 3200, 600, 0.2, 0.0)) * 0.6, 0.13)
    place(out, friture(0.4, 150, 1167, 3000, 9000, [(0, 1.0), (0.4, 0)]) * 0.2, 0.14)
    return _fin14(salle(saturate(norm(out) * 1.8, 1.6), 1.0, 0.12, 0.006, 90), L, 0.05)


@effet('irradie_boule_impact', cible=-15, pic=0.0, desc="Boule radioactive qui s'écrase : éclaboussure épaisse, grésillement acide, rafale de compteur Geiger qui retombe",
       notes="audio.sonMiniBoss('irradie', 'boule') à l'état 'impact', au point d'impact ; la zone qui naît prend zone_radioactive.")
def irradie_boule_impact():
    L = 1.0; n = secs(L); out = np.zeros(n); r = np.random.default_rng(1171)
    place(out, impact_lourd(0.4, 1172, (100, 50), 0.35, 130, 0.6, 0.0, 0.2, dec_sub=0.1) * 0.6, 0.0)
    m = secs(0.5); tt = np.arange(m) / SR
    sp = lp(rose(m, 1173), 2600 * np.exp(-tt / 0.06) + 350, 0.8) * np.exp(-tt / 0.1) * np.minimum(1, tt / 0.002)
    place(out, sp * (1 + 0.7 * np.tanh(2 * smooth_noise(m, 30, 1174))), 0.0)
    place(out, gargouillis(0.6, 90, 1175, 250, 1400, [(0, 1.0), (0.6, 0.1)]) * 0.3, 0.01)
    for _ in range(8):
        place(out, goutte(r.uniform(500, 1200), 0.15, int(r.integers(1 << 30))) * r.uniform(0.1, 0.3), r.uniform(0.05, 0.5))
    place(out, friture(0.95, 600, 1176, 2500, 9500, [(0, 0.6), (0.1, 1.0), (0.95, 0)]) * 0.45, 0.02)
    t = 0.0
    while t < 0.9:                                                         # rafale de Geiger qui retombe
        place(out, tic_geiger(int(r.integers(1 << 30)), r.uniform(0.5, 0.8) * (1 - t)), t)
        t += r.exponential(0.008 + 0.05 * t)
    return _fin14(salle(saturate(norm(out) * 1.8, 1.6), 1.1, 0.14, 0.008, 91), L, 0.1)


@effet('zone_radioactive', cible=-26, mesure='I', boucle=True, cat='boucle', desc="Zone radioactive au sol : compteur Geiger serré et bourdon radioactif grave mais léger (boucle 2,0 s) ; spectre allégé, sans réverbération, pour que plusieurs zones se superposent",
       notes="Une boucle par zone (sonMiniBoss 'irradie', 'zone', 'debut'/'fin', id), entre boucleDebut et boucleFin. Démarrer chaque zone à un point aléatoire de la boucle et à une vitesse un peu différente (0,94–1,06), sinon les zones s'additionnent en phase ; extinction en 1,5 s à la mort de l'Irradié.")
def zone_radioactive():
    L = 2.0; n = secs(L); r = np.random.default_rng(1181); buf = np.zeros(n)
    tt = np.arange(n) / SR
    taux = 70 * (1 + 0.3 * np.sin(TAU * 2 * tt / L + 0.7) + 0.2 * np.sin(TAU * 5 * tt / L + 2.1))
    t = 0.0
    while True:
        t += r.exponential(1.0 / taux[min(n - 1, secs(t))])
        if t >= L:
            break
        place_circulaire(buf, tic_geiger(int(r.integers(1 << 30)), r.uniform(0.55, 0.9), 0.004, 2600.0, 0.6, 2.5), t)
    hum = sum(a * (sinus_boucle(L, 110.0 * k, 0.4 * k) + sinus_boucle(L, 110.0 * k + 0.5, 1.1 * k)) for k, a in [(1, 1.0), (2, 0.45), (3, 0.25), (5, 0.1)])
    hum = hum * am_boucle(L, 2, 0.3) * 0.04
    souf = bruit_periodique(n, bande(300, 2000, 2.0), 1182) * 0.008
    return circulaire(lambda y: butter_hp(y, 80, 2), buf + hum + souf)


@effet('survolte_etourdi', stereo=True, cible=-14, pic=0.0, desc="Joueur étourdi par Le Survolté (stéréo, non positionnel) : choc électrique, puis acouphène qui retombe et monde étouffé",
       notes="audio.sonMiniBoss('survolte', 'etourdi', cible) : seulement chez le joueur étourdi (local), non positionnel ; dure l'étourdissement (1 s).")
def survolte_etourdi():
    L = 1.0; n = secs(L); t = np.arange(n) / SR
    choc = np.zeros(n)
    place(choc, _rafale(5, 1191, 1.0), 0.0)
    place(choc, arc_electrique(0.18, 1192, 100.0, 3000, [(0, 0), (0.003, 1.0), (0.18, 0)]) * 0.8, 0.0)
    place(choc, impact_lourd(0.35, 1193, (90, 50), 0.4, 130, 0.6, 0.0, 0.3, dec_sub=0.1) * 0.6, 0.0)
    e = env([(0, 0), (0.06, 0.0), (0.12, 1.0), (0.5, 0.55), (1.0, 0)], n)          # acouphène qui retombe
    fL = 4100 - 500 * (t / L) ** 1.2
    acL = np.sin(TAU * np.cumsum(fL) / SR) * e
    acR = np.sin(TAU * np.cumsum(fL * 1.0015) / SR) * e
    sourd = butter_hp(lp(rose(n, 1194), 300, 0.7), 40, 2) * env([(0, 0), (0.1, 0.8), (1.0, 0)], n) * 0.4
    choc = saturate(norm(choc) * 1.8, 1.6)
    out = np.stack([choc + acL * 0.09 + sourd, choc + acR * 0.09 + sourd])
    return _fin14(salle(out, 0.8, 0.1, 0.006, 92), L, 0.08)


@effet('crochet_lancer', cible=-15, desc="Crochet lancé : la chaîne file en cliquetant, fouette (claquement à 0,09 s), le crochet siffle en s'éloignant",
       notes="crochet « lancer » : un son par crochet, à la main du boss.")
def crochet_lancer():
    L = 0.7; n = secs(L); out = np.zeros(n)
    m = secs(0.09); tt = np.arange(m) / SR
    place(out, bp(rose(m, 1201), 900 + 4000 * (tt / 0.09) ** 2, 1.4) * (tt / 0.09) ** 2 * 0.8, 0.0)    # fouet
    place(out, _rafale(3, 1202, 0.8), 0.085)
    place(out, chaine(0.66, [(0, 220), (0.3, 160), (0.66, 30)], 1203, 1800, 4500, 0.022, [(0, 0.6), (0.1, 1.0), (0.66, 0.3)]) * 0.55, 0.0)
    place(out, maillon(1204, 1900, 1.0, 0.05) * 0.6, 0.09)
    m = secs(0.6)
    sif = bp(rose(m, 1205), 2600 * (900 / 2600) ** (np.arange(m) / m), 6.0) * env([(0, 0), (0.05, 1.0), (0.6, 0)], m)
    place(out, sif * 0.5, 0.08)
    return _fin14(salle(out, 0.9, 0.1, 0.006, 93), L, 0.06)


@effet('crochet_accroche', cible=-14, pic=0.0, desc="Crochet qui accroche : choc métal et chair, les maillons se rattrapent, la chaîne se tend d'un coup (0,22 s) et vibre",
       notes="crochet « accroche », à la position du joueur accroché ; crochet_traction suit.")
def crochet_accroche():
    L = 0.6; n = secs(L); out = np.zeros(n)
    place(out, modes(0.5, 1250, [1.0, 2.41, 3.93, 5.6], [1.0, 0.6, 0.4, 0.2], [0.18, 0.1, 0.06, 0.04], 1211, 1.0, 5000, 0.002) * 0.7, 0.0)
    place(out, chair(0.35, 1212, 1.0, 0.7) * 0.8, 0.003)
    place(out, impact_lourd(0.3, 1213, (110, 55), 0.3, 140, 0.6, 0.0, 0.4, dec_sub=0.08) * 0.5, 0.0)
    place(out, chaine(0.12, [(0, 400), (0.12, 400)], 1214, 2000, 4500, 0.02) * 0.4, 0.1)
    m = secs(0.35); tt = np.arange(m) / SR
    place(out, maillon(1215, 1500, 1.0, 0.06) * 0.8, 0.22)
    vib = sum(np.sin(TAU * f * tt) / (i + 1) for i, f in enumerate([180, 362, 547])) * np.exp(-tt / 0.12) * (1 + 0.5 * np.sin(TAU * 31 * tt))
    place(out, vib * 0.25, 0.22)
    return _fin14(salle(out, 0.9, 0.1, 0.006, 94), L, 0.05)


@effet('crochet_traction', cible=-16, desc="Traction : la chaîne s'enroule vite (maillons réguliers ≈ 55/s, frottement du métal, grincement de l'enroulement)",
       notes="Après crochet « accroche », sur le joueur tiré ; couper à crochet « arrivee » (fondu 0,1 s). La traction dure distance / 14 m/s (au plus ≈ 1,5 s).")
def crochet_traction():
    L = 1.5; n = secs(L); out = np.zeros(n); r = np.random.default_rng(1221)
    t = 0.0
    while t < L - 0.05:
        place(out, maillon(int(r.integers(1 << 30)), 2400 * r.uniform(0.85, 1.15), r.uniform(0.5, 1.0), 0.02), t)
        t += (1 / 55.0) * r.uniform(0.8, 1.2)
    out += bp(rose(n, 1222), 1400 + 400 * smooth_noise(n, 4, 1223), 0.9) * (1 + 0.5 * np.tanh(2 * smooth_noise(n, 20, 1224))) * 0.35
    out += grincement(L, 1225, (0.006, 0.012), (520.0, 1100.0, 2100.0), 7.0, None, 0.0) * 0.15
    out *= env([(0, 0), (0.02, 1.0), (1.35, 1.0), (1.5, 0)], n)
    return _fin14(salle(out, 0.8, 0.1, 0.006, 95), L, 0.05)


@effet('crochet_rate', cible=-15, pic=0.0, desc="Crochet raté : le crochet tombe et sonne sur la pierre, rebondit, la chaîne retombe en cascade et cliquette",
       notes="crochet « rate » (esquive ou mur), à la position de la pointe.")
def crochet_rate():
    L = 0.8; n = secs(L); out = np.zeros(n)
    place(out, modes(0.5, 1250, [1.0, 2.41, 3.93, 5.6], [1.0, 0.6, 0.4, 0.2], [0.15, 0.09, 0.05, 0.03], 1231, 1.0, 5000, 0.002) * 0.7, 0.0)
    place(out, modes(0.4, 1180, [1.0, 2.41, 3.93], [1.0, 0.5, 0.3], [0.1, 0.06, 0.04], 1232, 0.8, 5000, 0.002) * 0.4, 0.09)
    place(out, chaine(0.75, [(0, 60), (0.1, 260), (0.35, 120), (0.75, 10)], 1233, 1500, 4000, 0.03, [(0, 1.0), (0.75, 0.2)]) * 0.6, 0.02)
    place(out, debris(0.4, 8, 1234, 0.02, 0.2, 1000, 4000, 1) * 0.2, 0.05)
    return _fin14(salle(out, 0.9, 0.12, 0.006, 96), L, 0.06)


# v1.5 : illusion_apparition retiré (illusions remplacées par l'intangibilité, API.md §17.3)

@effet('palier_lames_rouges', stereo=True, cible=-13, pic=0.0, desc="Palier 1 de la phase 5 (stéréo, non positionnel) : les lames s'embrasent — anneau métallique, embrasement, grondement, accord de cuivres en ré mineur",
       notes="Évènement palier {numero: 1} (lames rouges), non positionnel ; bus effets ou musique.")
def palier_lames_rouges():
    from lib.musique import Morceau
    M = Morceau(1.7, boucle=False, queue=0.5)
    mt, fx, br, pe = M.bus('metal', 0.35), M.bus('fx', 0.25), M.bus('cuivres', 0.3), M.bus('perc', 0.2)
    for i, (f, p) in enumerate([(1650.0, -0.4), (1980.0, 0.4), (2470.0, 0.0)]):
        mt.add(metal_lame(2.0, f, 1271 + i, 0.9), 0.012 * i, 1.0 - 0.2 * i, p)
    m = secs(0.12); tt = np.arange(m) / SR
    mt.add(bp(rose(m, 1274), 3000 + 5000 * tt / 0.12, 2.0) * np.sin(np.pi * tt / 0.12) * 0.8, 0.0, 1.0, 0.0)
    fx.add(stereo_large(flamme(1.4, 1275, pic=0.12), 1276, 0.8), 0.02, 1.0)
    fx.add(stereo_large(butter_hp(grondement(1.8, 1277, 110, 0.9, [(0, 0.6), (0.3, 1.0), (1.8, 0)]), 35, 2), 1278, 0.6), 0.0, 1.0)
    pe.add(I.taiko(50, 0.9, 1.8, 1279), 0.0, 1.0, 0.0)
    pe.add(I.boom(36, 2.0, 0.7), 0.0, 0.8, 0.0)
    for i, m_ in enumerate([38, 45, 50, 53, 57]):
        br.add(I.brass(m_, 1.9, 0.8, 4, 0.08, 0.6, 0.3, 1280 + i), 0.05, 0.9 if i < 2 else 0.7, (-0.3, 0.3, -0.15, 0.15, 0)[i])
    ir = make_ir(2.4, 0.02, seed=1286)
    out, _ = M.rendu(ir, {'metal': -19, 'fx': -21, 'cuivres': -18, 'perc': -17}, {'cuivres': lambda x: butter_hp(x, 38, 2)}, -14.0, fin_fondu=0.5)
    return _fin14(out, 2.2, 0.05)


@effet('palier_crochets', stereo=True, cible=-13, pic=0.0, desc="Palier 3 de la phase 5 (stéréo, non positionnel) : chaînes qui claquent de part et d'autre, coup grave, braam de cuivres graves",
       notes="Évènement palier {numero: 3} (crochets), non positionnel.")
def palier_crochets():
    from lib.musique import Morceau
    M = Morceau(1.4, boucle=False, queue=0.4)
    ch, pe, br = M.bus('chaines', 0.3), M.bus('perc', 0.2), M.bus('cuivres', 0.3)
    pe.add(I.boom(34, 2.0, 1.0), 0.0, 1.2, 0.0)
    pe.add(I.taiko(48, 1.0, 1.8, 1311), 0.0, 1.1, 0.0)
    pe.add(I.anvil(640, 0.6, 1.6, 1312), 0.0, 0.5, 0.2)
    for i, (t0, p) in enumerate([(0.0, -0.6), (0.06, 0.6), (0.3, -0.3), (0.42, 0.4)]):
        ch.add(chaine(0.6, [(0, 500), (0.08, 200), (0.6, 10)], 1313 + i, 1600, 4200, 0.03, [(0, 1.0), (0.6, 0.2)]), t0, 1.0 - 0.15 * i, p)
        ch.add(maillon(1320 + i, 1500 + 200 * i, 1.0, 0.07), t0, 0.8, p)
    br.add(I.braam([26, 38, 45], 1.6, 0.9, 1325), 0.0, 1.0, 0.0)
    ir = make_ir(2.2, 0.02, seed=1326)
    out, _ = M.rendu(ir, {'chaines': -19, 'perc': -16, 'cuivres': -19}, {'cuivres': lambda x: butter_hp(x, 38, 2)}, -14.0, fin_fondu=0.4)
    return _fin14(out, 1.8, 0.05)


# ════════════════════════════ v1.5 (API.md §17.5) ════════════════════════════
# Rages des mini-boss (surcharge et murs électrifiés, infection, arrachement du bras et petits Démembrés, charge du géant),
# intangibilité de la phase 5. Mono et positionnels sauf les sons marqués stéréo (non positionnels).

@effet('survolte_surcharge', cible=-14, desc="Le Survolté — surcharge (rage) : il puise dans le Septième ; aspiration d'énergie qui monte, rayon qui vibre, bourdon et arcs qui s'emballent jusqu'à 2,5 s",
       notes="miniBoss « rage » (capacite surcharge), positionnel sur le Survolté ; finit au sommet à 2,5 s (= rage.duree), quand murs « electrifies » lance murs_electrification. Baisser survolte_bourdon de 6 dB pendant.")
def survolte_surcharge():
    L = 2.5; n = secs(L); t = np.arange(n) / SR; k = t / L; out = np.zeros(n)
    place(out, _rafale(4, 1401, 0.7), 0.0)                                                   # il lève les bras : premier arc
    place(out, arc_electrique(0.15, 1402, 100.0, 3000, [(0, 0), (0.003, 1.0), (0.15, 0)]) * 0.5, 0.0)
    out += aspiration(L, 1403, 160, 5000, fin_net=True) * 0.55                               # l'énergie est aspirée
    f = 220 * (880 / 220) ** k                                                               # rayon : grappe qui monte et vibre
    ray = sum(np.sin(TAU * np.cumsum(f * m_) / SR + p) / (i + 1) for i, (m_, p) in enumerate([(1.0, 0.0), (1.5, 1.1), (2.01, 2.3), (2.99, 0.7)]))
    ray *= (0.6 + 0.4 * np.sin(TAU * np.cumsum(6 + 20 * k) / SR)) * k ** 1.2
    out += ray * 0.18
    pul = (0.5 + 0.5 * np.sin(TAU * np.cumsum(8 + 110 * k ** 1.6) / SR)) ** 3                # bourdon haché qui s'emballe
    out += bp(saturate(saw(np.full(n, 100.0), 0.0), 3.0), 700 + 2500 * k, 0.8) * pul * (0.25 + 0.75 * k) * 0.5
    hum = sum(np.sin(TAU * 50.0 * h * t) / h for h in (2, 3, 4, 6)) * (0.3 + 0.7 * k)
    out += saturate(hum * 0.5, 2.0) * 0.25
    out += crepitement(L, 140, 1404, 1800, 9500, [(0, 0.1), (1.2, 0.4), (2.2, 1.0), (2.5, 1.0)]) * 0.35
    r = np.random.default_rng(1405); t0 = 0.3
    while t0 < L - 0.1:                                                                      # arcs de plus en plus serrés
        d = r.uniform(0.04, 0.1)
        place(out, arc_electrique(d, int(r.integers(1 << 30)), 100.0, r.uniform(2500, 4500), [(0, 0), (0.003, 1.0), (d, 0)])
              * r.uniform(0.25, 0.5) * (0.4 + 0.6 * t0 / L), t0)
        t0 += r.uniform(0.6, 1.2) * (0.5 - 0.38 * t0 / L)
    return _fin14(salle(saturate(norm(out) * 1.4, 1.3), 1.0, 0.12, 0.008, 100, sombre=False), L, 0.02)


@effet('murs_electrification', stereo=True, cible=-12, pic=0.0, desc="Murs électrifiés (stéréo, non positionnel) : déflagration quand les 8 murs s'allument — disjoncteur qui claque, arcs qui font le tour de la salle, ronflement qui monte puis s'installe",
       notes="murs « electrifies » (fin de la surcharge), non positionnel ; les murs_boucle (une par mur) démarrent dessous avec un fondu de 0,5 s.")
def murs_electrification():
    L = 2.0; n = secs(L); out = np.zeros((2, n)); t = np.arange(n) / SR
    place(out, stereo_large(impact_lourd(0.8, 1411, (90, 38), 0.6, 110, 1.0, 0.0, 0.6, dec_sub=0.15), 1412, 0.4) * 0.9, 0.0)   # disjoncteur
    place(out, stereo_large(maillon(1413, 900, 1.0, 0.05), 1414, 0.3) * 0.5, 0.0)
    place(out, stereo_large(_rafale(8, 1415, 1.2), 1416, 0.9), 0.0)
    r = np.random.default_rng(1417)
    for i in range(8):                                                                       # les arcs font le tour des 8 murs
        d = r.uniform(0.12, 0.25)
        arc = arc_electrique(d, int(r.integers(1 << 30)), 100.0, r.uniform(2400, 4200), [(0, 0), (0.003, 1.0), (d, 0)]) * r.uniform(0.4, 0.7)
        place(out, pan(arc, np.sin(TAU * i / 8) * 0.9), 0.03 + i * 0.045)
    hum = sum(a_ * np.sin(TAU * 50.0 * h * t + 0.3 * h) for h, a_ in [(2, 1.0), (3, 0.7), (4, 0.5), (6, 0.35), (8, 0.2)])
    hum = saturate(hum * 0.5, 2.2) * env([(0, 0), (0.05, 1.0), (0.4, 0.55), (2.0, 0.0)], n)
    out += stereo_large(hum, 1418, 0.5) * 0.35
    e = [(0, 1.0), (0.6, 0.5), (2.0, 0.1)]
    out += np.stack([crepitement(L, 160, 1419, 1800, 9500, e), crepitement(L, 160, 1420, 1800, 9500, e)]) * 0.35
    return _fin14(salle(saturate(out, 1.3), 1.6, 0.2, 0.012, 101, sombre=False), L, 0.15)


@effet('murs_boucle', cible=-28, mesure='I', boucle=True, cat='boucle', desc="Mur électrifié : grésillement continu le long d'un mur (bourdonnement haché sans grave, effluves, claquements secs) ; spectre léger (boucle 2,0 s, une par mur)",
       notes="Une boucle par mur (8), au centre de chaque mur, entre boucleDebut et boucleFin ; départ à un point aléatoire et vitesse 0,94–1,06 pour chaque mur (sinon elles s'additionnent en phase) ; fondu d'entrée 0,5 s à « electrifies », de sortie 1 s (murs.extinction) à « extinction ».")
def murs_boucle():
    L = 2.0; n = secs(L); t = np.arange(n) / SR; buf = np.zeros(n)
    bz = sum(a_ * np.sin(TAU * 100.0 * h * t + 0.5 * h) for h, a_ in [(1, 0.3), (2, 1.0), (3, 0.8), (4, 0.6), (6, 0.4), (8, 0.3), (12, 0.2), (16, 0.12)])
    bz = circulaire(lambda y: saturate(bp(y, 1500, 0.7) * 0.25, 1.5), bz) * (0.6 + 0.4 * am_boucle(L, 3, 0.8, 0.3))   # « zzz » haché
    cour = bruit_periodique(n, bande(3000, 9000, 2.0), 1421) * (0.5 + 0.5 * np.sin(TAU * 100.0 * t)) ** 4 * am_boucle(L, 2, 0.5, 1.0)
    place_circulaire(buf, crepitement(L + 0.05, 25, 1422, 2000, 9000), 0.0)
    r = np.random.default_rng(1423)
    for t0 in (0.27, 0.93, 1.58):                                                            # claquements secs
        place_circulaire(buf, arc_electrique(0.03, int(r.integers(1 << 30)), 100.0, 3500, [(0, 0), (0.002, 1.0), (0.03, 0)]) * 0.5, t0)
    return circulaire(lambda y: butter_hp(y, 150, 2), bz + cour * 0.3 + buf * 0.6)


@effet('murs_arc', cible=-15, pic=0.0, desc="Éclair aléatoire sur un mur électrifié : claquement sec, arc qui crache et siffle, grésillement qui retombe",
       notes="Au hasard sur un mur électrifié (par exemple toutes les 1 à 3 s, mur et hauteur au hasard), positionnel ; vitesse 0,9–1,1.")
def murs_arc():
    L = 0.6; n = secs(L); out = np.zeros(n)
    place(out, _rafale(5, 1431, 1.0), 0.0)
    place(out, arc_electrique(0.25, 1432, 100.0, 3800, [(0, 0), (0.002, 1.0), (0.08, 0.7), (0.25, 0)], siffle=[(0, 3600), (0.25, 2200)]) * 0.8, 0.0)
    place(out, crepitement(0.5, 120, 1433, 2000, 9500, [(0, 1.0), (0.5, 0)]) * 0.35, 0.03)
    place(out, impact_lourd(0.2, 1434, (100, 60), 0.2, 160, 0.4, 0.0, 0.5, dec_sub=0.05) * 0.4, 0.0)
    return _fin14(salle(saturate(out, 1.3), 0.9, 0.12, 0.006, 102, sombre=False), L, 0.05)


@effet('murs_choc', cible=-14, pic=0.0, desc="Joueur électrocuté par un mur : décharge qui claque, bourdon saccadé dans le corps (« bzzt-bzzt »), coup sourd",
       notes="mursChoc (au plus une fois par joueur et par 0,5 s) : 0,45 s, il ne se chevauche pas avec lui-même ; sur le joueur (centré pour le joueur local) ; vitesse 0,95–1,05.")
def murs_choc():
    L = 0.45; n = secs(L); out = np.zeros(n)
    place(out, _rafale(4, 1441, 0.9), 0.0)
    bz = arc_electrique(0.35, 1442, 100.0, 2600, [(0, 0), (0.003, 1.0), (0.3, 0.6), (0.35, 0)])
    sac = np.convolve((np.sin(TAU * 14 * np.arange(len(bz)) / SR) > -0.2).astype(float), np.ones(96) / 96, mode='same')   # saccades ≈ 14 Hz
    place(out, bz * sac * 0.8, 0.0)
    place(out, coup_sourd(0.25, 85, 0.05, 1443, 0.6) * 0.6, 0.0)
    return _fin14(salle(saturate(norm(out) * 1.5, 1.4), 0.6, 0.08, 0.004, 103, sombre=False), L, 0.04)


@effet('murs_extinction', stereo=True, cible=-15, desc="Murs qui s'éteignent (stéréo, non positionnel) : le ronflement s'effondre en glissant vers le grave, derniers arcs qui crachotent, relais qui retombe (1,0 s)",
       notes="murs « extinction » (mort du Survolté), non positionnel ; couper les murs_boucle par un fondu de 1 s (murs.extinction) au même instant.")
def murs_extinction():
    L = 1.3; n = secs(L); t = np.arange(n) / SR
    f = 100 * (25 / 100) ** (np.clip(t / 1.0, 0, 1) ** 0.8)
    hum = sum(np.sin(TAU * np.cumsum(f * h) / SR) / h for h in (1, 2, 3, 4, 6))
    hum = saturate(hum * 0.6, 2.0) * env([(0, 0), (0.02, 1.0), (0.5, 0.6), (1.0, 0.1), (1.2, 0)], n)
    out = stereo_large(butter_hp(hum, 30, 2), 1451, 0.6) * 0.6
    e = [(0, 1.0), (0.5, 0.4), (1.0, 0.0)]
    out += np.stack([crepitement(L, 90, 1452, 2000, 9000, e), crepitement(L, 90, 1453, 2000, 9000, e)]) * 0.35
    r = np.random.default_rng(1454)
    for t0 in (0.15, 0.38, 0.62):                                                            # derniers arcs
        place(out, pan(arc_electrique(0.06, int(r.integers(1 << 30)), 100.0, 3000, [(0, 0), (0.002, 1.0), (0.06, 0)]) * 0.4, r.uniform(-0.8, 0.8)), t0)
    rel = S(impact_lourd(0.3, 1455, (80, 45), 0.3, 120, 0.6, 0.0, 0.3, dec_sub=0.08), maillon(1456, 800, 0.6, 0.04))
    place(out, stereo_large(rel, 1457, 0.3) * 0.5, 1.0)                                     # le relais retombe
    return _fin14(salle(out, 1.4, 0.18, 0.01, 104, sombre=False), L, 0.1)


@effet('irradie_infection', stereo=True, cible=-13, pic=0.0, desc="L'Irradié contamine les zombies (stéréo, non positionnel) : onde de contamination qui s'élargit, compteur Geiger qui s'emballe et explose, souffle malade et mouillé, bourdon radioactif",
       notes="infection « debut » (fin du cri de rage, 1,2 s après miniBoss « rage »), non positionnel ; zombie_irradie démarre ensuite sur chaque zombie irradié (fondu 0,5 s).")
def irradie_infection():
    L = 1.8; n = secs(L); t = np.arange(n) / SR; out = np.zeros((2, n))
    place(out, stereo_large(impact_lourd(0.8, 1461, (80, 40), 0.6, 100, 0.6, 0.0, 0.2, dec_sub=0.25), 1462, 0.5) * 0.8, 0.0)
    m1 = ajuste(souffle(1.4, 2800, 160, 0.1, 0.8, 1463), n); m2 = ajuste(souffle(1.4, 2800, 160, 0.1, 0.8, 1464), n)
    larg = env([(0, 0.1), (0.6, 0.9), (1.4, 1.0)], n)                                       # l'onde s'élargit
    out += np.stack([m1 + m2 * larg, m1 - m2 * larg]) * 0.6
    r = np.random.default_rng(1465); tt = 0.0
    while tt < 1.5:                                                                          # le compteur s'emballe puis explose
        place(out, pan(tic_geiger(int(r.integers(1 << 30)), r.uniform(0.5, 0.9)), r.uniform(-0.9, 0.9)), tt)
        tt += r.exponential(1.0 / (30 + 600 * np.exp(-((tt - 0.35) / 0.25) ** 2) + 80 * (1 - tt / 1.5)))
    mal = voix(1.2, [(0, 70), (0.3, 64), (1.2, 50)], [(0, 'a'), (0.5, 'O'), (1.2, 'u')], echelle=0.68, rauque=0.85, sous=0.4, souffle=2.6, oq=0.78,
               gigue=0.05, env=[(0, 0), (0.1, 0.9), (0.6, 0.7), (1.2, 0)], graine=1466, roule=22, roule_prof=0.4)
    place(out, pan(mal * 0.45 + gargouillis(1.2, 40, 1467, 150, 700) * 0.12, 0.0), 0.15)  # souffle malade
    hum = sum(a_ * np.sin(TAU * 55.0 * h * t + h) for h, a_ in [(1, 1.0), (2, 0.6), (3, 0.35), (5, 0.15)]) * env([(0, 0), (0.1, 1.0), (1.8, 0)], n)
    out += stereo_large(hum, 1468, 0.3) * 0.12
    return _fin14(salle(out, 1.8, 0.2, 0.012, 105), L, 0.15)


@effet('zombie_irradie', cible=-30, mesure='I', boucle=True, cat='boucle', desc="Zombie ou chien irradié : grésillement discret (quelques tics de Geiger, friture légère, rien sous 200 Hz) (boucle 1,5 s, une par entité irradiée)",
       notes="Une boucle courte par zombie ou chien irradié (infection.ids), entre boucleDebut et boucleFin ; départ aléatoire dans la boucle et vitesse 0,9–1,1 ; ref 1,5, portée ≈ 10 m pour rester discrète ; fondu de sortie 0,3 s à infection « fin » ou à la mort de l'entité.")
def zombie_irradie():
    L = 1.5; n = secs(L); buf = np.zeros(n); r = np.random.default_rng(1471)
    t = 0.0
    while True:
        t += r.exponential(1 / 9.0)
        if t >= L:
            break
        place_circulaire(buf, tic_geiger(int(r.integers(1 << 30)), r.uniform(0.5, 0.9), 0.004, 2800.0, 0.5, 2.5), t)
    place_circulaire(buf, friture(L + 0.01, 120, 1472, 3000, 9000) * 0.5, 0.0)
    return circulaire(lambda y: butter_hp(y, 200, 2), buf)


@effet('demembre_arrachement', cible=-12, pic=1.2, desc="Le Démembré s'arrache le bras (rage) : chair qui se déchire de plus en plus fort, tendons qui claquent, l'os cède à 1,2 s, hurlement du géant",
       notes="miniBoss « rage » (capacite arrachement), positionnel ; l'os cède à 1,2 s = rage.duree − rage.vol, au moment de bras « arrache »/« lance » (bras_lancer part alors).")
def demembre_arrachement():
    L = 1.8; n = secs(L); out = np.zeros(n); r = np.random.default_rng(1481)
    t = 0.0
    while t < 1.15:                                                                          # la chair se déchire, de plus en plus fort
        p = t / 1.15
        place(out, chair(0.12, int(r.integers(1 << 30)), 1.0, 0.2) * (0.25 + 0.6 * p) * r.uniform(0.7, 1.0), t)
        d = r.uniform(0.04, 0.09)
        place(out, grincement(d, int(r.integers(1 << 30)), (0.002, 0.006), (500.0, 1100.0, 2300.0), 3.0, [(0, 0), (0.005, 1.0), (d, 0)], 1.0) * (0.3 + 0.5 * p), t)
        t += r.uniform(0.06, 0.14) * (1.2 - 0.7 * p)
    for t0 in (0.55, 0.85, 1.05):                                                            # tendons qui claquent
        place(out, grincement(0.05, int(r.integers(1 << 30)), (0.001, 0.003), (420.0, 900.0), 4.0, [(0, 0), (0.002, 1.0), (0.05, 0)], 0.3) * 0.7, t0)
    place(out, pierre_fracture(0.08, [(0, 1600), (0.08, 80)], 1482, 800, 5000, 0.5, 0.0) * 1.1, 1.2)   # l'os cède
    place(out, impact_lourd(0.5, 1483, (90, 45), 0.4, 110, 1.0, 0.6, 0.4, dec_sub=0.1) * 0.8, 1.2)
    place(out, chair(0.4, 1484, 1.0, 0.8) * 0.9, 1.2)
    hur = rugissement(1.55, base=58, graine=1485, cri=0.35, grave=1.2, echelle=0.8,
                      contour=[(0, 0.75), (0.8, 1.0), (0.95, 1.25), (1.3, 1.15), (1.55, 0.7)],
                      env=[(0, 0), (0.3, 0.3), (0.85, 0.6), (0.95, 1.0), (1.4, 0.6), (1.55, 0)])
    place(out, hur * 0.7, 0.25)                                                              # hurlement (explose quand l'os cède)
    return _fin14(salle(saturate(norm(out) * 1.6, 1.6), 1.8, 0.2, 0.012, 106), L, 0.12)


@effet('bras_lancer', cible=-15, desc="Le bras du géant lancé : lourd sifflement d'une masse qui tournoie (souffles de rotation), air déplacé qui s'éloigne",
       notes="bras « lance » (1,2 s de vol jusqu'au centre), positionnel, idéalement attaché au bras en vol (sinon au départ) ; bras_impact à « pose ».")
def bras_lancer():
    L = 1.2; n = secs(L); t = np.arange(n) / SR; k = t / L
    passe = (0.5 + 0.5 * np.cos(TAU * np.cumsum(3.0 + 1.0 * k) / SR)) ** 4                 # il tournoie (3-4 tours/s)
    fc = 900 * (350 / 900) ** k + 500 * passe                                               # s'éloigne : de plus en plus sombre
    out = bp(rose(n, 1491), fc, 1.3) * (0.35 + 0.65 * passe) * env([(0, 0), (0.05, 1.0), (0.6, 0.8), (1.1, 0.35), (1.2, 0)], n)
    out += butter_hp(lp(rose(n, 1492), 220, 0.8), 40, 2) * env([(0, 0), (0.06, 1.0), (1.2, 0.2)], n) * 0.8
    out += np.sin(TAU * np.cumsum(700 * (500 / 700) ** k) / SR) * passe * 0.06             # sifflement des tendons
    place(out, chair(0.15, 1493, 0.8, 0.3) * 0.3, 0.0)                                      # le bras quitte la main
    return _fin14(salle(out, 1.2, 0.15, 0.01, 107), L, 0.08)


@effet('bras_impact', cible=-12, pic=0.0, desc="Le bras s'écrase au centre de la salle : chute de viande énorme, os qui cognent, gerbe de sang, chair qui rebondit et suinte",
       notes="bras « pose », au centre de la salle ; bras_pulsation (boucle) démarre ensuite au même point.")
def bras_impact():
    L = 1.2; n = secs(L); out = np.zeros(n); r = np.random.default_rng(1501)
    place(out, impact_lourd(L, 1502, (80, 34), 0.7, 85, 1.3, 0.3, 0.2, dec_sub=0.2), 0.0)
    place(out, chair(0.6, 1503, 1.0, 1.0) * 1.2, 0.0)
    place(out, chair(0.4, 1504, 1.0, 0.6) * 0.7, 0.03)
    place(out, os_cliquetis(0.4, 4, 1505, 500, 1400) * 0.5, 0.01)
    m = secs(0.6); tt = np.arange(m) / SR
    place(out, lp(rose(m, 1506), 2500 * np.exp(-tt / 0.07) + 400, 0.8) * np.exp(-tt / 0.15) * np.minimum(1, tt / 0.003) * 0.6, 0.0)   # gerbe de sang
    for _ in range(10):
        place(out, goutte(r.uniform(400, 1000), 0.15, int(r.integers(1 << 30))) * r.uniform(0.1, 0.3), r.uniform(0.1, 0.9))
    place(out, chair(0.3, 1507, 0.8, 0.3) * 0.35, 0.28)                                     # rebond mou
    place(out, gargouillis(0.8, 25, 1508, 150, 600, [(0, 1.0), (0.8, 0.2)]) * 0.15, 0.2)   # suinte
    return _fin14(salle(saturate(norm(out) * 1.6, 1.5), 1.6, 0.2, 0.012, 108), L, 0.12)


@effet('bras_pulsation', cible=-24, mesure='I', boucle=True, cat='boucle', desc="Bras posé au centre : palpitation humide (deux battements mous par boucle), tendons qui frémissent, suintement (boucle 2,0 s)",
       notes="Au centre de la salle, de bras « pose » à « fletri » (fondu 0,3 s, puis bras_fletri), entre boucleDebut et boucleFin.")
def bras_pulsation():
    L = 2.0; n = secs(L); buf = np.zeros(n)
    for t0, g, s in [(0.1, 1.0, 1511), (1.1, 0.85, 1512)]:                                  # « toum-toum » mou
        for dt, gg, f in [(0.0, 1.0, 58), (0.17, 0.7, 50)]:
            place_circulaire(buf, lp(coup_sourd(0.3, f, 0.06, s + int(dt * 100), 0.1), 180) * gg * g, t0 + dt)
            place_circulaire(buf, chair(0.15, s + 7 + int(dt * 100), 0.9, 0.0) * 0.25 * gg * g, t0 + dt + 0.005)
    place_circulaire(buf, gargouillis(L + 0.05, 12, 1513, 150, 600) * 0.12, 0.0)           # suintement
    for t0, s in [(0.55, 1514), (1.6, 1515)]:                                                # tendons qui frémissent
        place_circulaire(buf, grincement(0.18, s, (0.006, 0.015), (380.0, 800.0, 1500.0), 8.0, [(0, 0), (0.03, 1.0), (0.18, 0)], 0.5) * 0.15, t0)
    return circulaire(lambda y: butter_hp(salle(y, 0.9, 0.1, 0.006, 109)[:len(y)], 32, 2), buf)


@effet('petit_sortie', cible=-15, desc="Un petit Démembré s'extrait du sol près du bras : la terre et la chair se fendent, il s'arrache, grognement",
       notes="petitDemembre « apparition », à sa position ; un toutes les 2,5 s : varier la vitesse (0,9–1,1).")
def petit_sortie():
    L = 1.2; n = secs(L); out = np.zeros(n); r = np.random.default_rng(1521)
    place(out, chair(0.15, 1528, 0.8, 0.5) * 0.4, 0.0)
    place(out, pierre_fracture(0.7, [(0, 30), (0.3, 160), (0.6, 60), (0.7, 10)], 1522, 350, 2800, 0.45, 0.8) * 0.7, 0.0)
    m = secs(1.0)
    terre = lp(rose(m, 1523), 1200, 0.7) * env([(0, 0), (0.15, 0.6), (0.5, 1.0), (1.0, 0)], m) * (1 + 0.8 * np.tanh(2 * smooth_noise(m, 25, 1524)))
    place(out, butter_hp(terre, 50, 2) * 0.45, 0.0)
    for t0 in (0.1, 0.32, 0.5):                                                              # la chair se décolle
        place(out, chair(0.2, int(r.integers(1 << 30)), 1.0, 0.3) * 0.45, t0)
    place(out, debris(0.8, 25, 1525, 0.1, 0.6, 400, 2000, 1) * 0.4, 0.15)
    gro = voix(0.6, [(0, 95), (0.2, 125), (0.6, 80)], [(0, 'O'), (0.25, 'a'), (0.6, 'u')], echelle=0.78, rauque=0.75, sous=0.5, souffle=0.9,
               gigue=0.04, env=[(0, 0), (0.06, 0.9), (0.35, 0.7), (0.6, 0)], graine=1526, roule=22, roule_prof=0.4)
    place(out, gro * 0.55, 0.5)
    return _fin14(salle(saturate(norm(out) * 1.5, 1.4), 1.4, 0.16, 0.01, 110), L, 0.1)


@effet('petit_effondrement', cible=-16, pic=0.15, desc="Un petit Démembré s'effondre (mort du géant) : râle bref, la carcasse s'affaisse (0,15 s), la chair s'étale, os",
       notes="petitDemembre « effondrement » : souvent plusieurs à la fois → décaler chacun de 0 à 0,4 s au hasard et varier la vitesse (0,9–1,1).")
def petit_effondrement():
    L = 1.0; n = secs(L); out = np.zeros(n)
    place(out, voix(0.3, [(0, 110), (0.3, 70)], [(0, 'a'), (0.3, 'u')], echelle=0.78, rauque=0.8, sous=0.5, souffle=1.3,
                    env=[(0, 0), (0.008, 0.8), (0.3, 0)], graine=1531, roule=20, roule_prof=0.4) * 0.5, 0.0)
    place(out, impact_lourd(0.5, 1532, (85, 45), 0.4, 100, 0.9, 0.2, 0.1, dec_sub=0.1) * 0.8, 0.15)
    place(out, chair(0.4, 1533, 1.0, 0.6) * 0.7, 0.16)
    place(out, os_cliquetis(0.35, 4, 1534, 600, 1600) * 0.35, 0.18)
    place(out, gargouillis(0.6, 20, 1535, 150, 600, [(0, 1.0), (0.6, 0)]) * 0.12, 0.2)
    return _fin14(salle(saturate(norm(out) * 1.4, 1.3), 1.2, 0.14, 0.008, 111), L, 0.1)


@effet('demembre_charge', cible=-13, pic=0.8, desc="Le Démembré (géant) charge : il gratte le sol en grondant (0 → 0,8 s), puis rugit et fonce, pas de colosse qui accélèrent",
       notes="Au début de la préparation de la charge (signalée par le jeu) ; la course part à 0,8 s (= charge.preparation). Positionnel, attaché au Démembré ; couper (fondu 0,15 s) s'il heurte un mur ou s'arrête avant 2 s.")
def demembre_charge():
    L = 2.0; n = secs(L); out = np.zeros(n)
    for t0, s in [(0.0, 1541), (0.38, 1542)]:                                                # il gratte le sol (deux raclements)
        m = secs(0.32); tt = np.arange(m) / SR
        rac = bp(rose(m, s), 500 + 400 * tt / 0.32, 1.0) * env([(0, 0), (0.03, 1.0), (0.25, 0.6), (0.32, 0)], m) * (1 + 0.8 * np.tanh(2 * smooth_noise(m, 30, s + 1)))
        place(out, rac * 0.5 + ajuste(debris(0.32, 10, s + 2, 0.02, 0.2, 600, 3000, 0), m) * 0.35, t0)
        place(out, _pas_geant(s + 3, 0.5), t0)
    place(out, _geant(0.85, [(0, 30), (0.85, 36)], [(0, 'u'), (0.85, 'O')], [(0, 0), (0.1, 0.6), (0.8, 1.0), (0.85, 0.8)], 1545, souffle=1.2) * 0.45, 0.0)
    rug = rugissement(1.2, base=56, graine=1546, cri=0.3, grave=1.3, echelle=0.8, env=[(0, 0), (0.05, 1.0), (0.6, 0.85), (1.0, 0.4), (1.2, 0)])
    place(out, rug * 0.75, 0.8)                                                              # rugissement
    t, k = 0.8, 0
    while t < L - 0.05:                                                                      # pas de colosse qui accélèrent
        place(out, _pas_geant(1550 + k, 0.8 + 0.2 * min(1, k / 4)), t)
        t += max(0.16, 0.36 - 0.05 * k); k += 1
    return _fin14(salle(saturate(norm(out) * 1.5, 1.4), 1.6, 0.16, 0.01, 112), L, 0.1)


@effet('demembre_percussion', cible=-12, pic=0.0, desc="Joueur percuté par la charge du géant : choc massif de corps, souffle coupé, il est projeté (air qui file)",
       notes="Au joueur touché par la charge, positionnel (centré pour le joueur local) ; projection_mur s'il heurte ensuite un mur.")
def demembre_percussion():
    L = 0.6; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 1561, (95, 42), 0.6, 95, 1.4, 0.0, 0.4, dec_sub=0.12)
    place(out, chair(0.3, 1562, 0.6, 1.0) * 0.8, 0.0)
    place(out, coup_sourd(0.2, 180, 0.03, 1563, 0.8) * 0.5, 0.0)
    place(out, mono(passage(0.45, 1564, 2500, 500, 0.25, 0.0)) * 0.5, 0.06)                # projeté
    return _fin14(salle(saturate(norm(out) * 1.8, 1.6), 0.9, 0.1, 0.006, 113), L, 0.05)


@effet('projection_mur', cible=-12, pic=0.0, desc="Joueur projeté qui s'écrase contre un mur : choc lourd sur la pierre, os qui craquent, pierre qui s'effrite",
       notes="Quand un joueur projeté heurte un mur (impactMur), à sa position.")
def projection_mur():
    L = 0.7; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 1571, (100, 45), 0.5, 120, 1.2, 1.0, 0.5, 400, 4500, dec_sub=0.12)
    place(out, chair(0.25, 1572, 0.5, 0.8) * 0.6, 0.0)
    place(out, pierre_fracture(0.06, [(0, 1000), (0.06, 50)], 1573, 1200, 5000, 0.0, 0.0) * 0.5, 0.006)
    place(out, debris(0.6, 25, 1574, 0.03, 0.4, 600, 4000, 1) * 0.45, 0.02)
    return _fin14(salle(saturate(norm(out) * 1.6, 1.5), 1.0, 0.14, 0.008, 114), L, 0.06)


@effet('bras_fletri', cible=-16, desc="Le bras se flétrit (mort du géant) : la chair se vide en sifflant, se dessèche et craquelle, dernier sursaut des tendons",
       notes="bras « fletri », au centre ; couper bras_pulsation (fondu 0,3 s) juste avant.")
def bras_fletri():
    L = 1.5; n = secs(L); out = np.zeros(n)
    place(out, S(bulle(170, 0.06, 0.5, 1586, 0.6), chair(0.12, 1587, 1.0, 0.0) * 0.5) * 0.45, 0.0)   # la chair cède d'un coup (attaque nette)
    m = secs(1.2); tt = np.arange(m) / SR
    place(out, bp(rose(m, 1581), 2200 * (700 / 2200) ** (tt / 1.2), 1.4) * env([(0, 0), (0.05, 1.0), (0.6, 0.6), (1.2, 0)], m) * 0.5, 0.0)
    place(out, gargouillis(1.0, 50, 1582, 200, 900, [(0, 1.0), (1.0, 0.1)]) * 0.25, 0.0)
    place(out, pierre_fracture(1.3, [(0, 20), (0.4, 200), (1.3, 30)], 1583, 1500, 6500, 0.0, 0.0) * 0.4, 0.1)   # se dessèche, craquelle
    place(out, grincement(0.25, 1584, (0.005, 0.012), (380.0, 800.0, 1500.0), 7.0, [(0, 0), (0.02, 1.0), (0.25, 0)], 0.5) * 0.35, 0.7)
    place(out, chair(0.25, 1585, 0.8, 0.5) * 0.4, 0.72)                                     # dernier sursaut
    return _fin14(salle(out, 1.4, 0.16, 0.01, 115), L, 0.12)


@effet('intangible_debut', cible=-15, desc="Le Septième s'efface (évanouissement) : son souffle se retire, fumée sombre aspirée qui s'effondre sur elle-même, braises qui s'éteignent, silence à 0,8 s",
       notes="Action evanouissement (0,7 s), positionnel au boss ; couper boss_souffle (fondu 0,6 s) et lancer intangible_boucle à la fin (fondu d'entrée 0,5 s).")
def intangible_debut():
    L = 1.0; n = secs(L); out = np.zeros(n)
    sf = voix(0.75, [(0, 48), (0.75, 40)], [(0, 'O'), (0.75, 'u')], echelle=0.66, rauque=0.6, souffle=2.5, oq=0.78, gigue=0.03,
              env=[(0, 0), (0.05, 1.0), (0.5, 0.5), (0.75, 0)], graine=1591, roule=18, roule_prof=0.3)
    place(out, flanger(sf, 0.001, 0.008, 1.5, 0.7) * 0.5, 0.0)                              # le souffle se retire
    place(out, aspiration(0.8, 1592, 2500, 150, fin_net=True) * 0.6, 0.0)                   # la fumée s'effondre sur elle-même
    place(out, crepitement(0.7, 60, 1593, 1500, 7000, [(0, 1.0), (0.7, 0)]) * 0.2, 0.0)     # braises
    place(out, impact_lourd(0.2, 1594, (80, 50), 0.4, 140, 0.4, 0.0, 0.0, dec_sub=0.08) * 0.35, 0.78)
    return _fin14(salle(out, 1.8, 0.3, 0.02, 116), L, 0.1)


@effet('intangible_boucle', cible=-24, mesure='I', boucle=True, cat='boucle', desc="Le Septième intangible (invisible) : souffle lent et profond, murmures graves, bourdon sourd ; spectre presque entièrement sous 1,5 kHz (rien au-dessus de 3 kHz) pour s'entendre de près sans trahir la direction de loin (boucle 3,0 s)",
       notes="Pendant boss.intangible, sur la position du boss, entre boucleDebut et boucleFin ; portée courte (ref 1,5, portée ≈ 8 m) pour ne rien révéler de loin ; fondus 0,5 s. Seul indice de sa venue avec traversee_mur.")
def intangible_boucle():
    L = 3.0; n = secs(L); buf = np.zeros(n); dec = 0.6
    expi = voix(1.5, [(0, 42), (0.5, 46), (1.5, 38)], [(0, 'O'), (0.8, 'o'), (1.5, 'u')], echelle=0.62, rauque=0.5, sous=0.3, souffle=2.4, oq=0.78,
                gigue=0.03, env=[(0, 0), (0.25, 0.9), (0.8, 1.0), (1.5, 0)], graine=1601, roule=14, roule_prof=0.25)
    inspi = voix(1.2, [(0, 36), (1.2, 40)], [(0, 'u'), (1.2, 'O')], echelle=0.64, rauque=0.4, souffle=3.0, oq=0.82,
                 gigue=0.03, env=[(0, 0), (0.4, 0.6), (1.0, 0.7), (1.2, 0)], graine=1602)
    place_circulaire(buf, expi, 0.0 - dec)
    place_circulaire(buf, inspi * 0.7, 1.7 - dec)
    place_circulaire(buf, murmures(L + 0.3, 3, 4.0, 0.7, 1603, sifflantes=0.0) * 0.35, 0.0)
    drone = sum(a_ * sinus_boucle(L, f_, ph) for f_, a_, ph in [(36.67, 1.0, 0.0), (55.0, 0.6, 1.0), (73.33, 0.35, 2.0), (110.0, 0.15, 0.5)])
    buf += drone * am_boucle(L, 1, 0.4) * 0.12
    x = circulaire(lambda y: butter_lp(y, 1200, 4), buf)                                    # rien au-dessus de 1,2 kHz
    x = flanger(x, 0.002, 0.009, 1.0, 0.5, boucle=True)
    return circulaire(lambda y: butter_hp(salle(y, 1.6, 0.25, 0.02, 117)[:len(y)], 32, 2), x)


@effet('traversee_mur', cible=-15, desc="Le Septième intangible traverse un mur : la pierre ondoie en grondant (grain grave qui roule), poussière qui ruisselle, souffle d'ectoplasme sombre",
       notes="intangible « traversee », à la position donnée (dans le mur), positionnel ; ref 4, portée ≈ 25 m : c'est l'indice qu'il approche.")
def traversee_mur():
    L = 0.9; n = secs(L); t = np.arange(n) / SR; out = np.zeros(n)
    on = env([(0, 0.3), (0.06, 1.0), (0.5, 0.8), (0.9, 0)], n)
    out += butter_hp(lp(brun(n, 1611), 180, 0.9), 35, 4) * (1 + 0.8 * np.sin(TAU * 7 * t)) * on * 2.0   # la pierre ondoie
    place(out, pierre_fracture(0.8, [(0, 40), (0.3, 120), (0.8, 20)], 1612, 300, 2200, 0.3, 0.0) * 0.5, 0.0)
    pous = bp(rose(n, 1613), 3800, 1.0) * env([(0, 0), (0.15, 0.8), (0.9, 0)], n) * (1 + 0.8 * np.tanh(2 * smooth_noise(n, 40, 1614)))
    out += pous * 0.12                                                                       # poussière qui ruisselle
    place(out, flanger(souffle(0.7, 300, 1200, 0.5, 1.0, 1615), 0.001, 0.008, 2.0, 0.8) * 0.5, 0.05)   # ectoplasme
    return _fin14(salle(out, 1.6, 0.25, 0.015, 119), L, 0.08)


@effet('resurgissement', cible=-11, pic=0.0, desc="Le Septième resurgit : déflagration de fumée sombre, puis rugissement (il frappe aussitôt)",
       notes="Action resurgissement (0,5 s), positionnel au boss ; le coup suit 0,35 s après (preparationFrappe). Couper intangible_boucle (fondu 0,2 s) et relancer boss_souffle (fondu 0,5 s).")
def resurgissement():
    L = 1.4; n = secs(L); out = np.zeros(n)
    out += impact_lourd(L, 1621, (110, 36), 0.7, 110, 1.1, 0.0, 0.8, dec_sub=0.3)
    place(out, souffle(0.8, 3200, 250, 0.05, 0.9, 1622), 0.0)                              # la fumée explose
    place(out, crepitement(0.6, 80, 1623, 1500, 8000, [(0, 1.0), (0.6, 0)]) * 0.25, 0.0)
    place(out, rugissement(1.25, base=84, graine=1624, cri=0.45) * 0.85, 0.12)               # rugissement (voix du Septième)
    return _fin14(salle(saturate(norm(out) * 1.6, 1.5), 1.8, 0.22, 0.012, 118), L, 0.12)


@effet('palier_intangible', stereo=True, cible=-13, pic=0.0, desc="Palier 2 de la phase 5 (stéréo, non positionnel) : il devient intangible — coup grave, accord sombre de cuivres et de chœur (ré, mi♭, la♭), pierre qui gronde, souffle qui s'efface",
       notes="Évènement palier {numero: 2} (remplace palier_illusions), non positionnel.")
def palier_intangible():
    from lib.musique import Morceau
    M = Morceau(1.8, boucle=False, queue=0.4)
    pe, br, ch, fx = M.bus('perc', 0.2), M.bus('cuivres', 0.3), M.bus('choeur', 0.5), M.bus('fx', 0.35)
    pe.add(I.boom(34, 2.0, 1.0), 0.0, 1.2, 0.0)
    pe.add(I.taiko(48, 0.9, 1.8, 1631), 0.0, 1.0, 0.0)
    for i, m_ in enumerate([26, 38, 39, 44]):                                                 # ré, mi♭ (seconde mineure), la♭ (triton)
        br.add(I.brass(m_, 1.9, 0.8, 4, 0.06, 0.6, 0.4, 1632 + i), 0.0, (1.0, 0.9, 0.7, 0.6)[i], (-0.3, 0.3, -0.15, 0.15)[i])
    for i, (m_, p) in enumerate([(50, -0.5), (51, 0.5), (56, 0.0)]):
        ch.add(I.choir(m_, 1.9, 'u', 0.6, 8, 0.1, 0.8, 'o', 1640 + i), 0.0, 1.0, p)
    fx.add(stereo_large(butter_hp(grondement(1.8, 1645, 140, 1.0, [(0, 0.5), (0.3, 1.0), (1.8, 0)]), 35, 2), 1646, 0.7), 0.0, 0.8)
    sf = souffle(1.6, 2400, 200, 0.08, 1.0, 1647)
    fx.add(np.stack([flanger(sf, 0.001, 0.007, 1.5, 0.7), flanger(sf, 0.002, 0.009, 1.2, 0.7) * 0.9]), 0.05, 0.6)
    ir = make_ir(2.8, 0.025, seed=1648)
    out, _ = M.rendu(ir, {'perc': -16, 'cuivres': -18, 'choeur': -22, 'fx': -23},
                     {'cuivres': lambda x: butter_hp(x, 38, 2), 'choeur': lambda x: butter_hp(x, 140, 2)}, -14.0, fin_fondu=0.5)
    return _fin14(out, 2.2, 0.05)


if __name__ == '__main__':
    cles = sys.argv[1:] or list(REG.keys())
    for c in cles:
        if c not in REG:
            print('clé inconnue', c); continue
        R = REG[c]
        t0 = time.time()
        x = R['fn']()
        m = exporter(c, x, stereo=R['stereo'], boucle=R['boucle'], description=R['desc'], pic=R['pic'], cible=R['cible'],
                     mesure=R['mesure'], categorie=R['cat'], notes=R['notes'])
        print(f"{c:22s} {m['duree']:6.2f} s  {m['lufs']:6.1f} LUFS({m['mesure'][:5]})  crête {m['crete']:6.2f} dB  ({time.time() - t0:.1f} s)")
