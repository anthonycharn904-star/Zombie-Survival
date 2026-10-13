/* ---------------------------------------------------------------- Mondes --
   Deux mondes ouverts partagent ce moteur : le désert de Khamsin (4 × 3 km, un point du champ de
   hauteurs tous les 4 m) et la Lune d'« Ombre éternelle » (1,4 × 1,4 km, un point tous les 2 m :
   les gradins de la fosse ont 16 m de large et des parois de 7 m). Chaque monde garde son terrain,
   ses solides, ses routes et ses protections ; passer de l'un à l'autre ne refait rien de ce qui
   est déjà prêt. Les bases (cartes du jeu et cartes vierges des Mod Tools) appartiennent à un monde.
     W, D        zone jouable (m) ; X0, Z0, STEP, NX, NZ : champ de hauteurs
     walk        limites où l'on marche [x0, z0, x1, z1]
     lod         distances des niveaux de détail du terrain (basse, moyenne, haute qualité)
     base        base par défaut ; gen : création du terrain ; locs : lieux nommés */
const OW_WORLDS = {
  khamsin: {
    W: 4000, D: 3000, X0: -1024, Z0: -1024, STEP: 4, NX: 1537, NZ: 1281, walk: [150, 10, 3990, 2990],
    lod: [[180, 600, 1400], [260, 800, 1800], [380, 1100, 2400]], base: 'khamsin', edge: [120, 20, 3980, 2980],
    gen: () => owGenTerrain(), locs: () => KH.locs,
  },
  lune: {
    W: 1400, D: 1400, X0: -600, Z0: -600, STEP: 2, NX: 1301, NZ: 1301, walk: [6, 6, 1394, 1394],
    lod: [[110, 320, 760], [150, 440, 1000], [210, 620, 1400]], base: 'ombre', edge: [16, 16, 1384, 1384],
    gen: () => luGenTerrain(), locs: () => LU.locs,
  },
};
// ce qu'un monde garde quand on passe à l'autre
const OW_WORLD_KEYS = ['H', 'bio', 'steep', 'water', 'base0', 'roads', 'pads', 'oasisWater', 'layers', 'protect', 'surf', 'under', 'doors', 'baseId', 'roadsUser', 'pit', 'sunVis', 'decks', 'links'];
/* Monde courant : celui de la base demandée. Renvoie vrai s'il a changé. */
function owUseWorld(id) {
  const Wd = OW_WORLDS[id] ? OW_WORLDS[id] : OW_WORLDS.khamsin;
  if (!OW_WORLDS[id]) id = 'khamsin';
  if (OW.worldId === id && OW.H) return false;
  if (OW.worldId && OW.H) {
    // éléments de la carte d'avant retirés de ses solides (la boîte, les cases du journal)
    owBoxRelease();
    owLogUndoAll();
    const s = (OW.worlds || (OW.worlds = {}))[OW.worldId] = {};
    for (const k of OW_WORLD_KEYS) s[k] = OW[k];
    s.modsOn = OWMOD.on;
  }
  OW.worldId = id;
  OW.W = Wd.W; OW.D = Wd.D; OW.X0 = Wd.X0; OW.Z0 = Wd.Z0; OW.STEP = Wd.STEP; OW.INV = 1 / Wd.STEP; OW.NX = Wd.NX; OW.NZ = Wd.NZ;
  OW.walk = Wd.walk;
  OW.locs = Wd.locs();
  // morceaux du terrain dessiné : 64 points de côté (256 m à Khamsin, 128 m sur la Lune)
  OWTER.size = 64 * Wd.STEP;
  OWTER.cols = Math.ceil(((Wd.NX - 1) * Wd.STEP) / OWTER.size);
  OWTER.rows = Math.ceil(((Wd.NZ - 1) * Wd.STEP) / OWTER.size);
  const s = OW.worlds && OW.worlds[id];
  for (const k of OW_WORLD_KEYS) OW[k] = s ? s[k] : null;
  OWMOD.on = s ? !!s.modsOn : false;
  OWMOD.live = false;
  OW._bestD = OW._bestS = null;
  OW.locsShown = null;
  if (!s) { Wd.gen(); owTerrainSave(); }
  // ce qui dépend du monde : champ de flux, plan et morceaux des Mod Tools, mini-carte
  OWNAV.ready = false;
  OWED.tiles.clear(); OWED.meshes = null; OWED.plan = null; OWED.planKey = ''; OWED.planSig = null;
  OWED_RELIEF.clear();
  OWH.bg = null;
  return true;
}
