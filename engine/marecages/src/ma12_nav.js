
/* ------------------------------------------------------- Navigation de la bête --
   Kit MM 2.1.1 (« le monstre n'apparaît pas », Anthony, 26 octobre 2026). En MM 2.1.0, la bête se pilotait
   à vue : un regard de 10 à 25 m devant la tête, et le côté le plus profond quand ça remontait. Dès
   qu'une île ou un banc la séparait de sa cible (une barque au ponton sud du Bourg, à l'abri d'une
   île, au bord d'un haut-fond), elle tournait du mauvais côté et n'arrivait jamais (mesuré : à plus
   de 150 m pendant trois minutes, la menace au maximum).
   Ici, une grille de 4 m de l'eau (profondeur au centre de chaque case ; le lac, l'eau d'un seul
   tenant autour de La Fosse, sans le marais extérieur au-delà de la forêt) :
     maNavPath     plus court chemin (A*) par l'eau d'au moins `min` mètres ; l'eau profonde coûte
                   moins (elle longe les bancs quand elle peut faire autrement) ;
     maNavAim      où viser : tout droit si la voie est libre, sinon le point le plus loin du
                   chemin qu'elle voit d'ici (chemin refait quand la cible bouge de 8 m, ou 2,5 s) ;
     maNavRing     un point à une distance donnée de la cible par l'eau (et non à vol d'oiseau, de
                   l'autre côté d'une île) ;
     maNavNearest  la case assez profonde la plus proche d'un point (une barque à quai, un nageur
                   dans les hauts-fonds : elle vient au plus près).
   ================================================================================== */
const MA_NAV = { C: 4, x0: 0, z0: 0, nx: 0, nz: 0, dep: null, lake: null, cells: 0, gen: 0, g: null, from: null, stamp: null, closed: null, hk: null, hv: null, hn: 0, ms: 0, calls: 0, it: 0, lm: null, lmDeep: null };
const MA_NAV_D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function maNavInit() {
  const N = MA_NAV, C = N.C;
  N.x0 = OW.X0; N.z0 = OW.Z0;
  N.nx = Math.floor(((OW.NX - 1) * OW.STEP) / C); N.nz = Math.floor(((OW.NZ - 1) * OW.STEP) / C);
  const n = N.nx * N.nz;
  N.dep = new Float32Array(n); N.lake = new Uint8Array(n);
  for (let j = 0; j < N.nz; j++) for (let i = 0; i < N.nx; i++) N.dep[j * N.nx + i] = maDepth(N.x0 + (i + 0.5) * C, N.z0 + (j + 0.5) * C);
  // le lac : l'eau d'au moins 1,2 m reliée à La Fosse
  const q = new Int32Array(n), s = maNavCell(MA.fosse.x, MA.fosse.z);
  let h = 0, t = 0;
  if (N.dep[s] >= 1.2) { N.lake[s] = 1; q[t++] = s; }
  while (h < t) {
    const k = q[h++], i = k % N.nx, j = (k - i) / N.nx;
    for (let d = 0; d < 4; d++) {
      const a = i + MA_NAV_D[d][0], b = j + MA_NAV_D[d][1];
      if (a < 0 || b < 0 || a >= N.nx || b >= N.nz) continue;
      const m = b * N.nx + a;
      if (!N.lake[m] && N.dep[m] >= 1.2) { N.lake[m] = 1; q[t++] = m; }
    }
  }
  N.cells = t;
  N.g = new Float32Array(n); N.from = new Int32Array(n); N.stamp = new Uint32Array(n); N.closed = new Uint32Array(n);
  N.hk = new Float32Array(8192); N.hv = new Int32Array(8192); N.hn = 0; N.gen = 0;
  // repères : la distance par l'eau depuis 6 points du lac éloignés les uns des autres (le premier : le
  // plus loin de La Fosse, puis chaque fois le plus loin des précédents). |d(repère, bête) − d(repère,
  // case)| ne dépasse jamais la distance de la case à la bête par l'eau : l'A* sait d'avance qu'il faut
  // contourner l'île et ne fouille plus tout le côté qui fait face à la cible (jusqu'à 90 ms en MM 2.1.1
  // d'essai, quelques millisecondes ensuite)
  // Deux jeux : sur tout le lac (valables pour toute recherche), et sur l'eau de 3,2 m et plus (plus
  // justes pour ses trajets cachés, qui contournent aussi les bancs).
  const marks = (min) => {
    const out = [], far = maNavFlood(s, min);
    for (let l = 0; l < 6; l++) {
      let best = -1, bd = -1;
      for (let k = 0; k < n; k++) if (far[k] > bd && far[k] < Infinity) { bd = far[k]; best = k; }
      if (best < 0) break;
      const dl = maNavFlood(best, min), u = new Uint16Array(n);
      for (let k = 0; k < n; k++) { const v = dl[k]; u[k] = v === Infinity ? 65535 : Math.min(65534, Math.round(v * 4)); if (v < far[k]) far[k] = v; }
      out.push(u);
    }
    return out;
  };
  N.lm = marks(1.2); N.lmDeep = marks(3.2);
  // échauffement (pendant le chargement) : la première recherche, compilée à froid, coûtait ~30 ms
  const F = MA.fosse, I = MA.islands;
  for (let r = 0; r < 3; r++) for (const L of I) { maNavPath(F.x, F.z, L.x + L.r * 1.6, L.z, r ? 2.1 : 3.2); maNavRing(L.x, L.z + L.r * 1.6, 28, 55, 3.2); }
  N.calls = 0; N.ms = 0;
}
function maNavCell(x, z) {
  const N = MA_NAV;
  const i = Math.min(N.nx - 1, Math.max(0, Math.floor((x - N.x0) / N.C))), j = Math.min(N.nz - 1, Math.max(0, Math.floor((z - N.z0) / N.C)));
  return j * N.nx + i;
}
const maNavX = (k) => MA_NAV.x0 + ((k % MA_NAV.nx) + 0.5) * MA_NAV.C;
const maNavZ = (k) => MA_NAV.z0 + (Math.floor(k / MA_NAV.nx) + 0.5) * MA_NAV.C;
const maNavOk = (k, min) => MA_NAV.lake[k] === 1 && MA_NAV.dep[k] >= min;
/* Dans le lac de la bête (vrai si la grille n'existe pas : éditeur, carte sans bête) ? */
const maInLake = (x, z) => !MA_NAV.lake || MA_NAV.lake[maNavCell(x, z)] === 1;
/* Tas binaire (clé, case) sur des tableaux typés. */
function maNavPush(f, k) {
  const N = MA_NAV;
  if (N.hn >= N.hk.length) { const a = new Float32Array(N.hk.length * 2), b = new Int32Array(N.hk.length * 2); a.set(N.hk); b.set(N.hv); N.hk = a; N.hv = b; }
  let i = N.hn++;
  while (i > 0) { const p = (i - 1) >> 1; if (N.hk[p] <= f) break; N.hk[i] = N.hk[p]; N.hv[i] = N.hv[p]; i = p; }
  N.hk[i] = f; N.hv[i] = k;
}
function maNavPop() {
  const N = MA_NAV, top = N.hv[0], n = --N.hn;
  if (n > 0) {
    const f = N.hk[n], k = N.hv[n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && N.hk[c + 1] < N.hk[c]) c++;
      if (N.hk[c] >= f) break;
      N.hk[i] = N.hk[c]; N.hv[i] = N.hv[c]; i = c;
    }
    N.hk[i] = f; N.hv[i] = k;
  }
  return top;
}
/* Distance par l'eau du lac d'au moins `min` mètres (en cases, diagonales comprises) depuis une case :
   pour les repères. */
function maNavFlood(src, min) {
  const N = MA_NAV, nx = N.nx, nz = N.nz, n = nx * nz, dist = new Float32Array(n).fill(Infinity), done = new Uint8Array(n);
  N.hn = 0; dist[src] = 0; maNavPush(0, src);
  while (N.hn > 0) {
    const k = maNavPop();
    if (done[k]) continue;
    done[k] = 1;
    const i = k % nx, j = (k - i) / nx, dk = dist[k];
    for (let d = 0; d < 8; d++) {
      const a = i + MA_NAV_D[d][0], b = j + MA_NAV_D[d][1];
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const m = b * nx + a;
      if (done[m] || !maNavOk(m, min)) continue;
      const nd = dk + (d >= 4 ? Math.SQRT2 : 1);
      if (nd < dist[m]) { dist[m] = nd; maNavPush(nd, m); }
    }
  }
  return dist;
}
/* La case d'au moins `min` mètres la plus proche de (x, z), à R cases au plus (−1 : aucune). */
function maNavNearest(x, z, min, R = 20) {
  const N = MA_NAV;
  if (!N.dep) return -1;
  const ci = Math.min(N.nx - 1, Math.max(0, Math.floor((x - N.x0) / N.C))), cj = Math.min(N.nz - 1, Math.max(0, Math.floor((z - N.z0) / N.C)));
  let best = -1, bd = 1e9;
  for (let r = 0; r <= R; r++) {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= N.nx || j >= N.nz) continue;
      const k = j * N.nx + i, d = di * di + dj * dj;
      if (d < bd && maNavOk(k, min)) { bd = d; best = k; }
    }
    if (best >= 0 && bd <= (r + 1) * (r + 1)) break;
  }
  return best;
}
/* La voie est-elle libre en ligne droite (au moins `min` mètres d'eau ; les 3 premiers mètres ne
   comptent pas : elle peut partir d'un peu moins profond) ? */
function maNavClear(ax, az, bx, bz, min) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.5);
  for (let s = 1; s <= n; s++) {
    const t = s / n;
    if (t * L > 3 && maDepth(ax + (bx - ax) * t, az + (bz - az) * t) < min) return false;
  }
  return true;
}
/* Que de l'eau entre deux points (rien ne cache l'un à l'autre à fleur d'eau : ni île, ni berge) ? */
function maWaterLine(ax, az, bx, bz) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 3);
  for (let s = 1; s < n; s++) { const t = s / n; if (maDepth(ax + (bx - ax) * t, az + (bz - az) * t) < 0.25) return false; }
  return true;
}
/* Plus court chemin de (ax, az) à (bx, bz) par l'eau d'au moins `min` mètres. La cible hors d'eau
   assez profonde (exact = false) : le chemin s'arrête au premier point d'eau possible à moins de
   d0 + 10 m d'elle (d0 : la distance de l'eau possible la plus proche), donc du côté d'où vient la
   bête (une barque sur un banc : elle s'approche par son côté du banc, sans faire le tour de l'île).
   A* à rebours (de l'arrivée vers la bête : plusieurs cases d'arrivée possibles), heuristique des
   repères pondérée de 1,2. L'eau de moins de 3,2 m coûte 1,5 fois plus, de moins de 2,2 m, 2,2 fois.
   → { pts, len, exact, gx, gz } */
function maNavPath(ax, az, bx, bz, min) {
  const N = MA_NAV;
  if (!N.dep) return null;
  const t0 = performance.now();
  let s = maNavCell(ax, az), g = maNavCell(bx, bz), R = 0;
  const exact = maNavOk(g, min);
  if (!exact) { const k0 = maNavNearest(bx, bz, min, 30); if (k0 < 0) return null; R = Math.hypot(maNavX(k0) - bx, maNavZ(k0) - bz) + 10; }
  if (!maNavOk(s, min)) { s = maNavNearest(ax, az, min, 12); if (s < 0) return null; }
  const gen = ++N.gen, nx = N.nx, nz = N.nz, C = N.C, Gc = N.g, F = N.from, ST = N.stamp, CL = N.closed, D = N.dep, LM = (min >= 3.2 ? N.lmDeep : N.lm) || [];
  const si = s % nx, sj = (s - si) / nx, sv = LM.map((a) => a[s]);
  const hh = (k) => {
    const i = k % nx, di = Math.abs(i - si), dj = Math.abs((k - i) / nx - sj);
    let h = di + dj + (Math.SQRT2 - 2) * Math.min(di, dj);
    for (let l = 0; l < LM.length; l++) { const v = Math.abs(sv[l] - LM[l][k]) * 0.25; if (v > h) h = v; }
    return 1.2 * h;
  };
  N.hn = 0;
  const seed = (k) => { if (ST[k] === gen) return; ST[k] = gen; Gc[k] = 0; F[k] = -1; maNavPush(hh(k), k); };
  if (exact) seed(g);
  else {
    const r = Math.ceil(R / C), bi = Math.floor((bx - N.x0) / C), bj = Math.floor((bz - N.z0) / C);
    for (let j = bj - r; j <= bj + r; j++) for (let i = bi - r; i <= bi + r; i++) {
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const k = j * nx + i;
      if (maNavOk(k, min) && Math.hypot(maNavX(k) - bx, maNavZ(k) - bz) <= R) seed(k);
    }
  }
  let found = false, it = 0;
  while (N.hn > 0 && it++ < 60000) {
    const k = maNavPop();
    if (CL[k] === gen) continue;
    CL[k] = gen;
    if (k === s) { found = true; break; }
    const i = k % nx, j = (k - i) / nx, dp = D[k], pen = 1 + (dp < 3.2 ? 0.5 : 0) + (dp < 2.2 ? 0.7 : 0);
    for (let d = 0; d < 8; d++) {
      const a = i + MA_NAV_D[d][0], b = j + MA_NAV_D[d][1];
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const m = b * nx + a;
      if (CL[m] === gen || !maNavOk(m, min)) continue;
      if (d >= 4 && (!maNavOk(j * nx + a, min) || !maNavOk(b * nx + i, min))) continue;   // pas d'angle coupé
      const ng = Gc[k] + (d >= 4 ? Math.SQRT2 : 1) * pen;
      if (ST[m] !== gen || ng < Gc[m]) { ST[m] = gen; Gc[m] = ng; F[m] = k; maNavPush(ng + hh(m), m); }
    }
  }
  N.calls++; N.ms = performance.now() - t0; N.it = it;
  if (!found) return null;
  const pts = [];
  for (let k = s; k !== -1; k = F[k]) pts.push([maNavX(k), maNavZ(k)]);
  if (exact) pts[pts.length - 1] = [bx, bz];
  let len = Math.hypot(pts[0][0] - ax, pts[0][1] - az);
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { pts, len, exact, gx: pts[pts.length - 1][0], gz: pts[pts.length - 1][1] };
}
/* Où viser pour aller en (tx, tz) par l'eau d'au moins `min` mètres : [x, z], ou null s'il n'y a
   aucun chemin (le pilotage à vue reprend). MAB.nav garde le chemin, son mode, sa longueur. */
function maNavAim(tx, tz, min) {
  const B = MAB, P = B.nav || (B.nav = { path: null, tx: 0, tz: 0, min: -1, t: -99, ct: -99, cx: 0, cz: 0, cmin: -1, clear: true, i: 0, mode: 'direct' });
  // loin de sa cible (plus de 90 m), elle voyage caché, en eau profonde ; l'eau moins profonde, pour
  // l'approche (le chemin reste court, la recherche aussi)
  if (min < MA_CFG.minDepth && Math.hypot(tx - B.x, tz - B.z) > 90) min = MA_CFG.minDepth;
  if (G.time - P.ct > 0.3 || P.cmin !== min || Math.abs(tx - P.cx) + Math.abs(tz - P.cz) > 3) {
    P.ct = G.time; P.cx = tx; P.cz = tz; P.cmin = min;
    P.clear = maNavClear(B.x, B.z, tx, tz, min);
  }
  if (P.clear) { P.path = null; P.mode = 'direct'; return [tx, tz]; }
  if (!P.path || P.min !== min || Math.hypot(tx - P.tx, tz - P.tz) > 8 || G.time - P.t > 2.5) {
    P.path = maNavPath(B.x, B.z, tx, tz, min); P.tx = tx; P.tz = tz; P.min = min; P.t = G.time; P.i = 0;
  }
  const W = P.path && P.path.pts;
  if (!W || !W.length) { P.mode = 'aucun'; return null; }
  P.mode = P.path.exact ? 'chemin' : 'au plus près';
  // le point le plus loin du chemin qu'elle voit d'ici
  let i = Math.min(P.i, W.length - 1);
  for (let k = i + 1; k < Math.min(W.length, i + 16); k++) if (maNavClear(B.x, B.z, W[k][0], W[k][1], min * 0.9)) i = k;
  P.i = i;
  return W[i];
}
/* La cible est-elle hors d'atteinte (le chemin s'arrête loin d'elle, et la bête y est déjà) ? */
function maNavStuck(tx, tz, slack = 6) {
  const P = MAB.nav;
  if (!P || !P.path || P.path.exact || P.mode === 'direct') return false;
  return Math.hypot(P.path.gx - MAB.x, P.path.gz - MAB.z) < slack && Math.hypot(P.path.gx - tx, P.path.gz - tz) > slack;
}
/* Un point d'eau d'au moins `min` mètres à rmin-rmax de (px, pz) PAR L'EAU, celui qui a le meilleur
   score(x, z) parmi 24 tirés au hasard (null : aucun). */
function maNavRing(px, pz, rmin, rmax, min, score) {
  const N = MA_NAV;
  if (!N.dep) return null;
  let s = maNavCell(px, pz);
  if (!maNavOk(s, min)) { s = maNavNearest(px, pz, min, 15); if (s < 0) return null; }
  const gen = ++N.gen, nx = N.nx, nz = N.nz, Gc = N.g, ST = N.stamp, CL = N.closed, lim = rmax / N.C, lo = rmin / N.C;
  N.hn = 0; ST[s] = gen; Gc[s] = 0; maNavPush(0, s);
  const cand = [];
  while (N.hn > 0) {
    const k = maNavPop();
    if (CL[k] === gen) continue;
    CL[k] = gen;
    const gk = Gc[k];
    if (gk > lim) break;
    if (gk >= lo) cand.push(k);
    const i = k % nx, j = (k - i) / nx;
    for (let d = 0; d < 8; d++) {
      const a = i + MA_NAV_D[d][0], b = j + MA_NAV_D[d][1];
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const m = b * nx + a;
      if (CL[m] === gen || !maNavOk(m, min)) continue;
      if (d >= 4 && (!maNavOk(j * nx + a, min) || !maNavOk(b * nx + i, min))) continue;
      const ng = gk + (d >= 4 ? Math.SQRT2 : 1);
      if (ST[m] !== gen || ng < Gc[m]) { ST[m] = gen; Gc[m] = ng; maNavPush(ng, m); }
    }
  }
  if (!cand.length) return null;
  let best = null, bs = -1e9;
  for (let n = 0; n < Math.min(24, cand.length); n++) {
    const k = cand[(Math.random() * cand.length) | 0], x = maNavX(k) + rand(-1.5, 1.5), z = maNavZ(k) + rand(-1.5, 1.5);
    const sc = score ? score(x, z) : Math.random();
    if (sc > bs) { bs = sc; best = [x, z]; }
  }
  return best;
}
