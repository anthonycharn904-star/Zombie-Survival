"""Mesure (BS.1770) et export des sons du boss : normalisation, limiteur de crête vraie, WAV maître, MP3,
contrôle après décodage, métadonnées pour le manifeste."""
import os, json, subprocess
import numpy as np
import soundfile as sf
from scipy.signal import lfilter, resample_poly
from .dsp import SR, secs, _release

ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTERS = os.path.join(ICI, 'masters')
OUT = os.path.join(ICI, 'out')
META = os.path.join(ICI, 'masters', 'meta')

# ───────────── mesure de sonie (ITU-R BS.1770, 48 kHz) ─────────────
_B1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
_A1 = [1.0, -1.69065929318241, 0.73248077421585]
_B2 = [1.0, -2.0, 1.0]
_A2 = [1.0, -1.99004745483398, 0.99007225036621]


def _2d(x):
    x = np.asarray(x, dtype=np.float64)
    return x[None, :] if x.ndim == 1 else x


def kweight(x):
    y = lfilter(_B1, _A1, _2d(x), axis=-1)
    return lfilter(_B2, _A2, y, axis=-1)


def _blocks(x, win, hop):
    """Sonie (LUFS) de blocs glissants ; un fichier mono compte comme un seul canal."""
    y = kweight(x)
    n = y.shape[1]; w = secs(win); h = secs(hop)
    if n < w:
        y = np.concatenate([y, np.zeros((y.shape[0], w - n))], axis=1); n = w
    out = []
    for i in range(0, n - w + 1, h):
        ms = np.sum(np.mean(y[:, i:i + w] ** 2, axis=1))
        out.append(-0.691 + 10 * np.log10(ms + 1e-20))
    return np.array(out)


def momentary_max(x):
    return float(_blocks(x, 0.4, 0.05).max())


def short_term_max(x):
    return float(_blocks(x, 3.0, 0.1).max())


def integrated(x):
    """Sonie intégrée avec portes absolue (−70) et relative (−10), blocs de 400 ms à 75 %."""
    b = _blocks(x, 0.4, 0.1)
    b = b[b > -70]
    if not len(b):
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(10 ** ((b + 0.691) / 10))) - 10
    g = b[b > rel]
    return float(-0.691 + 10 * np.log10(np.mean(10 ** ((g + 0.691) / 10))))


def true_peak_db(x):
    up = resample_poly(_2d(x), 4, 1, axis=-1)
    return float(20 * np.log10(np.max(np.abs(up)) + 1e-12))


def sample_peak_db(x):
    return float(20 * np.log10(np.max(np.abs(_2d(x))) + 1e-12))


# ───────────── limiteur à anticipation, suréchantillonné ─────────────
def limiteur(x, plafond_db=-1.4, relachement=0.06, anticipation=0.004, boucle=False):
    """Limite les crêtes vraies (suréchantillonnage ×4 pour la détection). boucle=True : traite 3 copies
    et garde celle du milieu (état du limiteur continu à la jointure)."""
    x2 = _2d(x)
    n = x2.shape[1]
    src = np.concatenate([x2, x2, x2], axis=1) if boucle else x2
    det = np.max(np.abs(resample_poly(src, 4, 1, axis=-1)), axis=0)
    det = det.reshape(-1, 4).max(axis=1) if det.shape[0] % 4 == 0 else np.max(np.abs(src), axis=0)
    from scipy.ndimage import maximum_filter1d
    la = secs(anticipation)
    pk = maximum_filter1d(det, size=2 * la + 1)
    c = 10 ** (plafond_db / 20)
    cible = np.minimum(1.0, c / (pk + 1e-12))
    # lissage de l'attaque (fenêtre de Hann sur l'anticipation) puis relâchement exponentiel
    k = np.hanning(2 * la + 1); k /= k.sum()
    cible = np.minimum(cible, np.convolve(np.pad(cible, la, mode='edge'), k, mode='valid'))
    g = _release(np.ascontiguousarray(cible), relachement)
    y = src * g
    if boucle:
        y = y[:, n:2 * n]
    return y if np.asarray(x).ndim > 1 else y[0]


# ───────────── export ─────────────
def _ffmpeg_mp3(wav, mp3, stereo):
    br = '160k' if stereo else '128k'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', br, '-ar', '48000']
    if not stereo:
        cmd += ['-ac', '1']
    subprocess.run(cmd + [mp3], check=True)


def decoder_mp3(mp3, stereo):
    cmd = ['ffmpeg', '-loglevel', 'error', '-i', mp3, '-f', 'f32le', '-ac', '2' if stereo else '1', '-ar', '48000', '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return y.reshape(-1, 2).T if stereo else y


def exporter(cle, x, *, stereo, boucle=False, description='', pic=None, cible=-14.0, mesure='M', categorie='effet',
             plafond=-1.0, notes=None, extra=None):
    """Normalise (mesure 'M' = sonie momentanée max, 'I' = intégrée), limite, écrit WAV maître + MP3, vérifie
    la crête vraie après décodage (≤ plafond dBTP, suréchantillonnage ×4) et écrit les métadonnées du manifeste."""
    os.makedirs(MASTERS, exist_ok=True); os.makedirs(OUT, exist_ok=True); os.makedirs(META, exist_ok=True)
    x = np.asarray(x, dtype=np.float64)
    if stereo and x.ndim == 1:
        x = np.stack([x, x])
    if not stereo and x.ndim == 2:
        x = x.mean(axis=0)
    # supprime une éventuelle composante continue
    x = x - np.mean(x, axis=-1, keepdims=True) * (1 if boucle else 0)
    mesurer = momentary_max if mesure == 'M' else integrated
    g = 10 ** ((cible - mesurer(x)) / 20)
    y = limiteur(x * g, plafond - 0.45, boucle=boucle)
    # une seconde passe corrige la sonie perdue par le limiteur (sans dépasser 1,5 dB)
    corr = min(1.5, max(0.0, cible - mesurer(y)))
    if corr > 0.05:
        y = limiteur(x * g * 10 ** (corr / 20), plafond - 0.45, boucle=boucle)
    wav = os.path.join(MASTERS, cle + '.wav'); mp3 = os.path.join(OUT, cle + '.mp3')
    # Boucles : le MP3 contient un contexte de 0,1 s de part et d'autre (fin de boucle | boucle | début de boucle).
    # Le lecteur boucle sur [boucleDebut, boucleFin] : jointure exacte, même si le navigateur ne retire pas le
    # retard de l'encodeur (le contexte est plus long que ce retard) et sans les artefacts de bord du codec.
    ctx = secs(0.1) if boucle else 0
    for essai in range(4):
        sf.write(wav, (y.T if y.ndim == 2 else y), SR, subtype='PCM_24')
        if boucle:
            ext = np.concatenate([y[..., -ctx:], y, y[..., :ctx]], axis=-1)
            tmp = wav[:-4] + '_ctx.wav'
            sf.write(tmp, (ext.T if ext.ndim == 2 else ext), SR, subtype='PCM_24')
            _ffmpeg_mp3(tmp, mp3, stereo)
            os.remove(tmp)
        else:
            _ffmpeg_mp3(wav, mp3, stereo)
        d = decoder_mp3(mp3, stereo)
        tp = true_peak_db(d)          # v1.2 : crête VRAIE du fichier décodé (avant : crête échantillon)
        if tp <= plafond - 0.05:
            break
        y = y * 10 ** ((plafond - 0.15 - tp) / 20)
    n = y.shape[-1]
    if boucle:
        d = d[..., ctx:ctx + n]
    meta = {
        'fichier': cle + '.mp3', 'duree': round(n / SR, 4), 'echantillons': int(n), 'boucle': bool(boucle),
        'stereo': bool(stereo), 'pic': None if pic is None else round(float(pic), 3),
        'lufs': round(mesurer(d), 1), 'mesure': 'momentanee-max' if mesure == 'M' else 'integree',
        'crete': round(sample_peak_db(d), 2), 'creteVraie': round(true_peak_db(d), 2),
        'categorie': categorie, 'description': description
    }
    if boucle:
        meta['boucleDebut'] = round(ctx / SR, 6)
        meta['boucleFin'] = round((ctx + n) / SR, 6)
        meta['dureeFichier'] = round((n + 2 * ctx) / SR, 6)
    if notes:
        meta['notes'] = notes
    if extra:
        meta.update(extra)
    json.dump(meta, open(os.path.join(META, cle + '.json'), 'w'), ensure_ascii=False, indent=1)
    return meta


# clés retirées du jeu : ni produites ni conservées (v1.5 : les illusions de la phase 5 sont remplacées par l'intangibilité)
RETIRES = {'illusion_apparition', 'illusion_dissipation', 'illusion_murmure', 'palier_illusions'}


def manifeste():
    """Rassemble les métadonnées dans out/manifest.json (ordre alphabétique des clés).
    Les entrées que la chaîne ne produit pas (ajoutées à la main dans le manifeste, sans masters/meta/<clé>.json,
    par exemple `annonce_munitions_max`) sont conservées telles quelles ; un avertissement est affiché si leur
    fichier manque dans out/."""
    chemin = os.path.join(OUT, 'manifest.json')
    ancien = json.load(open(chemin)) if os.path.exists(chemin) else {}
    m = {}
    for f in sorted(os.listdir(META)):
        if f.endswith('.json'):
            m[f[:-5]] = json.load(open(os.path.join(META, f)))
    externes = []
    for cle, e in ancien.items():
        if cle in RETIRES:
            continue
        if cle not in m:
            m[cle] = e
            externes.append(cle)
            if not os.path.exists(os.path.join(OUT, e.get('fichier', cle + '.mp3'))):
                print(f'avertissement : entrée externe {cle} conservée mais {e.get("fichier")} absent de out/')
    m = dict(sorted(m.items()))
    json.dump(m, open(chemin, 'w'), ensure_ascii=False, indent=1)
    if externes:
        print('entrées externes conservées :', ', '.join(externes))
    return m
