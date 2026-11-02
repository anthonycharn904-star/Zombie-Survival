"""Vérification de tous les fichiers livrés (après décodage MP3, comme dans le navigateur) :
durées, crêtes (échantillon et vraie), sonie, attaque, clics, jointure des boucles, alignement des couches,
cohérence du manifeste. Les entrées externes (sans maître dans masters/, ex. annonce_munitions_max) sont
contrôlées sans comparaison au maître.
Usage : python3 verifier.py   → verif/rapport.txt + verif/rapport.json + png/jointures/*.png"""
import os, sys, json
import numpy as np
import soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.sortie import decoder_mp3, sample_peak_db, true_peak_db, momentary_max, integrated, kweight
from lib.dsp import SR, secs, butter_hp
from scipy.signal import stft

ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ICI, 'out'); VER = os.path.join(ICI, 'verif'); JPNG = os.path.join(ICI, 'png', 'jointures')
os.makedirs(VER, exist_ok=True); os.makedirs(JPNG, exist_ok=True)
man = json.load(open(os.path.join(OUT, 'manifest.json')))
ATTAQUE_LENTE = {   # montées voulues (le son commence par un crescendo ou une aspiration)
    'boss_apparition', 'incantation_charge', 'absorption_debut', 'teleport_depart', 'intro_transition', 'capture_ames',
    'obscurite', 'mur_fissure', 'bloc_reconstruction', 'rituel_fin', 'lames_apparition', 'ailes_deploiement', 'retour_rage',
    'mus_intro', 'mus_absence', 'mus_victoire', 'boss_rugissement', 'pique_alerte', 'ame_extraction', 'boss_faible',
    'frappe_preparation', 'lame_mouvement_1', 'lame_mouvement_2', 'bloc_lancer', 'boss_douleur_2', 'message_final',
    'recompense', 'mus_repit', 'ailes_dissipation', 'zombies_cendres', 'mur_arrachement', 'boss_defaite', 'frappe_ratee',
    'chien_hurlement', 'survolte_charge'}
CONTINUS = {'chien_grognement', 'chien_hurlement', 'irradie_rale', 'intangible_boucle'}   # sans transitoire voulu : toute pointe aiguë y serait un clic
RECENTS = ('chien_', 'tube_', 'miniboss_', 'survolte_', 'irradie_', 'flaque_', 'demembre_', 'zone_radioactive', 'crochet_', 'palier_',
           'murs_', 'zombie_irradie', 'bras_', 'petit_', 'projection_mur', 'intangible_', 'traversee_mur', 'resurgissement')   # v1.2 et v1.3 : pointes aiguës listées
DUREES_EXACTES = {'mus_repit': 15.0, 'mus_absence': 30.0}
COUCHES = {'mus_rituel_tension': 'mus_rituel', 'mus_phase5_traque': 'mus_phase5'}


def mono(x):
    return x.mean(axis=0) if x.ndim == 2 else x


def attaque(x):
    m = np.abs(mono(x))
    seuil = m.max() * 10 ** (-30 / 20)
    i = int(np.argmax(m > seuil))
    return i / SR


def pointes_hf(x, seuil_db=18.0, f_bas=5000, plancher_rel=-45.0):
    """Clics : trames de 1 ms dont l'énergie au-dessus de f_bas dépasse de seuil_db la médiane locale (±40 ms),
    n'est pas dans le bruit de fond des aigus (> leur max − 35 dB) et reste audible (> niveau global du son
    + plancher_rel dB). Renvoie les instants (s)."""
    glob = 10 * np.log10(np.mean(mono(x) ** 2) + 1e-20)
    m = butter_hp(mono(x), f_bas, 4)
    h = secs(0.001); k = len(m) // h
    if k < 10:
        return []
    db = 10 * np.log10(np.mean(m[:k * h].reshape(k, h) ** 2, axis=1) + 1e-20)
    from scipy.ndimage import median_filter
    med = median_filter(db, size=81, mode='nearest')
    i = np.nonzero((db > med + seuil_db) & (db > db.max() - 35) & (db > glob + plancher_rel))[0]
    return [round(float(v) * 0.001, 3) for v in i]


def jointure(x, maitre, complet=None, a0=0):
    """Mesures au point de bouclage (fin → début) sur 3 répétitions de la zone de boucle décodée, comme la
    lecture en boucle de Web Audio (loopStart/loopEnd) ; comparaison au maître WAV (erreur ajoutée par le codec)."""
    x2 = np.atleast_2d(x)
    n = x2.shape[1]
    triple = np.concatenate([x2, x2, x2], axis=1)
    m = triple.mean(axis=0)
    ma = np.atleast_2d(maitre)
    mt = np.concatenate([ma, ma, ma], axis=1).mean(axis=0)
    err = m - mt
    w = secs(0.02)
    rms = lambda v: np.sqrt(np.mean(v ** 2) + 1e-20)
    e_j = rms(err[n - w:n + w])
    e_ailleurs = np.median([rms(err[k:k + 2 * w]) for k in range(n + secs(0.1), 2 * n - secs(0.1) - 2 * w, w)])
    # référence : le même passage fin → début, mais lu en continu dans le fichier (contexte), sans jonction
    e_ref = None
    if complet is not None:
        c = np.atleast_2d(complet).mean(axis=0)
        if a0 + n + w <= len(c):
            seg = c[a0 + n - w:a0 + n + w] - mt[n - w:n + w]
            e_ref = rms(seg)
    # 1) saut d'amplitude à la jonction comparé aux différences locales
    d = np.abs(np.diff(m))
    j = n - 1
    saut = d[j]
    local = np.percentile(d[j - 2400:j + 2400], 99)
    # 2) flux spectral à la jonction comparé au flux habituel du fichier
    f, t, Z = stft(m, SR, nperseg=1024, noverlap=768)
    A = np.log10(np.abs(Z) + 1e-9)
    flux = np.sqrt(np.mean(np.diff(A, axis=1) ** 2, axis=0))
    tc = (t[1:] + t[:-1]) / 2
    près = np.abs(tc - n / SR) < 0.03
    ailleurs = (tc > n / SR + 0.1) & (tc < 2 * n / SR - 0.1)
    flux_j = float(flux[près].max()) if près.any() else 0.0
    flux_med = float(np.median(flux[ailleurs])); flux_p99 = float(np.percentile(flux[ailleurs], 99))
    flux_max = float(flux[ailleurs].max())
    # 3) continuité d'énergie (20 ms de part et d'autre)
    w = secs(0.02)
    e_fin = 10 * np.log10(np.mean(m[n - w:n] ** 2) + 1e-12); e_deb = 10 * np.log10(np.mean(m[n:n + w] ** 2) + 1e-12)
    return dict(saut_rel=float(saut / (local + 1e-12)), flux_jonction=flux_j, flux_median=flux_med, flux_p99=flux_p99,
                flux_max_ailleurs=flux_max, ecart_energie_db=float(e_deb - e_fin),
                erreur_codec_jonction=float(e_j / (e_ailleurs + 1e-20)),
                erreur_jonction_vs_continu=None if e_ref is None else float(e_j / (e_ref + 1e-20))), triple


def png_jointure(triple, n, cle):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from scipy.signal import spectrogram
    m = np.atleast_2d(triple).mean(axis=0)
    a, b = n - secs(0.6), n + secs(0.6)
    seg = m[a:b]
    f, t, S = spectrogram(seg, SR, nperseg=512, noverlap=448)
    fig, ax = plt.subplots(2, 1, figsize=(8, 4))
    tt = np.arange(len(seg)) / SR - 0.6
    ax[0].plot(tt, seg, lw=0.4, color='#ddd'); ax[0].axvline(0, color='#e44', lw=0.8); ax[0].set_facecolor('#111')
    ax[0].set_title(cle + ' — jonction de boucle (trait rouge)', color='w', fontsize=9)
    ax[1].pcolormesh(t - 0.6, f, 10 * np.log10(S + 1e-14), shading='auto', cmap='magma', vmin=-130, vmax=-30)
    ax[1].set_yscale('symlog', linthresh=200); ax[1].set_ylim(30, 20000)
    fig.patch.set_facecolor('#111')
    for x in ax: x.tick_params(colors='w', labelsize=7)
    fig.tight_layout(); fig.savefig(os.path.join(JPNG, cle + '.png'), dpi=70); plt.close(fig)


rapport = {}
lignes = []
problemes = []
avertissements = []
for cle, meta in sorted(man.items()):
    d = decoder_mp3(os.path.join(OUT, meta['fichier']), meta['stereo'])
    chemin_maitre = os.path.join(ICI, 'masters', cle + '.wav')
    externe = not os.path.exists(chemin_maitre)
    wav = None if externe else sf.read(chemin_maitre)[0]
    complet = d; a0 = 0
    if meta['boucle']:
        a0 = int(round(meta['boucleDebut'] * SR)); a1 = int(round(meta['boucleFin'] * SR))
        if d.shape[-1] != int(round(meta['dureeFichier'] * SR)):
            problemes.append(f"{cle} : fichier de {d.shape[-1]} échantillons ≠ {int(round(meta['dureeFichier'] * SR))} annoncés")
        d = d[..., a0:a1]
    n = d.shape[-1]
    r = dict(echantillons=n, echantillons_maitre=None if externe else int(wav.shape[0]), duree=n / SR, externe=externe,
             crete=sample_peak_db(d), crete_vraie=true_peak_db(d), attaque=attaque(d))
    r['lufs_I'] = integrated(d) if n >= secs(0.4) else None
    r['lufs_M'] = momentary_max(d)
    if not externe and n != wav.shape[0]:
        problemes.append(f'{cle} : {n} échantillons décodés ≠ {wav.shape[0]} du maître')
    if meta.get('echantillons') is not None and abs(n - meta['echantillons']) > (secs(0.024) if externe else 0):
        # entrée externe : signalée sans être comptée comme un problème de la chaîne
        (avertissements if externe else problemes).append(
            f"{cle} : {n} échantillons décodés ≠ {meta['echantillons']} annoncés dans le manifeste ({n / SR:.3f} s ≠ {meta['echantillons'] / SR:.3f} s)"
            + (' — entrée externe, non produite par la chaîne' if externe else ''))
    if r['crete'] > -1.0:
        problemes.append(f'{cle} : crête {r["crete"]:.2f} dBFS > −1')
    if r['crete_vraie'] > -1.0:
        avertissements.append(f'{cle} : crête vraie {r["crete_vraie"]:.2f} dBTP > −1 (crête échantillon {r["crete"]:.2f})')
    # bords : un son qui ne s'arrête pas à zéro claque à la fin ; le début n'est contrôlé que pour les sons
    # continus (les sons percussifs commencent volontairement par un transitoire)
    if not meta['boucle']:
        r['bord_debut_db'] = float(20 * np.log10(np.max(np.abs(np.atleast_2d(d)[:, :1])) + 1e-12))
        r['bord_fin_db'] = float(20 * np.log10(np.max(np.abs(np.atleast_2d(d)[:, -1:])) + 1e-12))
        if r['bord_fin_db'] > -50 or (cle in CONTINUS and r['bord_debut_db'] > -40):
            problemes.append(f"{cle} : bord non nul (début {r['bord_debut_db']:.0f} dBFS, fin {r['bord_fin_db']:.0f} dBFS)")
    if cle.startswith(RECENTS) or cle in CONTINUS:
        src = np.concatenate([d, d, d], axis=-1) if meta['boucle'] else d
        milieu = (lambda p: [round(v - n / SR, 3) for v in p if n / SR <= v < 2 * n / SR]) if meta['boucle'] else (lambda p: p)
        r['pointes_hf'] = milieu(pointes_hf(src))
        if cle in CONTINUS:
            # contrôle strict : un clic numérique est large bande, il ressort au-dessus de 9 kHz
            r['clics'] = milieu(pointes_hf(src, 18.0, 9000))
            if r['clics']:
                problemes.append(f"{cle} : pointes au-dessus de 9 kHz (clics ?) à {r['clics']} s")
    if r['attaque'] > 0.010 and cle not in ATTAQUE_LENTE and not meta['boucle'] and not externe:
        problemes.append(f'{cle} : attaque à {r["attaque"] * 1000:.0f} ms')
    if cle in DUREES_EXACTES and n != secs(DUREES_EXACTES[cle]):
        problemes.append(f'{cle} : {n} échantillons au lieu de {secs(DUREES_EXACTES[cle])}')
    if meta['boucle']:
        j, triple = jointure(d, (wav.T if wav.ndim == 2 else wav) if wav is not None else d, complet, a0)
        r['jointure'] = j
        png_jointure(triple, n, cle)
        sf.write(os.path.join(VER, cle + '_x3.wav'), (triple.T if triple.ndim == 2 else triple), SR, subtype='PCM_16')
        # suspect si : saut d'échantillon anormal, flux spectral au-dessus de toutes les attaques du morceau,
        # ou erreur de codage nettement plus forte à la jonction qu'ailleurs
        # problème si : saut d'échantillon anormal à la jonction, ou erreur de codage à la jonction nettement plus
        # forte que sur le même passage lu en continu (le flux spectral est indicatif : une attaque de temps 1
        # au début de la boucle est normale)
        if j['saut_rel'] > 1.5 or (j['erreur_jonction_vs_continu'] or 0) > 1.6:
            problemes.append(f'{cle} : jointure suspecte {j}')
    if cle in COUCHES:
        base = man[COUCHES[cle]]
        r['aligne_sur'] = COUCHES[cle]
        nb = base['echantillons']
        r['meme_longueur'] = bool(nb == n == meta['echantillons'])
        if not r['meme_longueur']:
            problemes.append(f'{cle} : {n} échantillons ≠ {nb} ({COUCHES[cle]})')
    # le transitoire principal annoncé (« pic ») : le niveau sur 10 ms juste après doit être proche du maximum du son
    if meta.get('pic') is not None and meta['pic'] < r['duree'] - 0.05:
        mm = mono(d); h = secs(0.01); k = len(mm) // h
        env = np.sqrt(np.mean(mm[:k * h].reshape(k, h) ** 2, axis=1))
        i0 = int(meta['pic'] / 0.01)
        loc = env[max(0, i0 - 2):i0 + 8].max()
        r['pic_saillance'] = float(loc / (env.max() + 1e-12))
        if r['pic_saillance'] < 0.5:
            problemes.append(f"{cle} : niveau faible autour du pic annoncé ({meta['pic']} s, {20 * np.log10(r['pic_saillance']):.1f} dB sous le max)")
    rapport[cle] = r
    j = r.get('jointure')
    lignes.append(f"{cle:22s} {r['duree']:7.3f} s  crête {r['crete']:6.2f}/{r['crete_vraie']:6.2f}  "
                  f"I {r['lufs_I'] if r['lufs_I'] is None else round(r['lufs_I'], 1)!s:>6}  M {r['lufs_M']:6.1f}  att {r['attaque'] * 1000:5.0f} ms"
                  + (f"  jonction : saut×{j['saut_rel']:.2f} flux {j['flux_jonction']:.2f} (max ailleurs {j['flux_max_ailleurs']:.2f}) erreur jonction/continu ×{(j['erreur_jonction_vs_continu'] or 0):.2f} ΔE {j['ecart_energie_db']:+.1f} dB" if j else ''))
tot = sum(os.path.getsize(os.path.join(OUT, m['fichier'])) for m in man.values())
entete = [f'{len(man)} fichiers, {tot / 1e6:.2f} Mo', '']
txt = '\n'.join(entete + lignes + ['', 'PROBLÈMES :'] + (problemes or ['aucun'])
                + ['', 'AVERTISSEMENTS :'] + (avertissements or ['aucun']))
open(os.path.join(VER, 'rapport.txt'), 'w').write(txt)
json.dump(dict(fichiers=rapport, problemes=problemes, avertissements=avertissements),
          open(os.path.join(VER, 'rapport.json'), 'w'), ensure_ascii=False, indent=1)
print(txt)
