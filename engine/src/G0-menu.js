/* ------------------------------------------------------------------ Menu --
   Dossier du menu pour Khamsin : pas de planches à reclouer, une boîte qui voyage d'un lieu à
   l'autre, le courant de la centrale du Nil, les véhicules et les tempêtes. Les autres cartes
   retrouvent les textes du jeu (refreshMenu écrit tip-power ; tip-box est remis ici). */
const KH_TIPS = {
  box: (m) => `La boîte mystère (${RULES.boxCost} points) voyage de lieu en lieu${m && m.base === 'khamsin' && (m.adds || []).includes('pyramides') ? ', jusque dans Khéops une fois sa herse levée' : ''}\u00a0; la mini-carte la marque en bleu.`,
  power: 'Trois disjoncteurs à la centrale du Nil\u00a0: le courant alimente les atouts, ouvre le sanctuaire et charge la batterie de l’avion.',
  boxBase: () => `La boîte mystère donne une arme au hasard pour ${RULES.boxCost} points.`,
};
const KH_NUM = ['aucun', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
/* « trois disjoncteurs » : le nombre en lettres. */
const khBreakersWord = (n) => `${KH_NUM[n] || n} disjoncteur${n > 1 ? 's' : ''}`;
/* Consigne du courant : celle de Khamsin tant que ses disjoncteurs n'ont pas bougé ; sinon leur
   nombre et les lieux où ils sont (une carte des Mod Tools). */
function khPowerTip(map) {
  const B = map.breakers || [], desert = map.base === 'desert';
  const fed = desert ? 'les atouts' : 'les atouts, le sanctuaire et la batterie de l’avion';
  if (map.rules && map.rules.powerOn) return `Courant rétabli dès le départ\u00a0: ${fed} sont alimentés.`;
  if (!B.length) return desert ? 'Pas de disjoncteur sur cette carte\u00a0: les atouts électriques restent sans courant.' : 'Pas de disjoncteur sur cette carte\u00a0: atouts électriques, sanctuaire et batterie de l’avion restent sans courant.';
  if (!desert && JSON.stringify(B) === JSON.stringify(KHAMSIN.breakers)) return KH_TIPS.power;
  const named = owNamedLocsOf(map);
  const where = [...new Set(B.map((b) => { let best = null, bd = Infinity; for (const L of named) { const d = Math.hypot(b.x - L.x, b.z - L.z) - L.r; if (d < bd) { bd = d; best = L; } } return best && bd < 200 ? best.name : null; }).filter(Boolean))].join(', ');
  const w = khBreakersWord(B.length);
  return `${w[0].toUpperCase()}${w.slice(1)}${where ? ` (${where})` : ''}\u00a0: le courant alimente ${desert ? 'les atouts' : 'les atouts, ouvre le sanctuaire et charge la batterie de l’avion'}.`;
}
/* Lieux nommés d'une carte sans la charger (ceux de Khamsin si sa base les a, puis les siens). */
function owNamedLocsOf(map) {
  const B = OW_BASES[map.base] || OW_BASES.khamsin;
  return [...(B.places ? OW_WORLDS[B.world].locs() : []), ...((map.locs || []).map((L) => ({ name: L.name, x: L.x, z: L.z, r: L.r })))];
}
/* Tempêtes : toutes les N manches (règle de la carte), aucune avec 0. */
function khStormTip(n) {
  if (n === 1) return 'À chaque manche, une tempête de sable\u00a0: abritez-vous sous un toit.';
  return `Toutes les ${KH_NUM[n] || n} manches, une tempête de sable\u00a0: abritez-vous sous un toit.`;
}
function khMenuTips(map) {
  // jeu 2.0.4 : V ou E, le khépesh sur Khamsin et les cartes faites à partir d'elle (base « khamsin »),
  // le couteau ailleurs, Désert vierge compris (construction 2)
  const km = $('key-melee');
  if (km) km.textContent = map && map.open && map.base === 'khamsin' ? 'Khépesh' : 'Couteau';
  if (map && map.open && owWorldOf(map.base) === 'lune') { luMenuTips(map); return; }
  for (const id of ['tip-moon', 'tip-o2']) { const e = $(id); if (e) e.hidden = true; }
  const kh = !!(map && map.open);
  for (const id of ['tip-veh', 'tip-storm']) $(id).hidden = !kh;
  $('tip-planks').hidden = kh;
  if (!kh) { $('tip-box').textContent = KH_TIPS.boxBase(); return; }
  $('tip-box').hidden = false;
  $('tip-box').textContent = KH_TIPS.box(map);
  $('tip-power').hidden = false;
  $('tip-power').textContent = khPowerTip(map);
  const n = map.rules && Number.isFinite(map.rules.storms) ? map.rules.storms : 4;
  $('tip-storm').hidden = !n;
  if (n) $('tip-storm').textContent = khStormTip(n);
}
