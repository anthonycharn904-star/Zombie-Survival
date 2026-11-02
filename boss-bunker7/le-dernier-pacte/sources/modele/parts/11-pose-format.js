  // ============================================================================================
  // Format des poses : un tableau de nombres à disposition fixe (fondus et interpolations triviaux).
  // Repère du buste (« chest ») pour les cibles des mains ; angles en radians.
  // Conventions des os (pose de référence = identité, repris de ../survivant/src/anim.js) :
  //  colonne / tête : x > 0 penche en avant, y > 0 tourne vers la gauche, z > 0 incline vers la droite ;
  //  jambes : cuisse x < 0 = flexion vers l'avant, genou > 0 = flexion, pied > 0 = pointe tendue.
  // ============================================================================================
  const CHAMPS = [
    ['h', 3], ['hr', 3], ['sp', 3], ['ch', 3], ['nk', 3], ['hd', 3],
    ['cG', 2], ['cD', 2],                       // clavicules : élévation, protraction
    ['mG', 3], ['mD', 3],                       // poignets (repère du buste)
    ['pG', 3], ['pD', 3],                       // pôles des coudes (direction, repère du buste)
    ['paG', 3], ['paD', 3],                     // direction voulue de la paume (repère du buste)
    ['fG', 2], ['fD', 2],                       // poignet : flexion (+ vers la paume), déviation (+ vers le pouce)
    ['dG', 7], ['dD', 7],                       // formes de main (poids) : detendue, ouverte, griffe, crochue, poing, index, tenir
    ['jG', 5], ['jD', 5],                       // jambes : cuisse x, abduction, genou, pointe, rotation
    ['mach', 1], ['lu', 1], ['rg', 1], ['vG', 1], ['vD', 1], ['ext', 1], ['tr', 1], ['au', 1], ['sol', 1], ['rs', 1],
    ['msG', 3], ['msD', 3],                     // main posée au sol : x, z (repère du corps), poids
    ['ail', 5],                                 // ailes : ouverture, amplitude des battements, fréquence, flèche, relèvement
    ['rp', 1], ['rr', 1],                       // rotation de tout le corps (tangage, roulis) autour du bassin
    ['cl', 1]                                   // clignement (paupières, module de tête)
  ];
  const OFF = {};
  let NPOSE = 0;
  for (const [k, n] of CHAMPS) { OFF[k] = NPOSE; NPOSE += n; }
  const MAINS = ['detendue', 'ouverte', 'griffe', 'crochue', 'poing', 'index', 'tenir'];
  // formes de main : par doigt [écartement (+ vers le pouce), flexion MCP, PIP, DIP] ; pouce [opposition, flexion CMC, MCP, IP]
  const FORMES = {
    detendue: { index: [0.06, 0.28, 0.38, 0.26], majeur: [0, 0.32, 0.46, 0.3], annulaire: [-0.05, 0.38, 0.5, 0.32], auriculaire: [-0.12, 0.44, 0.55, 0.34], pouce: [0.35, 0.12, 0.22, 0.18] },
    ouverte: { index: [0.22, 0.06, 0.12, 0.08], majeur: [0.05, 0.07, 0.12, 0.08], annulaire: [-0.12, 0.09, 0.14, 0.09], auriculaire: [-0.3, 0.12, 0.16, 0.1], pouce: [0.12, -0.15, 0.1, 0.08] },
    griffe: { index: [0.22, -0.12, 1.12, 0.92], majeur: [0.05, -0.1, 1.18, 0.98], annulaire: [-0.13, -0.08, 1.18, 0.98], auriculaire: [-0.3, -0.02, 1.12, 0.92], pouce: [0.55, 0.15, 0.55, 0.7] },
    crochue: { index: [0.1, 0.62, 1.0, 0.72], majeur: [0.02, 0.68, 1.05, 0.76], annulaire: [-0.07, 0.74, 1.1, 0.76], auriculaire: [-0.15, 0.8, 1.1, 0.74], pouce: [0.75, 0.35, 0.5, 0.5] },
    poing: { index: [0.0, 1.45, 1.6, 0.95], majeur: [0, 1.5, 1.62, 0.95], annulaire: [-0.02, 1.52, 1.62, 0.92], auriculaire: [-0.05, 1.52, 1.58, 0.88], pouce: [1.05, 0.55, 0.75, 0.62] },
    index: { index: [0.06, -0.02, 0.04, 0.03], majeur: [0, 1.42, 1.5, 0.9], annulaire: [-0.02, 1.5, 1.55, 0.9], auriculaire: [-0.05, 1.5, 1.5, 0.85], pouce: [0.85, 0.45, 0.6, 0.45] },
    tenir: { index: [0.04, 1.12, 1.28, 0.72], majeur: [0, 1.22, 1.32, 0.76], annulaire: [-0.02, 1.28, 1.36, 0.76], auriculaire: [-0.06, 1.32, 1.36, 0.72], pouce: [1.0, 0.42, 0.45, 0.35] }
  };

  // pose de base : lévitation au repos, raide et autoritaire (menton levé, poitrine sortie), mains en demi-griffes
  const POSE_BASE = {
    h: [0, 0, 0], hr: [0.03, 0, 0], sp: [-0.03, 0, 0], ch: [-0.07, 0, 0], nk: [0.03, 0, 0], hd: [-0.05, 0, 0],
    cG: [-0.03, -0.05], cD: [-0.03, -0.05],
    mG: [0.235, -0.36, 0.055], mD: [-0.235, -0.36, 0.055],
    pG: [0.55, -0.25, -0.8], pD: [-0.55, -0.25, -0.8],
    paG: [-0.85, 0.0, 0.45], paD: [0.85, 0.0, 0.45],
    fG: [0.12, 0.0], fD: [0.12, 0.0],
    dG: { detendue: 0.55, griffe: 0.45 }, dD: { detendue: 0.55, griffe: 0.45 },
    jG: [-0.1, 0.035, 0.24, 0.55, 0.06], jD: [-0.19, 0.02, 0.36, 0.5, 0.04],
    mach: 0, lu: 1, rg: 1, vG: 0, vD: 0, ext: 0.96, tr: 0, au: 1, sol: 0, rs: 1,
    msG: [0.3, 0.2, 0], msD: [-0.3, 0.2, 0],
    ail: [0.9, 0.18, 0.45, 0, 0], rp: 0, rr: 0, cl: 0
  };

  function versTableau(o, base) {
    const a = base ? Float32Array.from(base) : new Float32Array(NPOSE);
    for (const k in o) {
      if (!(k in OFF)) continue;
      const v = o[k], off = OFF[k];
      if (k === 'dG' || k === 'dD') {
        const w = typeof v === 'string' ? { [v]: 1 } : v;
        let tot = 0; for (const n in w) tot += w[n];
        for (let i = 0; i < MAINS.length; i++) a[off + i] = (w[MAINS[i]] || 0) / (tot || 1);
      } else if (typeof v === 'number') a[off] = v;
      else for (let i = 0; i < v.length; i++) if (v[i] != null) a[off + i] = v[i];
    }
    return a;
  }
  const BASE_T = versTableau(POSE_BASE);

  // miroir gauche ↔ droite d'une pose (pour main = 'gauche')
  function miroirPose(src, dst) {
    dst.set(src);
    const negX = (k) => { dst[OFF[k]] = -src[OFF[k]]; };
    for (const k of ['hr', 'sp', 'ch', 'nk', 'hd']) { dst[OFF[k] + 1] = -src[OFF[k] + 1]; dst[OFF[k] + 2] = -src[OFF[k] + 2]; }
    negX('h');
    const swap = (a, b, n, neg) => { for (let i = 0; i < n; i++) { const va = src[OFF[a] + i], vb = src[OFF[b] + i]; dst[OFF[a] + i] = neg && i === 0 ? -vb : vb; dst[OFF[b] + i] = neg && i === 0 ? -va : va; } };
    swap('cG', 'cD', 2); swap('mG', 'mD', 3, true); swap('pG', 'pD', 3, true); swap('paG', 'paD', 3, true); swap('fG', 'fD', 2);
    swap('dG', 'dD', 7); swap('jG', 'jD', 5); swap('vG', 'vD', 1); swap('msG', 'msD', 3, true);
    dst[OFF.rr] = -src[OFF.rr];
    return dst;
  }
  const ease = {
    s: (t) => t * t * (3 - 2 * t),
    i: (t) => t * t,
    o: (t) => 1 - (1 - t) * (1 - t),
    l: (t) => t,
    // élan : dépasse légèrement puis revient (retombée)
    b: (t) => { const s = 1.70158 * 0.8; t -= 1; return t * t * ((s + 1) * t + s) + 1; }
  };
