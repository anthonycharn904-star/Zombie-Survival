'use strict';
/* Sons des Marécages maudits : export des sons calculés du kit 2.0.7 pour le fond de l'accueil du launcher.
   Export autorisé par Anthony le 31 octobre 2026 (« j'autorise l'export des sons du kit »).

     node maquettes/launcher/scene-bete/exporter-sons.js [--graine 1]

   Seuls les blocs du calcul audio du kit sont exécutés, tels quels, dans une page vide du Chromium sans tête, sans
   réseau :
     · la pluie : ma17_pluie.js, de maWxRand à maWxGenAll (six nappes stéréo de 48 kHz qui bouclent) ;
     · le tonnerre : ma18_orage.js, maBoltPath (le canal qu'on voit) et maThunderChannel à maThunderIR (le son du
       canal, la réverbération de l'orage). Le bloc ne lit qu'une donnée du jeu, MA_OR.tbuf (son tampon partagé).
   Les sources sont celles de la copie vérifiée de preparer.sh ; les empreintes des fichiers et des blocs sont
   contrôlées avant toute exécution. Les mises en scène reprennent les appels du jeu (maFlashCloud, maStrikePlan,
   maBoltGround, maThunderJob) ; le hasard est fixé (graine) : l'export se refait à l'identique.

   Sorties, hors de Git (carte non publiée), dans ressources/marecages/sons/ :
     maitres/*.wav     les tampons du jeu en 16 bits, 48 kHz (ramenés sous ±1 si besoin : « echelle » dans sons.json) ;
     *.ogg             les mêmes en Opus (WebCodecs du Chromium, pas de ffmpeg) : les fichiers du launcher. Les nappes
                       de pluie portent une marge de part et d'autre (« boucle » dans sons.json) : la boucle se coupe
                       au milieu d'un son continu, sans couture ;
     sons.json         durées, niveaux, réglages du jeu (le mélange de la pluie, la chaîne du tonnerre), contrôle du
                       décodage de chaque .ogg (longueur, décalage, rapport signal sur bruit) ;
     ondes.png         planche des formes d'onde ;
     apercu-orage.wav  40 s d'écoute : la pluie et trois tonnerres mêlés par la chaîne du jeu, jusqu'à son bus (volume
                       général 0,8, compresseur), hors ligne (OfflineAudioContext). */
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const ICI = __dirname, REPO = path.join(ICI, '..', '..', '..');
const { chromium } = require(path.join(REPO, 'launcher', 'node_modules', 'playwright-core'));
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const SRC = path.join(ICI, 'kit', 'sources');
const SORTIE = path.join(ICI, '..', 'ressources', 'marecages', 'sons');
const PAGE = path.join(ICI, 'sortie', 'sons');

// empreintes : les fichiers copiés par preparer.sh, puis les trois blocs exécutés. ma18_orage.js du kit mis à jour le
// 31 octobre à 23 h 10 (l'éclair rouge des Stryges : maFlashRed, teinte du canal) : fichier changé, blocs du son
// identiques octet pour octet (contrôlé le 1er novembre ; avant : 7e49015eda40e081…)
const FICHIERS = {
  'ma17_pluie.js': 'de371d7332dd41c9647ba5f96cb623f54142e549eb3c20672e72f410ca86783c',
  'ma18_orage.js': '03a937fbc613b854631f60fde99d2b2660130b69cf467b640296373ebf86fd0d',
};
const BLOCS = {
  pluie: 'd51d8438179124a305ae9774efe2b697587f7c25ba31fc585bbd1b52e968e325',
  eclair: '6ba984d3deab801b63d256d3382e75ec2b147eea66cd5d3df43b7984f8cb4975',
  tonnerre: 'b27ccbb8e7332f7a7c11047e29df23f539f6832596b40415b3c63aa95d84815c',
};

const CFG = {
  fs: 48000,
  grainePluie: +val('--graine', 1),
  oreille: 2.1,                           // m au-dessus de l'eau : les planches du ponton (0,5 m) + 1,6 m (maThunderJob)
  marge: 2400,                            // échantillons (50 ms) de part et d'autre des nappes, pour la boucle en Opus
  debitPluie: 160000, debitTonnerre: 96000, debitReverb: 128000,
  // les nappes du jeu (MA_WX_LAYERS) et leur force dans le mélange (MA_WXA_K)
  nappes: [['water', 'eau', 0.9], ['wood', 'bois', 1.0], ['mud', 'boue', 0.8], ['leaves', 'feuillage', 0.55], ['wash', 'lointain', 0.75], ['roof', 'toit', 1.1]],
  // tonnerres : distances du jeu pour un auditeur à terre (maStrikePick : de 40 à 450 m sur la carte, sinon autour
  // de la cellule, de 1,8 à 4,2 km ; maFlashCloud : autour de la cellule). Pas d'éclair « tout près » (3 à 28 m,
  // seulement en partie) : un launcher ne doit pas assourdir.
  tonnerres: [
    { id: 'sol-450', type: 'sol', distance: 450, azimut: 35, graine: 4501 },
    { id: 'sol-900', type: 'sol', distance: 900, azimut: -60, graine: 9001 },
    { id: 'sol-1700', type: 'sol', distance: 1700, azimut: 110, graine: 17001 },
    { id: 'sol-3000', type: 'sol', distance: 3000, azimut: -150, graine: 30001 },
    { id: 'nuages-2000', type: 'nuages', distance: 2000, azimut: 70, graine: 20001 },
    { id: 'nuages-3500', type: 'nuages', distance: 3500, azimut: -20, graine: 35001 },
  ],
  // l'aperçu : la pluie vue du ponton (dehors, l'eau tout autour, les planches, quelques arbres) pendant un moment
  // fort, et trois tonnerres
  apercu: { duree: 40, I: 0.8, autour: { water: 0.7, wood: 0.3, mud: 0, leaves: 0.15 }, interieur: 0,
    tonnerres: [{ id: 'sol-900', eclair: 1.5, pan: -0.35 }, { id: 'nuages-3500', eclair: 13, pan: 0.3 }, { id: 'sol-450', eclair: 24, pan: 0.45 }] },
};

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function blocs() {
  const lire = (f) => {
    const p = path.join(SRC, f);
    if (!fs.existsSync(p)) throw new Error(`${p} absent : lancer d'abord bash maquettes/launcher/scene-bete/preparer.sh`);
    const b = fs.readFileSync(p), h = sha(b);
    if (h !== FICHIERS[f]) throw new Error(`${f} : empreinte ${h.slice(0, 16)}… au lieu de ${FICHIERS[f].slice(0, 16)}… (le kit a changé : revoir l'analyse avant d'exécuter)`);
    return b.toString('utf8');
  };
  const p = lire('ma17_pluie.js'), o = lire('ma18_orage.js');
  const coupe = (t, a, b) => { if (a < 0 || b <= a) throw new Error('bloc introuvable'); return t.slice(a, b); };
  const B = {
    pluie: coupe(p, p.indexOf('function maWxRand(seed)'), p.indexOf('\n', p.indexOf('function maWxGenAll(')) + 1),
    eclair: coupe(o, o.indexOf('function maBoltPath('), o.indexOf('const maOrEye')),
    tonnerre: coupe(o, o.indexOf('function maThunderChannel('), o.lastIndexOf('/*', o.indexOf('function maThunderJob('))),
  };
  for (const k in B) if (sha(B[k]) !== BLOCS[k]) throw new Error(`bloc ${k} : empreinte inattendue (le kit a changé : revoir l'analyse avant d'exécuter)`);
  return B;
}

/* ---------------------------------------------------------------- Dans la page (notre code) ---------------- */
function PILOTE() {
  /* global maWxRand, maWxGenAll, maBoltPath, maThunderChannel, maThunderGen, maThunderIR */
  const SONS = {};
  window.__sons = SONS;
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const crete = (c) => { let m = 0; for (const x of c) for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v; } return m; };
  const rms = (c) => { let s = 0, n = 0; for (const x of c) for (let i = 0; i < x.length; i++) { s += x[i] * x[i]; n++; } return Math.sqrt(s / Math.max(1, n)); };

  // Ogg (RFC 3533) et Opus dans Ogg (RFC 7845) : en-tête du codeur (OpusHead), étiquettes, pages de 50 paquets au plus
  const TABLE = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; t[i] = r >>> 0; } return t; })();
  const crc = (b) => { let c = 0; for (let i = 0; i < b.length; i++) c = ((c << 8) ^ TABLE[((c >>> 24) ^ b[i]) & 255]) >>> 0; return c; };
  function pageOgg(paquets, granule, seq, drapeau) {
    const seg = [];
    for (const p of paquets) { let l = p.length; while (l >= 255) { seg.push(255); l -= 255; } seg.push(l); }
    const corps = paquets.reduce((s, p) => s + p.length, 0), h = new Uint8Array(27 + seg.length + corps), v = new DataView(h.buffer);
    h.set([79, 103, 103, 83]); h[5] = drapeau;
    v.setUint32(6, granule % 4294967296, true); v.setUint32(10, Math.floor(granule / 4294967296), true);
    v.setUint32(14, 0x5a534d56, true); v.setUint32(18, seq, true);
    h[26] = seg.length; h.set(seg, 27);
    let o = 27 + seg.length;
    for (const p of paquets) { h.set(p, o); o += p.length; }
    v.setUint32(22, crc(h), true);
    return h;
  }
  function ogg(tete, paquets, echantillons) {
    const preskip = tete[10] | (tete[11] << 8), pages = [pageOgg([tete], 0, 0, 2)];
    const vendeur = new TextEncoder().encode('Zombie Survival : sons du kit 2.0.7, WebCodecs');
    const tags = new Uint8Array(8 + 4 + vendeur.length + 4), tv = new DataView(tags.buffer);
    tags.set(new TextEncoder().encode('OpusTags')); tv.setUint32(8, vendeur.length, true); tags.set(vendeur, 12);
    pages.push(pageOgg([tags], 0, 1, 0));
    let g = 0;
    for (let i = 0, seq = 2; i < paquets.length; i += 50, seq++) {
      const lot = paquets.slice(i, i + 50), fin = i + 50 >= paquets.length;
      for (const p of lot) g += p.n;
      pages.push(pageOgg(lot.map((p) => p.d), fin ? preskip + echantillons : g, seq, fin ? 4 : 0));
    }
    const n = pages.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n);
    let o = 0;
    for (const p of pages) { out.set(p, o); o += p.length; }
    return { octets: out, preskip };
  }
  async function opus(canaux, debit, marge) {
    const n = canaux[0].length, nc = canaux.length, m = marge || 0, N = n + 2 * m, fs = 48000;
    // [la fin de la boucle (m) | le son | le début de la boucle (m)]
    const sig = canaux.map((c) => { if (!m) return c; const d = new Float32Array(N); d.set(c.subarray(n - m), 0); d.set(c, m); d.set(c.subarray(0, m), m + n); return d; });
    const paquets = []; let tete = null, err = null;
    const enc = new AudioEncoder({
      output: (ch, md) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); paquets.push({ d, n: Math.round(ch.duration * fs / 1e6) }); if (md && md.decoderConfig && md.decoderConfig.description) { const x = md.decoderConfig.description; tete = new Uint8Array(x.buffer ? x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength) : x); } },
      error: (e) => { err = e; },
    });
    enc.configure({ codec: 'opus', sampleRate: fs, numberOfChannels: nc, bitrate: debit });
    for (let i = 0; i < N; i += fs) {
      const k = Math.min(fs, N - i), part = new Float32Array(k * nc);
      for (let c = 0; c < nc; c++) part.set(sig[c].subarray(i, i + k), c * k);
      enc.encode(new AudioData({ format: 'f32-planar', sampleRate: fs, numberOfFrames: k, numberOfChannels: nc, timestamp: Math.round(i / fs * 1e6), data: part }));
    }
    await enc.flush(); enc.close();
    if (err) throw err;
    if (!tete || tete.length < 19 || String.fromCharCode(...tete.subarray(0, 8)) !== 'OpusHead') throw new Error('en-tête Opus absent');
    const r = ogg(tete, paquets, N);
    return { octets: r.octets, preskip: r.preskip, sig, N };
  }
  // contrôle : le .ogg décodé par le navigateur (comme le fera le launcher), comparé au signal codé
  async function controle(octets, sig) {
    const oc = new OfflineAudioContext(sig.length, 1, 48000);
    const buf = await oc.decodeAudioData(octets.slice().buffer);
    const d = buf.getChannelData(0), s = sig[0], N = s.length, w = Math.min(8192, N >> 2);
    // la fenêtre de recherche du décalage : le passage le plus fort (la queue d'une réverbération est trop faible)
    let at = 0, emax = -1;
    for (let i = 1200; i + w + 1200 < N; i += w >> 1) { let e = 0; for (let j = i; j < i + w; j += 4) e += s[j] * s[j]; if (e > emax) { emax = e; at = i; } }
    // décalage : sur la dérivée (les aigus donnent un pic net ; sur un tonnerre, grave, l'erreur seule hésite de
    // quelques échantillons)
    const dv = (a, j) => (j > 0 && j < a.length ? a[j] - a[j - 1] : 0);
    let best = 0, be = Infinity;
    for (let off = -1200; off <= 1200; off++) {
      let e = 0;
      for (let i = 0; i < w; i += 2) { const x = dv(d, at + i + off), y = dv(s, at + i); e += (x - y) * (x - y); }
      if (e < be) { be = e; best = off; }
    }
    let ps = 0, pe = 0;
    for (let c = 0; c < sig.length; c++) {
      const dc = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)), sc = sig[c];
      for (let i = 0; i < N; i++) { const j = i + best; if (j < 0 || j >= dc.length) continue; ps += sc[i] * sc[i]; pe += (dc[j] - sc[i]) * (dc[j] - sc[i]); }
    }
    // ce qui compte pour l'oreille (un codeur perceptif ne garde pas la forme d'onde d'un bruit) : l'énergie par
    // tiers d'octave (de 40 Hz à 20 kHz, bandes à moins de 50 dB de la plus forte) et l'enveloppe par blocs de 5 ms
    // (les impacts)
    const dc0 = buf.getChannelData(0), K = 4096, fen = new Float32Array(K).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / K));
    const spectre = (a, o) => {
      const P = new Float64Array(K / 2);
      for (let i0 = 0; i0 + K <= N; i0 += K / 2) {
        const re = new Float64Array(K), im = new Float64Array(K);
        for (let i = 0; i < K; i++) { const j = i0 + i + o; re[i] = (j >= 0 && j < a.length ? a[j] : 0) * fen[i]; }
        fft(re, im);
        for (let k = 0; k < K / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k];
      }
      return P;
    };
    const Ps = spectre(s, 0), Pd = spectre(dc0, best), bandes = [];
    for (let f = 40; f < 20000; f *= Math.pow(2, 1 / 3)) {
      const k0 = Math.max(1, Math.floor(f / Math.pow(2, 1 / 6) / 48000 * K)), k1 = Math.min(K / 2, Math.ceil(f * Math.pow(2, 1 / 6) / 48000 * K));
      let es = 0, ed = 0;
      for (let k = k0; k < k1; k++) { es += Ps[k]; ed += Pd[k]; }
      bandes.push([Math.round(f), es, ed]);
    }
    const emaxB = Math.max(...bandes.map((b) => b[1])), ecarts = bandes.filter((b) => b[1] > emaxB * 1e-5).map((b) => [b[0], 10 * Math.log10(Math.max(1e-30, b[2]) / b[1])]);
    const pire = ecarts.reduce((m, b) => (Math.abs(b[1]) > Math.abs(m[1]) ? b : m), [0, 0]);
    const B5 = 240, nb = Math.floor(N / B5), es = new Float64Array(nb), ed = new Float64Array(nb);
    for (let k = 0; k < nb; k++) { let a = 0, b = 0; for (let i = k * B5; i < (k + 1) * B5; i++) { const j = i + best; a += s[i] * s[i]; b += j >= 0 && j < dc0.length ? dc0[j] * dc0[j] : 0; } es[k] = Math.sqrt(a / B5); ed[k] = Math.sqrt(b / B5); }
    let ma = 0, mb = 0; for (let k = 0; k < nb; k++) { ma += es[k]; mb += ed[k]; } ma /= nb; mb /= nb;
    let sab = 0, saa = 0, sbb = 0; for (let k = 0; k < nb; k++) { sab += (es[k] - ma) * (ed[k] - mb); saa += (es[k] - ma) ** 2; sbb += (ed[k] - mb) ** 2; }
    return { longueur: buf.length, attendu: N, canaux: buf.numberOfChannels, decalage: best, rsb: +(10 * Math.log10(ps / Math.max(1e-20, pe))).toFixed(1),
      bandesEcartMoyen_dB: +(ecarts.reduce((s2, b) => s2 + Math.abs(b[1]), 0) / ecarts.length).toFixed(2), bandesPire: [pire[0], +pire[1].toFixed(2)],
      enveloppe: +(sab / Math.sqrt(saa * sbb)).toFixed(4) };
  }
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  async function poser(id, canaux, o) {
    const c0 = crete(canaux), ech = c0 > 0.999 ? c0 / 0.98 : 1;       // sous ±1 pour le 16 bits et l'Opus ; echelle pour revenir au jeu
    const norm = ech === 1 ? canaux : canaux.map((c) => c.map((x) => x / ech));
    const E = await opus(norm, o.debit, o.marge);
    const ctl = await controle(E.octets, E.sig);
    const n = canaux[0].length, nc = canaux.length, pcm = new Int16Array(n * nc);
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const v = Math.max(-1, Math.min(1, norm[c][i])); pcm[i * nc + c] = Math.round(v * 32767); }
    SONS[id] = { canaux, wav: new Uint8Array(pcm.buffer), ogg: E.octets,
      meta: Object.assign({ canaux: nc, echantillons: n, duree: +(n / 48000).toFixed(3), echelle: +ech.toFixed(6), crete: +c0.toFixed(4), rms: +rms(canaux).toFixed(5),
        oggOctets: E.octets.length, debit: o.debit, preskip: E.preskip, controle: ctl }, o.marge ? { boucle: { debut: o.marge, longueur: n } } : {}, o.meta || {}) };
  }

  window.exporter = async (cfg) => {
    const t0 = performance.now(), ms = {};
    const random = Math.random;
    // 1. la pluie : les six nappes du jeu (maWxGenAll), telles quelles
    const J = maWxGenAll(cfg.fs, cfg.grainePluie);
    ms.pluie = Math.round(performance.now() - t0);
    for (const [k, fr, kj] of cfg.nappes) await poser('pluie-' + fr, J[k], { debit: cfg.debitPluie, marge: cfg.marge, meta: { nappe: k, kJeu: kj } });
    // 2. la réverbération de l'orage (maOrIR : maThunderIR(fs, maWxRand(77)), commune à tous les tonnerres)
    await poser('orage-reverberation', maThunderIR(cfg.fs, maWxRand(77)), { debit: cfg.debitReverb, meta: { note: 'ConvolverNode, normalize par défaut (vrai) : la force absolue des échantillons ne compte pas' } });
    // 3. les tonnerres : le canal comme le jeu le trace, le son vu de l'auditeur sur le ponton
    const t1 = performance.now();
    for (const T of cfg.tonnerres) {
      const R = maWxRand(T.graine), rand = (a, b) => a + (b - a) * R();
      Math.random = R;                                                 // maBoltPath tire avec Math.random
      const L = { x: 0, y: cfg.oreille, z: 0 }, a = T.azimut * Math.PI / 180, x = Math.cos(a) * T.distance, z = Math.sin(a) * T.distance;
      let P, o;
      if (T.type === 'sol') {
        // maBoltGround : le canal principal, de la base des nuages (380-650 m) au point d'impact ; maStrikePlan : retourné
        // (du sol vers le nuage), c'est le bas du canal du tonnerre
        const H = rand(380, 650), b = rand(0, 2 * Math.PI), off = rand(0.05, 0.35) * H;
        const main = maBoltPath(x + Math.cos(b) * off, H, z + Math.sin(b) * off, x, 0, z, 0.32, 0.45, 0.3, L);
        const low = [];
        for (let i = main.length - 3; i >= 0; i -= 3) low.push(main[i], main[i + 1], main[i + 2]);
        o = { ground: true, low, Hc: rand(1300, 2600), slant: 400, branches: 2 + ((R() * 3) | 0), cloudLen: rand(2000, 5000) };
      } else {
        // maFlashCloud : un éclair dans les nuages, de 1 400 à 3 800 m de haut
        const h = rand(1400, 3800);
        o = { ground: false, Hc: h - 500, branches: 2 + ((R() * 3) | 0), cloudLen: rand(2500, 6000) };
      }
      P = maThunderChannel(x, 0, z, o, R);
      const it = maThunderGen(P, L.x, L.y, L.z, cfg.fs, R);
      let r;
      do r = it.next(); while (!r.done);
      Math.random = random;
      const res = r.value, buf = res.buf.slice();                     // (le tampon du jeu est partagé : copie)
      // la chaîne du jeu (maThunderStart) : force selon la distance, médium, envoi vers la réverbération
      const d = T.distance, niveau = (d < 60 ? 0.25 : 0.2) / (1 + Math.pow(d / 900, 1.2));
      await poser('tonnerre-' + T.id, [buf], { debit: cfg.debitTonnerre, meta: { type: T.type, distance: d, azimut: T.azimut, graine: T.graine,
        t0: +res.t0.toFixed(3), crete_jeu: res.peak, ondes: res.n, canal: { points: P.reduce((s, p) => s + p.length / 3, 0), branches: o.branches, Hc: Math.round(o.Hc), cloudLen: Math.round(o.cloudLen) },
        niveauJeu: +niveau.toFixed(5), medium_dB: d < 500 ? 4 : 1.5, envoiReverb: d < 150 ? 0.45 : 0.8 } });
    }
    ms.tonnerres = Math.round(performance.now() - t1);
    // 4. l'aperçu : la chaîne du jeu, hors ligne
    const A = cfg.apercu, fs = cfg.fs, oc = new OfflineAudioContext(2, A.duree * fs, fs);
    const mk = (c) => { const b = oc.createBuffer(c.length, c[0].length, fs); c.forEach((x, i) => b.copyToChannel(x, i)); return b; };
    // le bus du jeu (Sound.init) : volume général (0,8 par défaut, SETTINGS_DEFAULT.master), compresseur
    const comp = oc.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.22;
    comp.connect(oc.destination);
    const bus = oc.createGain(); bus.gain.value = 0.8; bus.connect(comp);
    // la pluie (maWxAudioStart, maWxAudioUpdate) : nappe → gain → passe-bas (dedans) → force (MA_WXC.vol) → passe-haut 40 Hz
    const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40; hp.Q.value = 0.7; hp.connect(bus);
    const out = oc.createGain(); out.gain.value = 0.55; out.connect(hp);
    const outF = oc.createBiquadFilter(); outF.type = 'lowpass'; outF.frequency.value = 20000 + (950 - 20000) * A.interieur; outF.Q.value = 0.5; outF.connect(out);
    const I = A.I, S = A.autour, ins = A.interieur;
    const force = { water: I * (0.12 + 0.88 * S.water), wood: I * S.wood, mud: I * S.mud, leaves: I * S.leaves, wash: Math.pow(I, 0.9) * (1 - 0.35 * ins), roof: I * ins };
    const RA = maWxRand(5);
    for (const [k, fr, kj] of cfg.nappes) {
      if (!(force[k] > 0)) continue;
      const s = oc.createBufferSource(); s.buffer = mk(SONS['pluie-' + fr].canaux); s.loop = true;
      const g = oc.createGain(); g.gain.value = force[k] * kj;
      s.connect(g); g.connect(k === 'roof' ? out : outF); s.start(0, RA() * s.buffer.duration);
    }
    // l'orage (maOrBus, maThunderStart) : réverbération commune (0,55), médium, force, côté
    const tout = oc.createGain(); tout.connect(bus);
    const verb = oc.createConvolver(); verb.buffer = mk(SONS['orage-reverberation'].canaux);
    const wet = oc.createGain(); wet.gain.value = 0.55; verb.connect(wet); wet.connect(tout);
    for (const t of A.tonnerres) {
      const T = SONS['tonnerre-' + t.id], M = T.meta, s = oc.createBufferSource(); s.buffer = mk(T.canaux);
      const e1 = oc.createBiquadFilter(); e1.type = 'peaking'; e1.frequency.value = 200; e1.Q.value = 0.8; e1.gain.value = 5;
      const e2 = oc.createBiquadFilter(); e2.type = 'peaking'; e2.frequency.value = 1000; e2.Q.value = 0.9; e2.gain.value = M.medium_dB;
      const g = oc.createGain(); g.gain.value = M.niveauJeu;
      const p = oc.createStereoPanner(); p.pan.value = t.pan;
      s.connect(e1); e1.connect(e2); e2.connect(g); g.connect(p); p.connect(tout);
      const sw = oc.createGain(); sw.gain.value = M.envoiReverb; g.connect(sw); sw.connect(verb);
      s.start(t.eclair + M.t0);
    }
    const mix = await oc.startRendering(), mc = [mix.getChannelData(0), mix.getChannelData(1)], mcr = crete(mc);
    const n = mix.length, pcm = new Int16Array(n * 2), k = mcr > 0.98 ? 0.98 / mcr : 1;
    for (let i = 0; i < n; i++) { pcm[i * 2] = Math.round(Math.max(-1, Math.min(1, mc[0][i] * k)) * 32767); pcm[i * 2 + 1] = Math.round(Math.max(-1, Math.min(1, mc[1][i] * k)) * 32767); }
    SONS.apercu = { canaux: mc, wav: new Uint8Array(pcm.buffer), meta: { canaux: 2, echantillons: n, duree: A.duree, crete: +mcr.toFixed(4), rms: +rms(mc).toFixed(5), ramene: +k.toFixed(4), forces: force, tonnerres: A.tonnerres } };
    ms.total = Math.round(performance.now() - t0);
    const liste = {};
    for (const id in SONS) liste[id] = SONS[id].meta;
    return { ms, sons: liste };
  };
  window.sortie = (id) => ({ wav: b64(SONS[id].wav), ogg: SONS[id].ogg ? b64(SONS[id].ogg) : null });
  // planche des formes d'onde (min, max par colonne ; la moyenne quadratique en clair)
  window.planche = (ids) => {
    const W = 1400, H = 74, pad = 8, cv = document.createElement('canvas');
    cv.width = W; cv.height = ids.length * H + 34;
    const x = cv.getContext('2d');
    x.fillStyle = '#0e1210'; x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = '#c9d2c4'; x.font = '15px sans-serif';
    x.fillText('Marécages maudits · sons calculés du kit 2.0.7 (une ligne par son, échelle propre à chaque ligne)', pad, 22);
    ids.forEach((id, r) => {
      const S = SONS[id], c = S.canaux, n = c[0].length, y0 = 34 + r * H, mid = y0 + H / 2, w = W - 290, amp = (H / 2 - 6) / Math.max(1e-6, S.meta.crete);
      x.fillStyle = r % 2 ? '#141a17' : '#111613'; x.fillRect(0, y0, W, H);
      x.fillStyle = '#c9d2c4'; x.font = '13px sans-serif'; x.fillText(id, pad, y0 + 20);
      x.fillStyle = '#8a968a'; x.font = '12px sans-serif';
      x.fillText(`${S.meta.duree.toFixed(2)} s · ${c.length === 2 ? 'stéréo' : 'mono'}`, pad, y0 + 38);
      x.fillText(`crête ${S.meta.crete} · rms ${S.meta.rms}`, pad, y0 + 54);
      for (let px = 0; px < w; px++) {
        const i0 = Math.floor(px / w * n), i1 = Math.max(i0 + 1, Math.floor((px + 1) / w * n));
        let lo = 0, hi = 0, s = 0;
        for (let i = i0; i < i1; i++) { const v = c[0][i]; if (v < lo) lo = v; if (v > hi) hi = v; s += v * v; }
        const q = Math.sqrt(s / (i1 - i0));
        x.fillStyle = '#4f7a62'; x.fillRect(280 + px, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
        x.fillStyle = '#9fd0b0'; x.fillRect(280 + px, mid - q * amp, 1, Math.max(1, 2 * q * amp));
      }
    });
    return cv.toDataURL('image/png').split(',')[1];
  };
}

/* ---------------------------------------------------------------- Fichiers ----------------------------------- */
function wav(pcm, nc, fs) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(nc, 22); h.writeUInt32LE(fs, 24);
  h.writeUInt32LE(fs * nc * 2, 28); h.writeUInt16LE(nc * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function chromiumPath() {
  if (process.env.ZS_CHROMIUM) return process.env.ZS_CHROMIUM;
  const pw = path.join(os.homedir(), '.cache', 'ms-playwright');
  try {
    for (const d of fs.readdirSync(pw).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      const p = path.join(pw, d, 'chrome-linux', 'headless_shell');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* pas de cache Playwright */ }
  return '/opt/pw-browsers/chromium';
}

(async () => {
  const t0 = Date.now();
  const B = blocs();
  console.log('sources conformes ; blocs : pluie ' + B.pluie.length + ' o, éclair ' + B.eclair.length + ' o, tonnerre ' + B.tonnerre.length + ' o');
  fs.mkdirSync(PAGE, { recursive: true });
  fs.mkdirSync(path.join(SORTIE, 'maitres'), { recursive: true });
  // une page locale (file://) : WebCodecs demande un contexte sûr ; aucune ressource extérieure
  const page0 = path.join(PAGE, 'page.html');
  fs.writeFileSync(page0, '<!doctype html><meta charset="utf-8"><title>Sons du kit 2.0.7</title>\n');
  delete process.env.DISPLAY; delete process.env.WAYLAND_DISPLAY;
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--disable-gpu'] });
  try {
    const ctx = await browser.newContext();
    await ctx.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.text()); });
    await page.goto('file://' + page0);
    // les blocs du kit, tels quels ; MA_OR : le seul objet du jeu que lit le bloc du tonnerre (son tampon partagé)
    await page.addScriptTag({ content: 'const MA_OR = {};\n' + B.pluie + '\n' + B.eclair + '\n' + B.tonnerre });
    await page.addScriptTag({ content: '(' + PILOTE.toString() + ')();' });
    const res = await page.evaluate((cfg) => window.exporter(cfg), CFG);
    if (erreurs.length) console.log('messages de la page :', erreurs.slice(0, 5));
    console.log(`calcul : pluie ${res.ms.pluie} ms, tonnerres ${res.ms.tonnerres} ms, en tout ${res.ms.total} ms`);
    const ids = Object.keys(res.sons);
    for (const id of ids) {
      const M = res.sons[id], o = await page.evaluate((k) => window.sortie(k), id);
      const nom = id === 'apercu' ? 'apercu-orage' : id;
      fs.writeFileSync(id === 'apercu' ? path.join(SORTIE, nom + '.wav') : path.join(SORTIE, 'maitres', nom + '.wav'), wav(Buffer.from(o.wav, 'base64'), M.canaux, CFG.fs));
      if (o.ogg) fs.writeFileSync(path.join(SORTIE, nom + '.ogg'), Buffer.from(o.ogg, 'base64'));
      M.fichier = o.ogg ? nom + '.ogg' : null;
      M.maitre = id === 'apercu' ? nom + '.wav' : 'maitres/' + nom + '.wav';
      const c = M.controle;
      console.log(`${nom.padEnd(22)} ${M.duree.toFixed(2).padStart(6)} s  crête ${String(M.crete).padEnd(6)} rms ${String(M.rms).padEnd(7)}` +
        (c ? `  ogg ${(M.oggOctets / 1024).toFixed(0).padStart(4)} Ko, décodé ${c.longueur}/${c.attendu}, décalage ${c.decalage}, bandes ±${c.bandesEcartMoyen_dB} dB (pire ${c.bandesPire[1]} à ${c.bandesPire[0]} Hz), enveloppe ${c.enveloppe}` : '') +
        (M.t0 !== undefined ? `  t0 ${M.t0} s` : ''));
    }
    const png = await page.evaluate((l) => window.planche(l), ids);
    fs.writeFileSync(path.join(SORTIE, 'ondes.png'), Buffer.from(png, 'base64'));
    const doc = {
      genere: new Date().toISOString(),
      autorisation: 'Anthony, 31 octobre 2026 : « j’autorise l’export des sons du kit »',
      statut: 'carte non publiée : fichiers hors de Git, aucune publication sans l’accord explicite d’Anthony',
      source: { kit: 'Zombie Survival 2.0.7 - a publier (Stryges)', fichiers: FICHIERS, blocs: BLOCS },
      fs: CFG.fs, grainePluie: CFG.grainePluie, oreille_m: CFG.oreille,
      melange: {
        pluie: 'nappe (boucle, départ au hasard) → gain kJeu × force → passe-bas (20 kHz dehors, 950 Hz dedans ; pas le toit) → MA_WXC.vol 0,55 → passe-haut 40 Hz (Q 0,7)',
        forces: 'water : I × (0,12 + 0,88 × part d’eau) ; wood : I × part de bois ; mud : I × part de boue ; leaves : I × arbres proches ; wash : I^0,9 × (1 − 0,35 × dedans) ; roof : I × dedans (I : intensité, de 0,3 à 1 pendant une averse)',
        tonnerre: 'tampon (× echelle) → crête 200 Hz (Q 0,8, +5 dB) → crête 1 kHz (Q 0,9, medium_dB) → gain niveauJeu → côté (StereoPanner, ±0,7 au plus) → sortie ; après le gain : envoiReverb → réverbération (ConvolverNode, orage-reverberation) → 0,55 → sortie',
        depart: 'le tonnerre part à l’instant de l’éclair + t0 (arrivée du premier front, distance ÷ 343 m/s)',
        bus: 'pluie et tonnerre → bus des effets → passe-bas (20 kHz) → volume général (0,8 par défaut, SETTINGS_DEFAULT.master) → compresseur (seuil −16 dB, genou 10 dB, rapport 5, attaque 3 ms, relâche 0,22 s) → sortie',
      },
      sons: res.sons,
      duree_s: Math.round((Date.now() - t0) / 1000),
    };
    fs.writeFileSync(path.join(SORTIE, 'sons.json'), JSON.stringify(doc, null, 1) + '\n');
    console.log(`fini en ${doc.duree_s} s → ${path.relative(process.cwd(), SORTIE)}/`);
  } finally { await browser.close(); }
})().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
