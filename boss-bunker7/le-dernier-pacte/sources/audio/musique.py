"""Musiques du boss de Bunker 7 (compositions originales, tout synthétisé).
Usage : python3 musique.py            (toutes)
        python3 musique.py cle1 cle2  (seulement celles-là)
Ré mineur, palette des jingles de Bunker 7 (chœur, cloches, tambours de guerre, cuivres, braams) ; leitmotif :
le motif de boîte à musique de l'arrivée (Ré–Fa–Mi–La–Do♯), déformé en phase 5 et résolu en ré majeur à la fin."""
import sys, os, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.dsp import SR, secs, mtof, saw, lp, bp, hp, butter_hp, butter_lp, peak_eq, shelf, env_adsr, env_perc, \
    smooth_noise, noise, saturate, make_ir, pan
from lib import instr as I
from lib.voix import voix, murmures, courbe
from lib.sfx import (rose, brun, coup_sourd, chute_grave, impact_lourd, scintillement, metal_frotte, battement_coeur,
                     souffle, aspiration, grondement, crepitement, fondu, ajuste, place, modes)
from lib.musique import Morceau, active_rms_db
from lib.sortie import exporter

REG = {}
MOTIF = [74, 77, 76, 69, 73]          # Ré–Fa–Mi–La–Do♯ (boîte à musique de l'arrivée)


def cue(cle, *, boucle=True, cible=-18.0, pic=None, desc='', notes=None, extra=None):
    def deco(fn):
        REG[cle] = dict(fn=fn, boucle=boucle, cible=cible, pic=pic, desc=desc, notes=notes, extra=extra)
        return fn
    return deco


def grille(bpm):
    B = 60.0 / bpm
    return B, (lambda mesure, temps=1.0: ((mesure - 1) * 4 + (temps - 1)) * B)


def cordes_glisse(m0, m1, L, vel=0.6, voices=6, seed=1, attaque=0.6, courbe_g=1.0):
    """Cordes tenues avec glissando (grappes dissonantes de la phase 5, chutes de la défaite)."""
    rng = np.random.default_rng(seed)
    n = secs(L); t = np.arange(n) / SR
    k = (t / L) ** courbe_g
    f = mtof(m0) * (mtof(m1) / mtof(m0)) ** k
    out = np.zeros(n)
    for v in range(voices):
        det = 1 + rng.uniform(-0.006, 0.006)
        vib = 1 + 0.003 * np.sin(2 * np.pi * rng.uniform(4.5, 5.8) * t + rng.uniform(0, 6.28))
        out += saw(np.ascontiguousarray(f * det * vib), rng.uniform())
    out /= voices
    out = lp(out, 2600, 0.8)
    out = peak_eq(out, 300, 3, 0.9)
    bow = bp(noise(n, rng.integers(1 << 30)), 4800, 0.6) * 0.05
    e = env_adsr(n, attaque, 1.0, 0.9, min(0.8, L * 0.3))
    return butter_hp((out + bow) * e * vel, 45)


def tambour_doux(f0, vel, L=1.2, seed=1):
    """Tambour sourd (cœur, marche lente)."""
    return lp(I.taiko(f0, vel, L, seed), 900) * 0.9


def murmures_st(L, seed, env_pts):
    return murmures(L, 5, 6, 1.0, seed, stereo=True, env=env_pts)


# ═══════════════════════════════ INTRO ═══════════════════════════════

@cue('mus_intro', boucle=False, cible=-15.0, pic=6.0, desc="Présentation du boss (le coup à 6,0 s lance la phase 1)")
def mus_intro():
    M = Morceau(6.0, boucle=False, queue=3.2)
    dr, st, ch, br, pe, fx, bo = (M.bus('drone', 0.3), M.bus('cordes', 0.3), M.bus('choeur', 0.45), M.bus('cuivres', 0.3),
                                  M.bus('perc', 0.2), M.bus('fx', 0.35), M.bus('boite', 0.7))
    # 0 → 2,6 : la forme se condense
    dr.add(I.drone(26, 6.3, 0.6, 801), 0, 1.0, -0.1)
    dr.add(I.drone(38, 6.3, 0.4, 802), 0, 1.0, 0.1)
    for i, m in enumerate([62, 63, 69]):
        st.add(I.strings(m, 2.8, 'sustain', 0.35, 6, 2.2, 803 + i), 0, 1.0, (-0.5, 0.5, 0)[i])
    fx.add(murmures_st(2.6, 806, [(0, 0), (2.4, 1.0), (2.6, 0.3)]), 0, 0.5)
    fx.add(I.reverse_cymbal(1.2), 2.6 - 1.2, 0.6, 0.0)
    # 2,6 : il est là
    pe.add(I.boom(36, 3.0, 0.9), 2.6, 1.1, 0.0)
    pe.add(I.taiko(73.4, 1.0, 1.8, 807), 2.6, 1.0, 0.0)
    br.add(I.braam([26, 38, 45, 50, 53], 2.5, 0.85, 808), 2.6, 1.0, 0.0)
    for i, m in enumerate([50, 57, 62, 65]):
        ch.add(I.choir(m, 3.3, 'a', 0.6, 10, 0.05, 1.0, 'o', 809 + i), 2.6, 1.0, (-0.4, 0.4, -0.2, 0.2)[i])
    # 2,6 → 6,0 : cuivres graves (leitmotif en valeurs longues) et tambours qui pressent
    for k, (t0, m) in enumerate([(3.4, 50), (4.1, 53), (4.6, 52), (5.1, 49)]):
        br.add(I.brass(m - 12, 0.75, 0.8, 4, 0.06, 0.3, 0.4, 815 + k), t0, 0.9, -0.2)
        br.add(I.brass(m, 0.75, 0.7, 4, 0.06, 0.3, 0.2, 820 + k), t0, 0.6, 0.2)
    for k in range(10):
        t0 = 3.3 + k * 0.27 * (1 - 0.04 * k)
        if t0 < 5.85:
            pe.add(I.taiko(73.4 if k % 2 == 0 else 55.0, 0.55 + 0.04 * k, 1.2, 825 + k), t0, 0.9, 0.2 if k % 2 else -0.2)
    fx.add(I.snare_roll(0.9, 0.2, 0.9, 18, 836), 5.05, 0.8, 0.0)
    fx.add(I.riser(2.2, 300, 8000, 0.6, 837), 3.75, 1.0, 0.0)
    M.respiration(5.82, 0.05, 0.0, ['cordes', 'choeur', 'cuivres', 'perc', 'drone'])
    fx.add(I.reverse_cymbal(0.9), 6.0 - 0.9, 0.7, 0.0)
    # 6,0 : impact qui lance le combat
    pe.add(I.boom(34, 3.2, 1.0), 6.0, 1.4, 0.0)
    pe.add(I.taiko(50, 1.0, 2.0, 838), 6.0, 1.3, 0.0)
    pe.add(I.anvil(760, 0.9, 2.4, 839), 6.0, 1.0, 0.0)
    pe.add(I.crash(1.0, 3.2, 840), 6.0, 0.9, 0.2)
    br.add(I.braam([26, 38, 45, 50, 53], 3.0, 1.0, 841), 6.0, 1.4, 0.0)
    for i, m in enumerate([50, 57, 62, 65]):
        ch.add(I.choir(m, 2.9, 'a', 0.85, 10, 0.03, 1.2, 'o', 842 + i), 6.0, 1.2, (-0.4, 0.4, -0.2, 0.2)[i])
    bo.add(I.musicbox(86, 0.4, 3.0, 0.015, 846), 7.6, 1.0, 0.3)
    ir = make_ir(3.2, 0.025, seed=21)
    cib = {'drone': -28, 'cordes': -24, 'choeur': -23, 'cuivres': -19, 'perc': -16, 'fx': -24, 'boite': -26}
    fxs = {'choeur': lambda x: peak_eq(butter_hp(x, 140, 2), 340, -3, 0.9), 'cuivres': lambda x: butter_hp(x, 38, 2),
           'boite': lambda x: butter_hp(x, 300, 2), 'drone': lambda x: butter_lp(x, 1400, 2)}
    return M.rendu(ir, cib, fxs, -15.0, fin_fondu=1.2)


# ═══════════════════════════════ PHASE 1 ═══════════════════════════════

ACC1 = ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'Eb', 'A', 'Dm', 'Dm', 'Bb', 'A']
RAC = {'Dm': 38, 'Bb': 34, 'A': 33, 'Gm': 31, 'Eb': 39, 'C': 36, 'F': 41, 'Eb2': 39}
VOIX_ACC = {'Dm': [50, 53, 57, 62], 'Bb': [50, 53, 58, 62], 'A': [49, 52, 57, 61], 'Gm': [50, 55, 58, 62],
            'Eb': [51, 55, 58, 63], 'C': [48, 52, 55, 60], 'F': [48, 53, 57, 60]}


def ostinato(r, mineur=True):
    t = 3 if mineur else 4
    return [r, r, r + 12, r, r + t, r, r + 2 if mineur else r + 2, r]


@cue('mus_phase1', cible=-18.0, desc="Phase 1 — L'Invocation des morts (boucle, 100 bpm, ré mineur, 12 mesures)")
def mus_phase1():
    B, tb = grille(100)
    M = Morceau(12 * 4 * B)
    st, pad, ch, br, pe, bl, bo, dr = (M.bus('cordes', 0.25), M.bus('nappe', 0.35), M.bus('choeur', 0.45), M.bus('cuivres', 0.3),
                                       M.bus('perc', 0.18), M.bus('cloches', 0.5), M.bus('boite', 0.75), M.bus('drone', 0.25))
    s = 1000
    for b, acc in enumerate(ACC1, start=1):
        r = RAC[acc]; maj = acc in ('Bb', 'A', 'Eb', 'C', 'F')
        for i, m in enumerate(ostinato(r, not maj)):
            a = 1.0 if i in (0, 4) else 0.72
            st.add(I.strings(m, 0.55, 'spiccato', 0.78 * a, 6, None, s), tb(b, 1 + i * 0.5), 1.0, -0.45); s += 1
            st.add(I.strings(m + 12, 0.55, 'spiccato', 0.5 * a, 5, None, s), tb(b, 1 + i * 0.5), 0.55, 0.45); s += 1
        for k, m in enumerate(VOIX_ACC[acc]):
            pad.add(I.strings(m, 4 * B + 0.25, 'sustain', 0.32, 6, 0.6, s), tb(b), 0.7, (-0.5, 0.5, -0.2, 0.2)[k]); s += 1
        # tambours de guerre
        for tp, v, f in [(1, 0.95, 73.4), (2.5, 0.6, 55.0), (3, 0.8, 73.4)] + ([(4.5, 0.55, 55.0)] if b % 2 == 0 else []):
            pe.add(I.taiko(f, v, 1.5, s), tb(b, tp), 1.0, 0.1 if tp % 1 else -0.1); s += 1
        if b >= 9:
            for tp in (2, 4):
                pe.add(I.anvil(980, 0.45, 1.6, s), tb(b, tp), 0.8, 0.4); s += 1
            for tp in (1.5, 3.5):
                pe.add(I.tom(110, 0.5, s), tb(b, tp), 0.7, 0.35); s += 1
        dr.add(I.drone(26 if acc != 'A' else 33 - 12 + 12, 4 * B + 0.5, 0.5, s), tb(b), 0.8, 0.0); s += 1
    # chœur : u → o → a, de plus en plus présent
    for (b0, voy, v) in [(1, 'u', 0.3), (5, 'o', 0.4), (9, 'a', 0.5)]:
        for b in range(b0, b0 + 4):
            for k, m in enumerate(VOIX_ACC[ACC1[b - 1]][:3]):
                ch.add(I.choir(m, 4 * B + 0.3, voy, v, 8, 0.4, 0.5, None, s), tb(b), 1.0, (-0.4, 0.4, 0)[k]); s += 1
    # cuivres : appels sur les cadences (mesures 3-4, 7-8, 11-12)
    for b in (3, 7, 11):
        for k, m in enumerate([VOIX_ACC[ACC1[b - 1]][0] - 12, VOIX_ACC[ACC1[b - 1]][1] - 12, VOIX_ACC[ACC1[b - 1]][2]]):
            br.add(I.brass(m, 4 * B + 0.2, 0.75, 4, 0.5, 0.4, 0.2, s), tb(b), 0.8, (-0.3, 0.3, 0)[k]); s += 1
        for k, m in enumerate([49 - 12, 52 - 12, 57]):
            br.add(I.brass(m, 4 * B + 0.3, 0.85, 4, 0.12, 0.4, 0.4, s), tb(b + 1), 0.9, (-0.3, 0.3, 0)[k]); s += 1
    # cloches et leitmotif lointain
    bl.add(I.bell(146.8, 0.9, 7.0, s), tb(1), 1.0, -0.2); s += 1
    bl.add(I.bell(146.8, 0.7, 7.0, s), tb(9), 1.0, 0.2); s += 1
    for k, (tp, m) in enumerate([(1.5, 74), (2.5, 77), (3.0, 76), (3.5, 69), (4.5, 73)]):
        bo.add(I.musicbox(m, 0.5, 2.6, 0.006, s), tb(5, tp), 1.0, 0.3); s += 1
    ir = make_ir(3.0, 0.02, seed=31)
    cib = {'cordes': -21, 'nappe': -27, 'choeur': -25, 'cuivres': -21, 'perc': -17, 'cloches': -24, 'boite': -27, 'drone': -29}
    fxs = {'choeur': lambda x: peak_eq(butter_hp(x, 140, 2), 340, -3, 0.9), 'cordes': lambda x: butter_hp(x, 45, 2),
           'cuivres': lambda x: peak_eq(butter_hp(x, 38, 2), 300, -2.5, 0.9), 'boite': lambda x: butter_hp(x, 300, 2),
           'drone': lambda x: butter_lp(x, 1200, 2), 'nappe': lambda x: butter_lp(butter_hp(x, 120, 2), 3500, 2)}
    return M.rendu(ir, cib, fxs, -18.0)


# ═══════════════════════════════ RÉPIT (15,0 s exactement) ═══════════════════════════════

@cue('mus_repit', boucle=False, cible=-15.0, pic=15.0, desc="Répit de 15,0 s exactement : pouls d'une seconde (compte à rebours), tension, montée finale coupée à 14,75 s",
     notes="Durée exacte 15,000 s. Le coup qui suit est le temps 1 de mus_phase2 : lancer mus_phase2 à 15,0 s pile, sans fondu.")
def mus_repit():
    L = 15.0
    M = Morceau(L, boucle=False, queue=0.0)
    dr, st, ch, pe, bl, fx = (M.bus('drone', 0.25), M.bus('cordes', 0.35), M.bus('choeur', 0.45), M.bus('perc', 0.15),
                              M.bus('cloches', 0.55), M.bus('fx', 0.35))
    s = 2000
    dr.add(I.drone(26, 15.2, 0.6, s), 0, 1.0, 0.0); s += 1
    for i, m in enumerate([74, 75, 81]):                       # grappe aiguë : Ré, Mi♭, La (tension)
        st.add(I.strings(m, 11.5, 'sustain', 0.22, 6, 3.0, s), 0.2, 0.6, (-0.6, 0.6, 0)[i]); s += 1
    # pouls d'une seconde : le compte à rebours
    for k in range(15):
        v = 0.45 + 0.03 * k
        pe.add(tambour_doux(55.0, v, 1.0, s), float(k), 1.0, 0.0); s += 1
    bl.add(I.bell(110.0, 0.6, 7.0, s), 0.0, 1.0, -0.3); s += 1
    bl.add(I.bell(110.0, 0.5, 6.0, s), 7.5, 1.0, 0.3); s += 1
    fx.add(murmures_st(10.0, s, [(0, 0), (3, 0.6), (9, 0.4), (10, 0)]), 1.0, 0.25); s += 1
    # 11 → 14,75 : montée (croches, cordes et chœur qui grimpent, montée de bruit)
    for k in range(8):
        pe.add(tambour_doux(73.4, 0.6 + 0.04 * k, 0.9, s), 11.0 + k * 0.5, 1.0, 0.1 if k % 2 else -0.1); s += 1
    for k in range(6):
        pe.add(I.tom(110 + 20 * (k % 3), 0.55 + 0.05 * k, s), 13.25 + k * 0.25, 0.9, -0.3 + 0.12 * k); s += 1
    for i, (m0, m1) in enumerate([(50, 53), (57, 61), (62, 65)]):
        st.add(cordes_glisse(m0, m1, 3.75, 0.5, 6, s, 1.5, 1.6), 11.0, 0.9, (-0.5, 0.5, 0)[i]); s += 1
    for i, m in enumerate([50, 57, 62]):
        ch.add(I.choir(m, 3.75, 'o', 0.5, 8, 2.5, 0.2, 'a', s), 11.0, 1.0, (-0.4, 0.4, 0)[i]); s += 1
    fx.add(I.riser(3.75, 300, 9000, 0.7, s), 11.0, 1.0, 0.0); s += 1
    fx.add(I.reverse_cymbal(1.5), 14.75 - 1.5, 0.8, 0.0)
    M.respiration(14.72, 0.03, 0.0)
    ir = make_ir(3.0, 0.02, seed=41)
    cib = {'drone': -27, 'cordes': -24, 'choeur': -24, 'perc': -19, 'cloches': -24, 'fx': -25}
    out, st_ = M.rendu(ir, cib, {'choeur': lambda x: butter_hp(x, 140, 2), 'drone': lambda x: butter_lp(x, 1200, 2)}, -15.0, fin_fondu=0)
    # un répit doit rester calme : −7 dB jusqu'à 10,5 s, puis la montée reprend toute la place
    from lib.voix import courbe as _c
    out = out * _c([(0, 0.45), (10.5, 0.45), (14.0, 1.0), (15.0, 1.0)], out.shape[1])
    from lib.sortie import integrated as _i
    out *= 10 ** ((-15.0 - _i(out)) / 20)
    # la réverbération ne déborde pas : silence net après 14,75 s (le temps 1 de la phase 2 suit à 15,0 s)
    a, b = secs(14.75), secs(14.8)
    out[:, a:b] *= np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2
    out[:, b:] = 0
    return out, st_


# ═══════════════════════════════ PHASE 2 ═══════════════════════════════

ACC2 = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Eb', 'Eb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A']


@cue('mus_phase2', cible=-18.0, desc="Phase 2 — L'Absorption des âmes (boucle 30,0 s, 112 bpm, 14 mesures ; le temps 1 est un coup)")
def mus_phase2():
    B, tb = grille(112)
    M = Morceau(14 * 4 * B)
    st, pad, ch, br, pe, gt, bl, fx = (M.bus('cordes', 0.22), M.bus('nappe', 0.35), M.bus('choeur', 0.45), M.bus('cuivres', 0.3),
                                       M.bus('perc', 0.18), M.bus('guitares', 0.08), M.bus('cloches', 0.5), M.bus('fx', 0.35))
    s = 3000
    for b, acc in enumerate(ACC2, start=1):
        r = RAC[acc]
        pat = [r + 12, r + 12, r + 24, r + 12] * 4
        if acc in ('Dm', 'Gm'):
            pat[9] = r + 15; pat[13] = r + 14
        for i, m in enumerate(pat):
            a = 1.0 if i % 4 == 0 else 0.7
            st.add(I.strings(m, 0.3, 'spiccato', 0.72 * a, 6, None, s), tb(b, 1 + i * 0.25), 1.0, -0.5 if i % 2 else 0.5); s += 1
        for k, m in enumerate(VOIX_ACC[acc]):
            pad.add(I.strings(m, 4 * B + 0.2, 'sustain', 0.3, 6, 0.4, s), tb(b), 0.7, (-0.5, 0.5, -0.2, 0.2)[k]); s += 1
        pt = [(1, 1.0), (2, 0.7), (2.5, 0.6), (3, 0.85), (4, 0.7), (4.5, 0.6)] if b % 2 else [(1, 1.0), (1.75, 0.55), (2.5, 0.7), (3, 0.85), (3.75, 0.55), (4.5, 0.7)]
        for tp, v in pt:
            pe.add(I.taiko(73.4 if tp % 1 == 0 else 55.0, v, 1.4, s), tb(b, tp), 1.0, 0.12 if tp % 1 else -0.12); s += 1
        for tp in (2, 4):
            pe.add(I.snare(0.5, 0.3, s), tb(b, tp), 0.5, 0.2); s += 1
        if 5 <= b <= 8 or b >= 11:
            for tp in (1, 1.75, 2.5, 3, 3.75, 4.5):
                for sd, pp in ((s, -0.85), (s + 1, 0.85)):
                    gt.add(I.guitar([r, r + 7, r + 12], 0.25 * B + 0.05, True, 0.85, sd), tb(b, tp) + (0.005 if pp > 0 else 0), 1.0, pp)
                s += 2
    # coup du temps 1 (aussi le « coup » qui suit le répit)
    pe.add(I.boom(36, 2.6, 0.9), 0.0, 1.2, 0.0)
    pe.add(I.crash(0.9, 2.6, s), 0.0, 0.8, 0.2); s += 1
    br.add(I.braam([26, 38, 45, 50], 1.8, 0.85, s), 0.0, 1.0, 0.0); s += 1
    # cuivres : leitmotif augmenté
    mel = [(5, 1, 62, 2), (5, 3, 65, 2), (6, 1, 64, 2), (6, 3, 62, 2), (7, 1, 63, 2), (7, 3, 67, 2), (8, 1, 65, 2), (8, 3, 63, 2),
           (9, 1, 62, 4), (10, 1, 61, 2), (10, 3, 64, 2)]
    for b, tp, m, d in mel:
        br.add(I.brass(m, d * B + 0.15, 0.8, 4, 0.06, 0.25, 0.3, s), tb(b, tp), 0.9, 0.15); s += 1
        br.add(I.brass(m - 12, d * B + 0.15, 0.75, 4, 0.06, 0.25, 0.5, s), tb(b, tp), 0.7, -0.15); s += 1
    for b in (9, 10, 13, 14):
        for k, m in enumerate(VOIX_ACC[ACC2[b - 1]][:3]):
            ch.add(I.choir(m, 4 * B, 'a', 0.6, 8, 0.15, 0.4, None, s), tb(b), 1.0, (-0.4, 0.4, 0)[k]); s += 1
    for b in (1, 7, 11):
        bl.add(I.bell(146.8, 0.8, 6.0, s), tb(b), 1.0, 0.0); s += 1
    fx.add(I.snare_roll(4 * B, 0.15, 0.9, 16, s), tb(14), 0.8, 0.0); s += 1
    fx.add(I.reverse_cymbal(1.2), tb(15) - 1.2, 0.6, 0.0)
    ir = make_ir(2.8, 0.02, seed=51)
    cib = {'cordes': -20, 'nappe': -27, 'choeur': -24, 'cuivres': -19, 'perc': -16, 'guitares': -23, 'cloches': -25, 'fx': -25}
    fxs = {'choeur': lambda x: peak_eq(butter_hp(x, 140, 2), 340, -3, 0.9), 'cordes': lambda x: butter_hp(x, 60, 2),
           'cuivres': lambda x: peak_eq(butter_hp(x, 38, 2), 300, -2.5, 0.9), 'guitares': lambda x: peak_eq(butter_hp(x, 100, 2), 280, -3, 0.9),
           'nappe': lambda x: butter_lp(butter_hp(x, 120, 2), 3500, 2)}
    return M.rendu(ir, cib, fxs, -18.0)


# ═══════════════════════════════ ABSENCE (30,0 s exactement) ═══════════════════════════════

@cue('mus_absence', boucle=False, cible=-15.0, desc="Absence du boss, 30,0 s exactement : cœur qui accélère, murmures, montée, 0,5 s de vide à la fin",
     notes="Durée exacte 30,000 s ; vide de 29,5 à 30,0 s. Le retour du boss est l'effet retour_rage, à lancer à 30,0 s.")
def mus_absence():
    L = 30.0
    M = Morceau(L, boucle=False, queue=0.0)
    dr, st, pe, bl, fx, ch = (M.bus('drone', 0.25), M.bus('cordes', 0.35), M.bus('perc', 0.12), M.bus('cloches', 0.55),
                              M.bus('fx', 0.35), M.bus('choeur', 0.45))
    s = 4000
    # cœur : de 50 à 140 battements/min
    temps, t = [], 0.6
    while t < 29.3:
        temps.append(t)
        bpm = 50 + 90 * (t / 29.5) ** 1.6
        t += 60.0 / bpm
    hb = battement_coeur(L, temps, s, 1.0, 0.8); s += 1
    pe.add(hb * np.linspace(0.6, 1.0, len(hb)), 0.0, 1.0, 0.0)
    m = secs(L); tt = np.arange(m) / SR
    f = 73.42 * (77.78 / 73.42) ** (tt / L)              # bourdon qui monte de Ré à Mi♭
    d = sum(saw(np.ascontiguousarray(f * (1 + 0.004 * k)), 0.1 * k) for k in range(-2, 3)) / 5
    d = lp(d, 300 + 900 * (tt / L) ** 2, 1.2) * np.minimum(1, tt / 3.0)
    dr.add(d, 0.0, 1.0, 0.0)
    dr.add(I.drone(26, 29.6, 0.5, s), 0.0, 0.7, 0.0); s += 1
    for i, mm in enumerate([86, 87, 93]):                 # harmoniques aiguës en grappe, crescendo
        st.add(I.strings(mm, 28.0, 'sustain', 0.25, 6, 14.0, s), 1.5, 0.5, (-0.6, 0.6, 0)[i]); s += 1
    for i, (m0, m1) in enumerate([(50, 51), (57, 58), (62, 63)]):
        st.add(cordes_glisse(m0, m1, 12.0, 0.4, 6, s, 8.0, 1.0), 17.5, 0.8, (-0.5, 0.5, 0)[i]); s += 1
    cl = 0.5
    k = 0
    while cl < 27.5:                                        # glas de plus en plus rapprochés
        bl.add(I.bell(110.0, 0.5 + 0.02 * k, 5.0, s), cl, 1.0, (-0.4, 0.4)[k % 2]); s += 1
        cl += max(1.6, 6.0 - 0.45 * k); k += 1
    fx.add(murmures_st(28.5, s, [(0, 0), (6, 0.35), (20, 0.7), (28.5, 1.0)]), 0.8, 0.45); s += 1
    for i, mm in enumerate([50, 53, 57]):
        ch.add(I.choir(mm, 6.5, 'u', 0.45, 8, 4.0, 0.2, 'a', s), 23.0, 1.0, (-0.4, 0.4, 0)[i]); s += 1
    fx.add(I.riser(4.0, 250, 9000, 0.8, s), 25.5, 1.0, 0.0); s += 1
    fx.add(I.reverse_cymbal(2.0), 29.5 - 2.0, 0.9, 0.0)
    M.respiration(29.47, 0.03, 0.0)
    ir = make_ir(3.0, 0.02, seed=61)
    cib = {'drone': -25, 'cordes': -25, 'perc': -18, 'cloches': -24, 'fx': -24, 'choeur': -25}
    out, st_ = M.rendu(ir, cib, {'choeur': lambda x: butter_hp(x, 140, 2)}, -15.0, fin_fondu=0)
    # crescendo continu sur les 30 s (de −11 dB à 0)
    from lib.voix import courbe as _c
    out = out * _c([(0, 0.28), (8, 0.36), (20, 0.6), (27, 0.9), (29.5, 1.0), (30, 1.0)], out.shape[1])
    from lib.sortie import integrated as _i
    out *= 10 ** ((-15.0 - _i(out)) / 20)
    a, b = secs(29.5), secs(29.53)
    out[:, a:b] *= np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2
    out[:, b:] = 0
    return out, st_


# ═══════════════════════════════ PHASE 3 ═══════════════════════════════

ACC3 = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A', 'Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Eb', 'A', 'A']


@cue('mus_phase3', cible=-18.0, desc="Phase 3 — La Colère du bunker (boucle 30,0 s, 128 bpm, 16 mesures : taikos lourds, guitares, braams)")
def mus_phase3():
    B, tb = grille(128)
    M = Morceau(16 * 4 * B)
    st, ch, br, pe, gt, fx = (M.bus('cordes', 0.2), M.bus('choeur', 0.45), M.bus('cuivres', 0.28), M.bus('perc', 0.15),
                              M.bus('guitares', 0.07), M.bus('fx', 0.3))
    s = 5000
    for b, acc in enumerate(ACC3, start=1):
        r = RAC[acc]
        pt = [(1, 1.0), (1.5, 0.6), (2, 0.8), (2.75, 0.6), (3, 0.9), (3.5, 0.6), (4, 0.8), (4.5, 0.7)]
        for tp, v in pt:
            pe.add(I.taiko(73.4 if tp in (1, 3) else 55.0, v, 1.3, s), tb(b, tp), 1.0, -0.15 if tp % 1 == 0 else 0.15); s += 1
        for tp in (2, 4):
            pe.add(I.anvil(1050, 0.5, 1.4, s), tb(b, tp), 0.75, 0.4); s += 1
        rythme = [1, 1.25, 1.75, 2, 2.5, 2.75, 3, 3.25, 3.75, 4, 4.5] if b % 2 else [1, 1.5, 1.75, 2.25, 2.5, 3, 3.5, 3.75, 4.25, 4.5]
        for tp in rythme:
            for sd, pp in ((s, -0.85), (s + 1, 0.85)):
                gt.add(I.guitar([r, r + 7, r + 12], 0.25 * B + 0.04, True, 0.9, sd), tb(b, tp) + (0.005 if pp > 0 else 0), 1.0, pp)
            s += 2
        for i in range(8):
            m = r + 24 + (0 if i % 2 == 0 else (3 if acc in ('Dm', 'Gm') else 4))
            st.add(I.strings(m, 0.3, 'spiccato', 0.7, 6, None, s), tb(b, 1 + i * 0.5), 1.0, -0.4 if i % 2 else 0.4); s += 1
        if acc == 'A' and b % 2 == 0:
            st.add(I.strings(56, 4 * B, 'sustain', 0.5, 6, 0.1, s), tb(b), 0.8, 0.0); s += 1     # sol♯ : triton sur ré
    for b in (1, 5, 9, 13):
        pe.add(I.boom(36, 2.2, 0.8), tb(b), 1.0, 0.0)
        br.add(I.braam([RAC[ACC3[b - 1]] - 12, RAC[ACC3[b - 1]], RAC[ACC3[b - 1]] + 7, RAC[ACC3[b - 1]] + 12], 4 * B + 0.4, 0.95, s), tb(b), 1.0, 0.0); s += 1
        pe.add(I.crash(0.8, 2.5, s), tb(b), 0.6, 0.25); s += 1
    for b in list(range(5, 9)) + list(range(13, 17)):
        for k, m in enumerate(VOIX_ACC[ACC3[b - 1]][:3]):
            for tp in (1, 3):
                ch.add(I.choir(m, 2 * B * 0.9, 'a', 0.65, 8, 0.03, 0.25, 'o', s), tb(b, tp), 1.0, (-0.4, 0.4, 0)[k]); s += 1
    fx.add(I.snare_roll(2 * B, 0.2, 0.9, 16, s), tb(16, 3), 0.8, 0.0); s += 1
    ir = make_ir(2.6, 0.02, seed=71)
    cib = {'cordes': -21, 'choeur': -23, 'cuivres': -18, 'perc': -15, 'guitares': -21, 'fx': -25}
    fxs = {'choeur': lambda x: peak_eq(butter_hp(x, 140, 2), 340, -3, 0.9), 'cordes': lambda x: butter_hp(x, 80, 2),
           'cuivres': lambda x: peak_eq(butter_hp(x, 38, 2), 300, -2.5, 0.9), 'guitares': lambda x: peak_eq(butter_hp(x, 100, 2), 280, -3, 0.9)}
    return M.rendu(ir, cib, fxs, -18.0)


# ═══════════════════════════════ RITUEL (phase 4) ═══════════════════════════════

ACC4 = ['Dm', 'Dm', 'C', 'C', 'Bb', 'Bb', 'A', 'A'] * 2


def _rituel_base(M, B, tb):
    dr, ch, bl, pe, pad = (M.bus('drone', 0.25), M.bus('chant', 0.4), M.bus('cloches', 0.5), M.bus('perc', 0.2), M.bus('nappe', 0.35))
    s = 6000
    dr.add(I.drone(26, 16 * 4 * B + 1.0, 0.6, s), 0.0, 1.0, 0.0); s += 1
    for b, acc in enumerate(ACC4, start=1):
        r = RAC[acc]
        for k, m in enumerate(VOIX_ACC[acc]):
            pad.add(I.strings(m - 12 if k == 0 else m, 4 * B + 0.2, 'sustain', 0.28, 6, 0.8, s), tb(b), 0.7, (-0.5, 0.5, -0.2, 0.2)[k]); s += 1
        # chant scandé (syllabes courtes) : Ré grave et quinte
        for tp, d in [(1, 0.4), (1.5, 0.4), (2, 0.9), (3, 0.4), (3.5, 0.4), (4, 0.9)]:
            for k, m in enumerate([r + 12, r + 19]):
                ch.add(I.choir(m, d * B * 1.6, 'o' if tp < 3 else 'u', 0.55, 8, 0.04, 0.2, None, s), tb(b, tp), 1.0, (-0.3, 0.3)[k]); s += 1
        for tp, v in [(1, 0.8), (2, 0.5), (3, 0.7), (4, 0.5)]:
            pe.add(lp(I.taiko(110.0, v, 0.9, s), 2500), tb(b, tp), 1.0, 0.2 if tp % 2 else -0.2); s += 1
        if b % 2 == 1:
            bl.add(I.bell(293.7 if b % 4 == 1 else 220.0, 0.7, 6.0, s), tb(b), 1.0, (-0.3 if b % 4 == 1 else 0.3)); s += 1


@cue('mus_rituel', cible=-18.0, desc="Phase 4 — Le Rituel (boucle 32,0 s, 120 bpm, 16 mesures : chant scandé, cloches, tambours)")
def mus_rituel():
    B, tb = grille(120)
    M = Morceau(16 * 4 * B)
    _rituel_base(M, B, tb)
    ir = make_ir(3.2, 0.025, seed=81)
    cib = {'drone': -27, 'chant': -22, 'cloches': -23, 'perc': -19, 'nappe': -26}
    fxs = {'chant': lambda x: peak_eq(butter_hp(x, 120, 2), 340, -2, 0.9), 'drone': lambda x: butter_lp(x, 1200, 2),
           'nappe': lambda x: butter_lp(butter_hp(x, 100, 2), 3500, 2)}
    return M.rendu(ir, cib, fxs, -18.0)


@cue('mus_rituel_tension', cible=-20.0, desc="Couche de tension du rituel (même grille que mus_rituel : 32,0 s, 120 bpm) à monter avec la progression de la capture",
     notes="Même nombre d'échantillons que mus_rituel ; démarrer au même instant d'horloge et régler son gain (0 → 1) selon la progression.")
def mus_rituel_tension():
    B, tb = grille(120)
    M = Morceau(16 * 4 * B)
    st, pe, br, ch, fx = (M.bus('cordes', 0.25), M.bus('perc', 0.15), M.bus('cuivres', 0.3), M.bus('choeur', 0.45), M.bus('fx', 0.35))
    s = 7000
    for b, acc in enumerate(ACC4, start=1):
        r = RAC[acc]
        for i in range(16):
            m = r + 36 if i % 4 == 0 else r + 31
            st.add(I.strings(m, 0.22, 'spiccato', 0.65 if i % 4 == 0 else 0.45, 5, None, s), tb(b, 1 + i * 0.25), 1.0, -0.5 if i % 2 else 0.5); s += 1
        for tp, v in [(1, 0.9), (1.75, 0.6), (3, 0.8), (3.75, 0.6)]:
            pe.add(I.taiko(55.0, v, 1.2, s), tb(b, tp), 1.0, 0.0); s += 1
        if b % 4 == 3:
            for k, m in enumerate([r + 12, r + 19, r + 24]):
                br.add(I.brass(m, 8 * B, 0.7, 4, 3.5, 0.5, 0.2, s), tb(b), 0.9, (-0.3, 0.3, 0)[k]); s += 1
    for b in range(13, 17):
        for k, m in enumerate([74, 75, 81]):
            ch.add(I.choir(m, 4 * B + 0.2, 'e', 0.45, 8, 0.6, 0.4, None, s), tb(b), 1.0, (-0.5, 0.5, 0)[k]); s += 1
    fx.add(I.riser(4 * 4 * B / 2, 300, 8000, 0.6, s), tb(15), 1.0, 0.0); s += 1
    ir = make_ir(3.0, 0.02, seed=82)
    cib = {'cordes': -21, 'perc': -18, 'cuivres': -22, 'choeur': -25, 'fx': -26}
    fxs = {'cordes': lambda x: butter_hp(x, 150, 2), 'choeur': lambda x: butter_hp(x, 300, 2), 'cuivres': lambda x: butter_hp(x, 60, 2)}
    return M.rendu(ir, cib, fxs, -20.0)


# ═══════════════════════════════ FAIBLESSE (fin de phase 4) ═══════════════════════════════

ACCF = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'A']


@cue('mus_faiblesse', cible=-18.0, desc="Boss affaibli (boucle 20,0 s, 96 bpm, 8 mesures) : marche sombre mais dominante pour les joueurs")
def mus_faiblesse():
    B, tb = grille(96)
    M = Morceau(8 * 4 * B)
    st, br, pe, ch, pad = (M.bus('cordes', 0.25), M.bus('cuivres', 0.3), M.bus('perc', 0.15), M.bus('choeur', 0.45), M.bus('nappe', 0.3))
    s = 8000
    for b, acc in enumerate(ACCF, start=1):
        r = RAC[acc]
        for tp, v in [(1, 1.0), (2, 0.6), (2.5, 0.5), (3, 0.85), (4, 0.6), (4.5, 0.5), (4.75, 0.45)]:
            pe.add(I.taiko(73.4 if tp % 1 == 0 else 110.0, v, 1.3, s), tb(b, tp), 1.0, 0.0); s += 1
        for tp in [1, 1.75, 2, 3, 3.5, 3.75, 4]:
            pe.add(I.snare(0.55, 0.3, s), tb(b, tp), 0.55, 0.25); s += 1
        for i, tp in enumerate([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5]):
            st.add(I.strings(r + 12, 0.4, 'spiccato', 0.8 if i % 2 == 0 else 0.6, 6, None, s), tb(b, tp), 1.0, -0.3); s += 1
            st.add(I.strings(r + 24, 0.4, 'spiccato', 0.6 if i % 2 == 0 else 0.45, 5, None, s), tb(b, tp), 0.7, 0.3); s += 1
        for k, m in enumerate(VOIX_ACC[acc]):
            pad.add(I.strings(m, 4 * B + 0.2, 'sustain', 0.3, 6, 0.3, s), tb(b), 0.7, (-0.5, 0.5, -0.2, 0.2)[k]); s += 1
            ch.add(I.choir(m, 4 * B + 0.2, 'a', 0.5, 8, 0.2, 0.4, None, s), tb(b), 0.8, (-0.5, 0.5, -0.2, 0.2)[k]); s += 1
    # ligne de cuivres : appel héroïque-sombre
    mel = [(1, 1, 62, 3), (1, 4, 65, 1), (2, 1, 62, 2), (2, 3, 58, 2), (3, 1, 60, 3), (3, 4, 57, 1), (4, 1, 60, 2), (4, 3, 64, 2),
           (5, 1, 62, 3), (5, 4, 65, 1), (6, 1, 69, 2), (6, 3, 65, 2), (7, 1, 67, 2), (7, 3, 64, 2), (8, 1, 61, 4)]
    for b, tp, m, d in mel:
        br.add(I.brass(m - 12, d * B + 0.15, 0.85, 4, 0.06, 0.3, 0.4, s), tb(b, tp), 1.0, -0.15); s += 1
        br.add(I.brass(m, d * B + 0.15, 0.7, 4, 0.06, 0.3, 0.2, s), tb(b, tp), 0.6, 0.15); s += 1
    ir = make_ir(2.8, 0.02, seed=91)
    cib = {'cordes': -21, 'cuivres': -19, 'perc': -17, 'choeur': -25, 'nappe': -27}
    fxs = {'choeur': lambda x: peak_eq(butter_hp(x, 140, 2), 340, -3, 0.9), 'cordes': lambda x: butter_hp(x, 50, 2),
           'cuivres': lambda x: peak_eq(butter_hp(x, 38, 2), 300, -2.5, 0.9), 'nappe': lambda x: butter_lp(butter_hp(x, 120, 2), 3500, 2)}
    return M.rendu(ir, cib, fxs, -18.0)


# ═══════════════════════════════ PHASE 5 ═══════════════════════════════

def _phase5_base(M, B, tb, nb):
    dr, st, bl, bo, pe, mt = (M.bus('drone', 0.25), M.bus('cordes', 0.4), M.bus('cloches', 0.6), M.bus('boite', 0.8),
                              M.bus('perc', 0.15), M.bus('metal', 0.5))
    s = 9000
    L = nb * 4 * B
    dr.add(I.drone(26, L + 1.0, 0.6, s), 0.0, 1.0, -0.1); s += 1
    dr.add(I.drone(27, L + 1.0, 0.35, s), 0.0, 1.0, 0.1); s += 1          # Mi♭ grave : battements, malaise
    # grappes de cordes dissonantes qui glissent lentement
    for k, (b, m0, m1) in enumerate([(1, 62, 63), (1, 68, 67), (4, 50, 49), (4, 56, 57), (7, 63, 62), (7, 69, 68)]):
        st.add(cordes_glisse(m0, m1, 3 * 4 * B + 0.5, 0.35, 6, s, 3.0, 1.0), tb(b), 1.0, (-0.6, 0.6)[k % 2]); s += 1
    # cloches lointaines (grave, beaucoup d'espace)
    for b in (1, 5):
        bl.add(lp(I.bell(110.0, 0.6, 7.0, s), 2000), tb(b), 1.0, (-0.4, 0.4)[b % 2]); s += 1
    # leitmotif : boîte à musique ralentie, faussée (un quart de ton plus bas), pleurage fort
    for k, (b, tp, m) in enumerate([(2, 1, 74), (2, 3, 77), (3, 1, 76), (3, 3, 69), (4, 1, 73), (6, 1, 74), (6, 3, 77), (7, 1, 76), (7, 3, 69), (8, 1, 72)]):
        note = I.musicbox(m - 0.45, 0.45, 3.4, 0.02, s); s += 1
        tt = np.arange(len(note)) / SR
        note = note * (0.75 + 0.25 * np.sin(2 * np.pi * 173.0 * tt))         # modulation en anneau légère : métallique
        bo.add(note, tb(b, tp), 1.0, 0.25 if k % 2 else -0.25)
    # métal frotté : plaintes
    for b in (3, 6, 9):
        mt.add(metal_frotte(3.5, 430 + 37 * b, s, [(0, 0), (1.2, 1.0), (3.5, 0)], 0.12), tb(b, 2), 0.8, (-0.5, 0.5, 0)[b % 3]); s += 1
    # pas lourds et rares (cœur sourd)
    for b in range(1, nb + 1):
        for tp in (1, 3):
            pe.add(tambour_doux(48.0, 0.7 if tp == 1 else 0.5, 1.3, s), tb(b, tp), 1.0, 0.0); s += 1


@cue('mus_phase5', cible=-18.0, desc="Phase 5 — Le Dernier Pacte (boucle 30,86 s, 70 bpm, 9 mesures) : drones, cordes dissonantes, cloches lointaines, leitmotif faussé")
def mus_phase5():
    B, tb = grille(70)
    M = Morceau(9 * 4 * B)
    _phase5_base(M, B, tb, 9)
    ir = make_ir(4.0, 0.03, seed=101)
    cib = {'drone': -24, 'cordes': -25, 'cloches': -26, 'boite': -25, 'perc': -21, 'metal': -29}
    fxs = {'drone': lambda x: butter_lp(x, 900, 2), 'cordes': lambda x: butter_lp(butter_hp(x, 80, 2), 3000, 2), 'boite': lambda x: butter_hp(x, 250, 2)}
    return M.rendu(ir, cib, fxs, -18.0)


@cue('mus_phase5_traque', cible=-20.0, desc="Couche « traque » de la phase 5 (même grille : 30,86 s, 70 bpm) à monter quand le boss est proche",
     notes="Même nombre d'échantillons que mus_phase5 ; démarrer au même instant et régler son gain selon la distance du boss.")
def mus_phase5_traque():
    B, tb = grille(70)
    M = Morceau(9 * 4 * B)
    st, pe, sf, mt = (M.bus('cordes', 0.2), M.bus('perc', 0.15), M.bus('stridences', 0.4), M.bus('metal', 0.5))
    s = 9500
    for b in range(1, 10):
        for i in range(16):
            m = 38 if i % 4 != 3 else 39
            st.add(I.strings(m, 0.18, 'spiccato', 0.8 if i % 4 == 0 else 0.55, 6, None, s), tb(b, 1 + i * 0.25), 1.0, -0.3 if i % 2 else 0.3); s += 1
        for tp, v in [(1, 1.0), (1.75, 0.6), (2.5, 0.75), (3, 0.9), (3.5, 0.6), (4.25, 0.7)]:
            pe.add(I.taiko(73.4 if tp % 1 == 0 else 55.0, v, 1.2, s), tb(b, tp), 1.0, 0.1 if tp % 1 else -0.1); s += 1
        for tp in (2.5, 4.5):
            for k, m in enumerate([86, 87]):
                sf.add(I.strings(m, 0.35, 'spiccato', 0.9, 5, None, s), tb(b, tp), 1.0, (-0.5, 0.5)[k]); s += 1
        if b % 3 == 0:
            mt.add(metal_frotte(1.6, 900, s, [(0, 0), (0.3, 1.0), (1.6, 0)], 0.2), tb(b, 3), 0.8, 0.0); s += 1
    ir = make_ir(3.0, 0.02, seed=102)
    cib = {'cordes': -20, 'perc': -17, 'stridences': -24, 'metal': -27}
    fxs = {'cordes': lambda x: butter_hp(x, 50, 2), 'stridences': lambda x: butter_hp(x, 900, 2)}
    return M.rendu(ir, cib, fxs, -20.0)


# ═══════════════════════════════ DÉFAITE ═══════════════════════════════

@cue('mus_defaite', boucle=False, cible=-15.0, pic=0.0, desc="Mort du boss (≈ 8 s) : coup, effondrement des cordes, chœur qui s'éteint, accord final pianissimo")
def mus_defaite():
    M = Morceau(5.5, boucle=False, queue=2.7)
    pe, br, ch, st, bl, pad = (M.bus('perc', 0.2), M.bus('cuivres', 0.3), M.bus('choeur', 0.45), M.bus('cordes', 0.35),
                               M.bus('cloches', 0.55), M.bus('nappe', 0.4))
    s = 9800
    pe.add(I.boom(34, 3.2, 1.0), 0.0, 1.3, 0.0)
    pe.add(I.taiko(50, 1.0, 2.0, s), 0.0, 1.1, 0.0); s += 1
    pe.add(I.crash(1.0, 3.5, s), 0.0, 0.8, 0.2); s += 1
    br.add(I.braam([26, 38, 45, 50, 53], 2.6, 1.0, s), 0.0, 1.2, 0.0); s += 1
    for i, m in enumerate([50, 57, 62, 65]):
        ch.add(I.choir(m, 3.0, 'a', 0.85, 10, 0.03, 1.5, 'u', s), 0.0, 1.0, (-0.4, 0.4, -0.2, 0.2)[i]); s += 1
    for i, (m0, m1) in enumerate([(74, 50), (81, 57), (86, 62)]):
        st.add(cordes_glisse(m0, m1, 3.2, 0.55, 6, s, 0.05, 0.7), 0.3, 1.0, (-0.5, 0.5, 0)[i]); s += 1
    bl.add(I.bell(110.0, 0.7, 6.0, s), 2.6, 1.0, 0.0); s += 1
    for i, m in enumerate([38, 50, 53, 57, 62]):
        pad.add(I.strings(m, 4.6, 'sustain', 0.3, 6, 1.6, s), 3.4, 1.0, (-0.4, 0.4, -0.2, 0.2, 0)[i]); s += 1
    for i, m in enumerate([50, 57]):
        ch.add(I.choir(m, 4.4, 'u', 0.3, 8, 1.8, 2.0, None, s), 3.6, 0.6, (-0.3, 0.3)[i]); s += 1
    ir = make_ir(3.6, 0.025, seed=111)
    cib = {'perc': -16, 'cuivres': -19, 'choeur': -23, 'cordes': -23, 'cloches': -24, 'nappe': -27}
    fxs = {'choeur': lambda x: peak_eq(butter_hp(x, 140, 2), 340, -3, 0.9)}
    return M.rendu(ir, cib, fxs, -15.0, fin_fondu=1.5)


# ═══════════════════════════════ VICTOIRE ═══════════════════════════════

@cue('mus_victoire', boucle=False, cible=-15.0, desc="Conclusion et récompenses (≈ 14 s) : le leitmotif résolu en ré majeur (tierce picarde), solennel et sombre")
def mus_victoire():
    B, tb = grille(72)
    M = Morceau(11.0, boucle=False, queue=3.2)
    bo, br, st, ch, bl, pe, pad = (M.bus('boite', 0.7), M.bus('cuivres', 0.3), M.bus('cordes', 0.3), M.bus('choeur', 0.45),
                                   M.bus('cloches', 0.55), M.bus('perc', 0.2), M.bus('nappe', 0.35))
    s = 9900
    # 1) la boîte à musique rejoue le motif, cette fois en majeur : Ré–Fa♯–Mi–La–Do♯ → Ré
    for k, (t0, m) in enumerate([(0.3, 74), (0.3 + B, 78), (0.3 + 1.5 * B, 76), (0.3 + 2 * B, 69), (0.3 + 3 * B, 73), (0.3 + 4 * B, 74)]):
        bo.add(I.musicbox(m, 0.6, 3.0, 0.004, s), t0, 1.0, 0.2 if k % 2 else -0.2); s += 1
    # 2) choral : Si♭ – Do – Ré majeur, cuivres et cordes, leitmotif aux cuivres
    t1 = 0.3 + 5 * B
    progr = [('Bb', [46, 50, 53, 58, 62]), ('C', [48, 52, 55, 60, 64]), ('D', [50, 54, 57, 62, 66])]
    for k, (nom, notes) in enumerate(progr):
        t0 = t1 + k * 2 * B
        d = 2 * B + (3.6 if k == 2 else 0.2)
        for i, m in enumerate(notes):
            pad.add(I.strings(m, d, 'sustain', 0.4, 6, 0.6, s), t0, 1.0, (-0.5, 0.5, -0.25, 0.25, 0)[i]); s += 1
            ch.add(I.choir(m, d, 'a' if k < 2 else 'o', 0.5, 8, 0.5, 1.2, None, s), t0, 0.8, (-0.5, 0.5, -0.25, 0.25, 0)[i]); s += 1
        br.add(I.brass(notes[0] - 12, d, 0.75, 4, 0.3, 0.8, 0.2, s), t0, 0.9, 0.0); s += 1
    for k, (tp, m, d) in enumerate([(0, 62, 1), (1, 66, 1), (2, 64, 1), (3, 57, 1), (4, 61, 1), (5, 62, 3)]):
        br.add(I.brass(m, d * B + 0.3, 0.75, 4, 0.08, 0.5, 0.0, s), t1 + tp * B, 0.9, 0.2); s += 1
    for k in range(6):
        pe.add(lp(I.taiko(73.4, 0.35 + 0.08 * k, 1.4, s), 1500), t1 + 4 * B + k * 0.18, 0.9, 0.0); s += 1
    pe.add(I.boom(36, 3.0, 0.6), t1 + 4 * B, 0.8, 0.0)
    bl.add(I.bell(293.7, 0.8, 7.0, s), t1 + 4 * B, 1.0, -0.2); s += 1
    bl.add(I.bell(146.8, 0.7, 7.0, s), t1 + 4 * B + 0.02, 1.0, 0.2); s += 1
    ir = make_ir(3.6, 0.03, seed=121)
    cib = {'boite': -24, 'cuivres': -20, 'cordes': -23, 'choeur': -24, 'cloches': -23, 'perc': -21, 'nappe': -24}
    fxs = {'choeur': lambda x: peak_eq(butter_hp(x, 140, 2), 340, -3, 0.9), 'boite': lambda x: butter_hp(x, 300, 2)}
    return M.rendu(ir, cib, fxs, -15.0, fin_fondu=2.0)


if __name__ == '__main__':
    cles = sys.argv[1:] or list(REG.keys())
    for c in cles:
        R = REG[c]
        t0 = time.time()
        x, stats = R['fn']()
        m = exporter(c, x, stereo=True, boucle=R['boucle'], description=R['desc'], pic=R['pic'], cible=R['cible'], mesure='I',
                     categorie='musique', notes=R['notes'], extra=R['extra'])
        print(f"{c:20s} {m['duree']:7.3f} s  {m['lufs']:6.1f} LUFS  crête {m['crete']:6.2f}  ({time.time() - t0:.0f} s)  bus {stats}")
