/* ---------------------------------------------------- Interface : ambiance --
   Couche d'atmosphère 2D du menu principal, par-dessus la vraie scène 3D de la carte (refonte de l'interface,
   décision 2 d'Anthony) : poussière en suspension dans les salles fermées, sable porté par le vent dans le
   désert, fine poussière en lévitation au ras du sol lunaire (la lueur d'horizon des régions rasées par le
   Soleil). Choisie par la base de la carte (IFC_AMBIANCE_BASES ; cartes à grille : poussière) ; une carte dont
   la scène porte déjà son atmosphère (les Marécages : pluie et brume en 3D) n'en a pas. Avec l'illustration en fond
   (réglage par défaut depuis le 3 novembre 2026), l'ambiance est celle de l'illustration (IFC_FOND.ambiance). Toile à demi-résolution,
   30 images par seconde au plus ; arrêtée hors du menu, dans les Mod Tools, fenêtre cachée et avec le fond
   allégé ; animations réduites : une image fixe. Aucun éclair, aucun clignotement (vertige d'Anthony). */
const IFC_AMBIANCE_BASES = { khamsin: 'sable', desert: 'sable', ombre: 'lune', lune: 'lune' };
const IFC_AMB = { toile: null, g: null, sorte: null, parts: [], raf: 0, der: 0, t: 0 };
/* Chaque sorte : nombre de particules, naissance (partout : à l'ouverture ; sinon au bord d'entrée), pas, dessin.
   Unités : pixels de la toile (la moitié des pixels de la fenêtre), secondes. */
const IFC_AMBIANCES = {
  poussiere: {
    n: 70,
    nait: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, r: 0.5 + Math.random() * 1.3, a: 0.05 + Math.random() * 0.18,
      vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 3 - 0.6, ph: Math.random() * TAU, f: 0.12 + Math.random() * 0.25 }),
    pas(p, dt, t, w, h) {
      p.x += (p.vx + Math.sin(p.ph + t * p.f) * 2.2) * dt;
      p.y += (p.vy + Math.cos(p.ph + t * p.f * 0.7) * 1.4) * dt;
      if (p.x < -4) p.x += w + 8; else if (p.x > w + 4) p.x -= w + 8;
      if (p.y < -4) p.y += h + 8; else if (p.y > h + 4) p.y -= h + 8;
    },
    dessin(g, p, t) {
      g.fillStyle = `rgba(255, 232, 196, ${(p.a * (0.65 + 0.35 * Math.sin(p.ph + t * p.f * 1.3))).toFixed(3)})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    },
  },
  sable: {
    n: 120,
    nait: (w, h, partout) => ({ x: partout ? Math.random() * w : -40 - Math.random() * 60, y: Math.random() * h, l: 6 + Math.random() * 22,
      a: 0.03 + Math.random() * 0.08, vx: 70 + Math.random() * 120, vy: 6 + Math.random() * 18 }),
    pas(p, dt, t, w, h) {
      const rafale = 0.78 + 0.16 * Math.sin(t * 0.33) + 0.06 * Math.sin(t * 1.1 + p.y * 0.01);   // vent qui varie lentement
      p.x += p.vx * rafale * dt;
      p.y += p.vy * rafale * dt;
      if (p.x > w + 40 || p.y > h + 20) Object.assign(p, IFC_AMBIANCES.sable.nait(w, h, false), { y: Math.random() * h });
    },
    dessin(g, p) {
      g.strokeStyle = `rgba(222, 184, 128, ${p.a.toFixed(3)})`;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.l, p.y - p.l * (p.vy / p.vx)); g.stroke();
    },
  },
  lune: {
    n: 45,
    nait: (w, h, partout) => ({ x: Math.random() * w, y: h * (partout ? 0.55 + Math.random() * 0.45 : 1.02), r: 0.4 + Math.random() * 0.9,
      a: 0.04 + Math.random() * 0.13, vx: (Math.random() - 0.5) * 3, vy: -(0.6 + Math.random() * 2.2) }),
    pas(p, dt, t, w, h) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < h * 0.5) Object.assign(p, IFC_AMBIANCES.lune.nait(w, h, false));
      if (p.x < -4) p.x += w + 8; else if (p.x > w + 4) p.x -= w + 8;
    },
    dessin(g, p, t, w, h) {
      const haut = clamp((p.y - h * 0.5) / (h * 0.18), 0, 1);   // s'efface en montant, sans scintiller
      g.fillStyle = `rgba(222, 228, 238, ${(p.a * haut).toFixed(3)})`;
      g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    },
  },
};
function ifcAmbianceMonter(menu) {
  const c = el('canvas', 'ifc-ambiance');
  c.setAttribute('aria-hidden', 'true');
  c.hidden = true;
  menu.prepend(c);
  IFC_AMB.toile = c;
  IFC_AMB.g = c.getContext('2d');
  // fenêtre redimensionnée : particules redistribuées (l'image fixe des animations réduites aussi)
  window.addEventListener('resize', () => { if (!c.hidden) { IFC_AMB.parts = []; ifcAmbiance(); } });
}
/* Sorte d'ambiance : celle de l'illustration quand elle est en fond, sinon celle de la carte de la scène. */
const ifcAmbianceSorte = (map) => (ifcIllustration() ? IFC_FOND.ambiance : !map ? null : !map.open ? 'poussiere' : IFC_AMBIANCE_BASES[map.base] || null);
/* À chaque changement d'écran, de réglage ou de visibilité de la fenêtre : montrer, figer ou arrêter. */
function ifcAmbiance() {
  const A = IFC_AMB;
  if (!A.toile) return;
  const sorte = ifcAmbianceSorte(CUR.map);
  const montre = IFC.pret && IFC.ecran === 'menu' && G.state === 'menu' && !window.zsModtools && !IFC.fixe && !!sorte;
  A.toile.hidden = !montre;
  if (!montre) { ifcAmbianceArret(); if (!sorte || IFC.fixe) A.parts = []; return; }
  const neuve = ifcAmbianceTaille();
  if (A.sorte !== sorte || !A.parts.length || neuve) {
    A.sorte = sorte;
    const S = IFC_AMBIANCES[sorte];
    A.parts = Array.from({ length: S.n }, () => S.nait(A.toile.width, A.toile.height, true));
  }
  if (IFC.calme || document.hidden) { ifcAmbianceArret(); ifcAmbianceDessin(0); return; }   // une image fixe
  if (!A.raf) { A.der = performance.now(); A.raf = requestAnimationFrame(ifcAmbianceImage); }
}
function ifcAmbianceArret() { cancelAnimationFrame(IFC_AMB.raf); IFC_AMB.raf = 0; }
/* Toile à la moitié des pixels de la fenêtre ; vrai si la taille a changé (les particules sont redistribuées). */
function ifcAmbianceTaille() {
  const c = IFC_AMB.toile, w = Math.max(1, Math.round(innerWidth / 2)), h = Math.max(1, Math.round(innerHeight / 2));
  if (c.width === w && c.height === h) return false;
  c.width = w; c.height = h;
  return true;
}
function ifcAmbianceImage(now) {
  const A = IFC_AMB;
  A.raf = 0;
  if (A.toile.hidden || IFC.ecran !== 'menu' || G.state !== 'menu' || IFC.calme || document.hidden) return;   // ifcAmbiance la relance
  A.raf = requestAnimationFrame(ifcAmbianceImage);
  const dt = (now - A.der) / 1000;
  if (dt < 1 / 30 - 0.002) return;                 // marge : à 60 Hz, deux images font 33,3 ms (sinon 20 i/s)
  A.der = now;
  if (ifcAmbianceTaille()) { A.parts = []; ifcAmbiance(); return; }   // nouvelle taille : particules redistribuées
  ifcAmbianceDessin(Math.min(dt, 0.1));
}
function ifcAmbianceDessin(dt) {
  const A = IFC_AMB, S = IFC_AMBIANCES[A.sorte], g = A.g, w = A.toile.width, h = A.toile.height;
  if (!S) return;
  A.t += dt;
  g.clearRect(0, 0, w, h);
  g.lineWidth = 0.8;
  for (const p of A.parts) {
    if (dt) S.pas(p, dt, A.t, w, h);
    S.dessin(g, p, A.t, w, h);
  }
}
