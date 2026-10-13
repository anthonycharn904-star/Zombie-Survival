/* ------------------------------------------------- Journal des cases --
   Ce que la carte pose par-dessus les lieux écrit ses cases dans la grille des solides : d'abord
   les bâtiments ajoutés (journal B), puis les éléments (armes au mur, atouts, boîte, jerricans,
   disjoncteurs, objets posés : journal E). Pendant qu'ils se construisent, chaque case touchée
   garde ici son état d'avant : on peut les retirer (nouveau chargement, Mod Tools) sans refaire les
   lieux, et retrouver le sol sous eux. Le « sol de base » (owBase*) est celui d'avant les éléments,
   bâtiments ajoutés compris : on pose une arme sur le mur d'un bâtiment ajouté. */
const owJournal = () => ({ cells: new Map(), created: [] });
const OWLOG = owJournal();              // éléments
const OWLOGB = owJournal();             // bâtiments ajoutés
const OWJ = { cur: null };              // journal ouvert (owSet y écrit)
const owLogKey = (L, cx, cz) => (L === OW.under ? 0x10000000 : 0) + cz * 4096 + cx;
function owLogCell(L, cx, cz, J = OWJ.cur) {
  if (!J || cx < 0 || cz < 0 || cx >= 4096 || cz >= 3072) return;
  const key = owLogKey(L, cx, cz);
  if (J.cells.has(key)) return;
  const ci = (cz >> 6) * L.CW + (cx >> 6), ch = L.chunks[ci];
  if (!ch) { J.created.push({ L, ci }); J.cells.set(key, { L, cx, cz, kind: L.def, none: true }); return; }
  const i = owIdx(cx, cz);
  J.cells.set(key, { L, cx, cz, kind: ch.kind[i], base: ch.base[i], top: ch.top[i], lo: ch.lo[i], hi: ch.hi[i], ceil: ch.ceil[i], roof: ch.roof[i], dir: ch.dir[i], mat: ch.mat[i], door: ch.door[i] });
}
function owLogBegin(J = OWLOG) { OWJ.cur = J; }
function owLogEnd() { OWJ.cur = null; }
/* Retire tout ce qui a été écrit pendant le journal : les cases reprennent leur état d'avant. */
function owLogUndo(J = OWLOG) {
  if (OWJ.cur === J) OWJ.cur = null;
  for (const c of J.cells.values()) {
    if (c.none) continue;
    const ch = owChunk(c.L, c.cx, c.cz);
    if (!ch) continue;
    const i = owIdx(c.cx, c.cz);
    ch.kind[i] = c.kind; ch.base[i] = c.base; ch.top[i] = c.top; ch.lo[i] = c.lo; ch.hi[i] = c.hi;
    ch.ceil[i] = c.ceil; ch.roof[i] = c.roof; ch.dir[i] = c.dir; ch.mat[i] = c.mat; ch.door[i] = c.door;
  }
  for (const { L, ci } of J.created) if (L.chunks[ci]) { L.chunks[ci] = null; L.n--; }
  J.cells.clear();
  J.created.length = 0;
}
/* Éléments puis bâtiments retirés (dans cet ordre : une arme peut être sur le mur d'un bâtiment). */
function owLogUndoAll() { owLogUndo(OWLOG); owLogUndo(OWLOGB); }
/* État d'une case sans les éléments (le sol des lieux et des bâtiments ajoutés). */
function owBaseRec(L, cx, cz) {
  const c = OWLOG.cells.get(owLogKey(L, cx, cz));
  if (c) return c;
  const ch = owChunk(L, cx, cz);
  if (!ch) return null;
  const i = owIdx(cx, cz);
  return { kind: ch.kind[i], base: ch.base[i], top: ch.top[i], lo: ch.lo[i], hi: ch.hi[i], ceil: ch.ceil[i], roof: ch.roof[i], dir: ch.dir[i], mat: ch.mat[i], door: ch.door[i] };
}
/* État d'une case sans les bâtiments ajoutés ni les éléments (les lieux de la base seuls). */
function owPlaceRec(L, cx, cz) {
  const key = owLogKey(L, cx, cz);
  const c = OWLOGB.cells.get(key) || OWLOG.cells.get(key);
  if (c) return c;
  return owBaseRec(L, cx, cz);
}
/* Sol sous un point sans les éléments (comme owGroundAt). */
function owBaseGround(layer, x, z) {
  const L = layer ? OW.under : OW.surf, cx = Math.floor(x), cz = Math.floor(z);
  const c = owBaseRec(L, cx, cz);
  if (!c || c.none) return layer ? NaN : owH(x, z);
  const k = c.kind;
  if (k === OWK.TERRAIN) return owH(x, z);
  if (k === OWK.FLOOR || k === OWK.WATER) return c.base;
  if (k === OWK.RAMP) { const d = c.dir, fx = x - cx, fz = z - cz, t = d === 0 ? fx : d === 1 ? 1 - fx : d === 2 ? fz : 1 - fz; return c.base + (c.top - c.base) * clamp(t, 0, 1); }
  if (k === OWK.DOOR) return c.door >= 0 && OW.doors[c.door] && OW.doors[c.door].open ? c.base : c.top;
  if (k === OWK.ROCK) return NaN;
  if (k === OWK.VOID) return -1e9;
  return c.top;
}
/* Case praticable sans les éléments (comme owWalkCell). */
function owBaseWalk(layer, cx, cz) {
  const L = layer ? OW.under : OW.surf;
  const c = owBaseRec(L, cx, cz);
  if (!c || c.none) return layer ? false : owTerrainWalk(cx + 0.5, cz + 0.5);
  const k = c.kind;
  if (k === OWK.TERRAIN) return layer ? false : owTerrainWalk(cx + 0.5, cz + 0.5);
  if (k === OWK.FLOOR || k === OWK.RAMP) return true;
  if (k === OWK.DOOR) return c.door >= 0 && OW.doors[c.door] && OW.doors[c.door].open;
  return false;
}
/* Mur derrière une arme dessinée : une case pleine qui monte au moins 1,8 m au-dessus du sol y. */
function owBaseWallAt(cx, cz, y) {
  const c = owBaseRec(OW.surf, cx, cz);
  if (!c || c.none) return false;
  if (c.kind === OWK.SOLID || c.kind === OWK.DOOR || c.kind === OWK.ROCK) return c.top > y + 1.8;
  if (c.kind === OWK.WINDOW) return c.top > y + 1.8;
  if (c.kind === OWK.LOW) return c.top > y + 1.8;
  return false;
}
const owWaterAt = (x, z) => !!OW.water[owPointIndex(x, z)];
