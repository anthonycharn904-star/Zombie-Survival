/* ------------------------------------------------------------- Solides --
   Cases de 1 m, par morceaux de 64 × 64 créés à la demande (le désert n'en a pas) ; deux couches :
   la surface (OW.surf : hors des morceaux, le terrain) et le sous-sol (OW.under : hors des
   morceaux, la roche). Une case dit ce qu'il y a dans sa colonne :
     TERRAIN  le sol du terrain                    FLOOR   un sol plat à base, plafond éventuel (ceil → roof)
     SOLID    plein de base à top (mur, pyramide)  LOW     plein de base à top, bas (caisse, muret, rebord)
     WINDOW   plein sauf l'ouverture lo → hi       DOOR    plein tant qu'elle est fermée (sinon FLOOR)
     RAMP     pente de base à top dans le sens dir  WATER   eau à base (on n'y marche pas)
     ROCK     roche (sous-sol hors des salles)      VOID    rien (trou)
   mat : matière pour les impacts (0 pierre, 1 sable, 2 bois, 3 métal, 4 toile, 5 brique crue). */
const OWK = { TERRAIN: 0, FLOOR: 1, SOLID: 2, LOW: 3, WINDOW: 4, DOOR: 5, RAMP: 6, WATER: 7, ROCK: 8, VOID: 9 };
const OWM = { STONE: 0, SAND: 1, WOOD: 2, METAL: 3, CLOTH: 4, MUD: 5 };
function owNewLayer(def) { return { CW: 64, CD: 48, chunks: new Array(64 * 48).fill(null), def, n: 0 }; }
function owChunkNew(L) {
  const c = {
    kind: new Uint8Array(4096).fill(L.def), base: new Float32Array(4096), top: new Float32Array(4096),
    lo: new Float32Array(4096), hi: new Float32Array(4096), ceil: new Float32Array(4096), roof: new Float32Array(4096),
    dir: new Uint8Array(4096), mat: new Uint8Array(4096), door: new Int16Array(4096).fill(-1),
  };
  L.n++;
  return c;
}
/* Morceau d'une case (null s'il n'existe pas) ; make : le créer. */
function owChunk(L, cx, cz, make) {
  if (cx < 0 || cz < 0 || cx >= 4096 || cz >= 3072) return null;
  const ci = (cz >> 6) * L.CW + (cx >> 6);
  let ch = L.chunks[ci];
  if (!ch && make) ch = L.chunks[ci] = owChunkNew(L);
  return ch;
}
const owIdx = (cx, cz) => ((cz & 63) << 6) | (cx & 63);
/* Jeu 2.0.3 : pièce du décor des lieux en construction (voir « Décor des lieux ») : ses cases sont
   relevées (écrites plus tard, à leur place, avec ses surfaces). */
const OWCAP = { cur: null };
/* Écrit une case. o : { base, top, lo, hi, ceil, roof, dir, mat, door } (absolus, en m). */
function owSet(L, cx, cz, kind, o) {
  const C = OWCAP.cur;
  if (C && C.cells) {
    if (cx < 0 || cz < 0 || cx >= 4096 || cz >= 3072) return;
    C.cells.set((L === OW.under ? 16777216 : 0) + cz * 4096 + cx, owCapRec(L, cx, cz, kind, o));
    return;
  }
  if (OWJ.cur) owLogCell(L, cx, cz);
  const ch = owChunk(L, cx, cz, true);
  if (!ch) return;
  const i = owIdx(cx, cz);
  ch.kind[i] = kind;
  ch.base[i] = o.base !== undefined ? o.base : 0;
  ch.top[i] = o.top !== undefined ? o.top : ch.base[i];
  ch.lo[i] = o.lo || 0; ch.hi[i] = o.hi || 0;
  ch.ceil[i] = o.ceil || 0; ch.roof[i] = o.roof || 0;
  ch.dir[i] = o.dir || 0; ch.mat[i] = o.mat || 0; ch.door[i] = o.door !== undefined ? o.door : -1;
}
/* Remplit un rectangle de cases [x0, x1) × [z0, z1) (m, arrondis vers l'intérieur des cases touchées). */
function owFill(L, x0, z0, x1, z1, kind, o) {
  for (let cz = Math.floor(z0); cz < Math.ceil(z1); cz++) for (let cx = Math.floor(x0); cx < Math.ceil(x1); cx++) owSet(L, cx, cz, kind, typeof o === 'function' ? o(cx, cz) : o);
}
/* Mur d'épaisseur 1 case le long d'un segment. */
function owLine(L, ax, az, bx, bz, kind, o) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * 2));
  for (let i = 0; i <= n; i++) { const t = i / n; owSet(L, Math.floor(ax + (bx - ax) * t), Math.floor(az + (bz - az) * t), kind, typeof o === 'function' ? o(i) : o); }
}
/* Lecture : genre de case (TERRAIN ou ROCK hors des morceaux). */
function owKind(L, cx, cz) {
  const ch = owChunk(L, cx, cz);
  return ch ? ch.kind[owIdx(cx, cz)] : L.def;
}
/* Hauteur d'une rampe en (x, z). */
function owRampY(ch, i, cx, cz, x, z) {
  const d = ch.dir[i], fx = x - cx, fz = z - cz;
  const t = d === 0 ? fx : d === 1 ? 1 - fx : d === 2 ? fz : 1 - fz;
  return ch.base[i] + (ch.top[i] - ch.base[i]) * clamp(t, 0, 1);
}
/* Sol de la couche en (x, z) : terrain, plancher, rampe ; dessus des solides ; NaN dans la roche. */
function owGroundAt(layer, x, z) {
  const L = layer ? OW.under : OW.surf, cx = Math.floor(x), cz = Math.floor(z);
  const ch = owChunk(L, cx, cz);
  if (!ch) return layer ? NaN : owH(x, z);
  const i = owIdx(cx, cz), k = ch.kind[i];
  if (k === OWK.TERRAIN) return owH(x, z);
  if (k === OWK.FLOOR || k === OWK.WATER) return ch.base[i];
  if (k === OWK.RAMP) return owRampY(ch, i, cx, cz, x, z);
  if (k === OWK.DOOR) return ch.door[i] >= 0 && OW.doors[ch.door[i]] && OW.doors[ch.door[i]].open ? ch.base[i] : ch.top[i];
  if (k === OWK.ROCK) return NaN;
  if (k === OWK.VOID) return -1e9;
  return ch.top[i];
}
/* Case praticable (à pied) dans la couche. */
function owWalkCell(layer, cx, cz) {
  const L = layer ? OW.under : OW.surf;
  const ch = owChunk(L, cx, cz);
  if (!ch) return layer ? false : owTerrainWalk(cx + 0.5, cz + 0.5);
  const i = owIdx(cx, cz), k = ch.kind[i];
  if (k === OWK.TERRAIN) return layer ? false : owTerrainWalk(cx + 0.5, cz + 0.5);
  if (k === OWK.FLOOR || k === OWK.RAMP) return true;
  if (k === OWK.DOOR) return ch.door[i] >= 0 && OW.doors[ch.door[i]] && OW.doors[ch.door[i]].open;
  // le dessus d'un plein est un sol (la hauteur de marche décide : murs et troncs restent infranchissables)
  return k === OWK.SOLID || k === OWK.LOW;
}
/* Sol d'une case (au centre) pour les marches entre cases. */
function owCellGround(layer, cx, cz) { return owGroundAt(layer, cx + 0.5, cz + 0.5); }
/* Plafond au-dessus d'un point (pour le saut et les rayons) : Infinity s'il n'y en a pas. */
function owCeilAt(layer, x, z) {
  const L = layer ? OW.under : OW.surf, ch = owChunk(L, Math.floor(x), Math.floor(z));
  if (!ch) return Infinity;
  const i = owIdx(Math.floor(x), Math.floor(z));
  return ch.ceil[i] > 0 && (ch.kind[i] === OWK.FLOOR || ch.kind[i] === OWK.RAMP) ? ch.ceil[i] : Infinity;
}
/* Pyramides dans la grille : chaque case pleine jusqu'à la hauteur de la pente en son centre. */
function owRasterPyramids() {
  for (const p of KH.pyramids) {
    const half = p.side / 2, y0 = owH(p.x, p.z);
    p.y0 = y0;
    for (let cz = Math.floor(p.z - half); cz < Math.ceil(p.z + half); cz++) {
      for (let cx = Math.floor(p.x - half); cx < Math.ceil(p.x + half); cx++) {
        const m = Math.max(Math.abs(cx + 0.5 - p.x), Math.abs(cz + 0.5 - p.z)) / half;
        if (m > 1) continue;
        owSet(OW.surf, cx, cz, OWK.SOLID, { base: y0 - 2, top: y0 + p.h * (1 - m) + 0.2, mat: OWM.STONE });
      }
    }
  }
}
