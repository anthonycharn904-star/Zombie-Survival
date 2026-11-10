// Contrôle anti-salut (exécuté dans la page d'aperçu) : rejoue chaque action et locomotion à 30 i/s et relève, pour
// chaque bras, la direction épaule → poignet (repère du boss, sans le lacet), l'extension du bras et l'orientation
// de la paume. Signale : bras tendu (≥ 85 % de sa longueur) vers l'avant (z ≥ 0,55) au-dessus de l'horizontale
// (y > −0,05) ET paume vers le bas (normale · bas ≥ 0,5) → « salut » ; sans la condition de paume → « à revoir ».
(() => {
  const SC = window.APERCU_SCENARIOS, m = window.modele, B = m.os, obj = m.object;
  const V = THREE.Vector3, Q = THREE.Quaternion;
  const s = new V(), w = new V(), p = new V(), q = new Q(), qo = new Q();
  const PAUME = { L: new V(-0.9397, -0.3420, 0), R: new V(0.9397, -0.3420, 0) };
  const LONG = (0.29 + 0.255) * (1.75 / 1.8);
  const out = { salut: [], aRevoir: [], max: {} };
  const vb = {};
  for (const nom of SC.noms) {
    m.reinitialiser();
    const T = SC.dureeTotale(nom);
    let pire = null;
    for (let t = 0; t <= T + 1e-6; t += 1 / 30) {
      const v = SC.vueAu(nom, t, vb); v.temps = t; v.regard = v.regard || {}; v.regard.x = 0; v.regard.y = 1.6; v.regard.z = 7;
      m.update(1 / 30, v);
      obj.getWorldQuaternion(qo); qo.invert();
      for (const S of ['L', 'R']) {
        B['arm' + S].getWorldPosition(s); B['hand' + S].getWorldPosition(w);
        w.sub(s).applyQuaternion(qo);
        const L = w.length(), d = w.clone().normalize();
        B['hand' + S].getWorldQuaternion(q); p.copy(PAUME[S]).applyQuaternion(q).applyQuaternion(qo);
        const bas = -p.y, ext = L / LONG;
        const etape = vb.action ? vb.action.etape : 'loco';
        const score = (d.z > 0.55 ? 1 : 0) + (d.y > -0.05 ? 1 : 0) + (ext > 0.85 ? 1 : 0);
        const rec = { nom: nom, t: +t.toFixed(2), etape: etape, bras: S === 'L' ? 'gauche' : 'droit', avant: +d.z.toFixed(2), haut: +d.y.toFixed(2), ext: +ext.toFixed(2), paumeBas: +bas.toFixed(2) };
        if (score === 3 && bas >= 0.5) out.salut.push(rec);
        else if (score === 3) out.aRevoir.push(rec);
        const k = d.z * 0.5 + Math.max(0, d.y + 0.05) + ext * 0.3 + Math.max(0, bas) * 0.5;
        if (!pire || k > pire.k) pire = Object.assign({ k: +k.toFixed(2) }, rec);
      }
    }
    out.max[nom] = pire;
  }
  // regroupe les plages contiguës
  const regrouper = (L) => { const r = []; for (const e of L) { const z = r[r.length - 1]; if (z && z.nom === e.nom && z.bras === e.bras && e.t - z.t1 < 0.07) { z.t1 = e.t; z.n++; } else r.push(Object.assign({ t0: e.t, t1: e.t, n: 1 }, e)); } return r; };
  return { salut: regrouper(out.salut), aRevoir: regrouper(out.aRevoir), max: out.max };
})()
