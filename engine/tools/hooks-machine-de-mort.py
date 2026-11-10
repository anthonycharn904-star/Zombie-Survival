# Points d'accroche du jeu 2.0.7 : la machine de mort. Exécuté par build.py après hooks-musique-menu.py.
# Demande d'Anthony du 4 novembre 2026 (paquet machine-de-mort-zombie-survival : engine/orig/machine-de-mort/, inséré
# tel quel). Le branchement est dans le module src/S5-machine-de-mort.js (section 32).

# tir : un « emplacement » qui porte ses caractéristiques (MDM_ARME), hors de WEAPONS (ni inventaire, ni boîte, ni murs)
rep("""function wstat(slot, k) {
  return tierStats(slot.id, slot.tier || 0)[k];""", """function wstat(slot, k) {
  if (slot.def) return slot.def[k];             // jeu 2.0.7 : machine de mort (section 32)
  return tierStats(slot.id, slot.tier || 0)[k];""")
rep("""function hitscan(s, ox, oy, oz, dx, dy, dz, mw) {
  const def = WEAPONS[s.id];""", """function hitscan(s, ox, oy, oz, dx, dy, dz, mw) {
  const def = s.def || WEAPONS[s.id];           // jeu 2.0.7 : machine de mort (section 32)""")
# armes : la machine de mort tient les mains (ni tir, rechargement, visée, changement d'arme, couteau ni grenade)
rep("""  const s = curSlot();
  Arms.bloom = Math.max(0, Arms.bloom - dt * 5);
""", """  if (mdmArmes(dt)) return;                    // jeu 2.0.7 : machine de mort en main (section 32)
  const s = curSlot();
  Arms.bloom = Math.max(0, Arms.bloom - dt * 5);
""")
# chaque image, après les armes et avant le corps : la logique du paquet, sa vue, les miniatures au sol
rep("""  updatePlayer(dt);
  updateArms(dt);
""", """  updatePlayer(dt);
  updateArms(dt);
  mdmMaj(dt);                                  // jeu 2.0.7 : machine de mort (section 32)
""")
# déplacement pendant l'usage : × 0,88 (glissade et sprint tactique compris)
rep("""  const mobility = slot ? WEAPONS[slot.id].mobility : 1;""",
    """  const mobility = (slot ? WEAPONS[slot.id].mobility : 1) * mdmVitesse();   // jeu 2.0.7 : machine de mort (section 32)""")
# bonus au sol : l'entrée du jeu sans modèle, la miniature du paquet la suit ; ramassage marqué (éclair du paquet)
rep("""function buildPowerupModel(type) {
""", """function buildPowerupModel(type) {
  if (type === 'deathmachine') return mdmModeleSol();   // jeu 2.0.7 : miniature du paquet (section 32)
""")
rep("""      applyPowerup(p.type);
      remove = true;""", """      p.pris = true;                              // jeu 2.0.7 : machine de mort, éclair du ramassage (section 32)
      applyPowerup(p.type);
      remove = true;""")
rep("""    default: break;
  }
}
function clearPowerups() {""", """    case 'deathmachine': mdmRamasse(); break;   // jeu 2.0.7 : machine de mort (section 32)
    default: break;
  }
}
function clearPowerups() {""")
rep("""  for (const p of Powerups.list) scene.remove(p.m);
  Powerups.list.length = 0;
""", """  for (const p of Powerups.list) scene.remove(p.m);
  Powerups.list.length = 0;
  mdmVider();                                  // jeu 2.0.7 : machine de mort rangée, miniatures retirées (section 32)
""")
# bonus actifs : « Machine de mort » et son temps, avec l'icône dorée du paquet
rep("""    if (G.timers.double > 0) pu.push(['double', 'Points doubles', G.timers.double]);
""", """    if (G.timers.double > 0) pu.push(['double', 'Points doubles', G.timers.double]);
    if (mdmActif()) pu.push(['deathmachine', 'Machine de mort', MDM.inst.tempsRestant]);   // jeu 2.0.7 (section 32)
""")
rep("""<b>${id === 'insta' ? '☠' : '×2'}</b>""", """<b>${id === 'insta' ? '☠' : id === 'deathmachine' ? mdmIconeHtml() : '×2'}</b>""")
# lancement d'une partie : l'instance de la session (une fois), remise à zéro
ins_after("""  menuMusiqueArret();                          // jeu 2.0.7 : musique du menu (section 30)
""", """  mdmNouvellePartie();                         // jeu 2.0.7 : machine de mort (section 32)
""")
# fin de partie : la machine de mort est perdue (la logique du jeu ne tourne plus ensuite)
rep("""  G.state = 'gameover';
  closeKeypad();
""", """  G.state = 'gameover';
  closeKeypad();
  if (mdmActif()) MDM.inst.perdre('fin-de-partie');   // jeu 2.0.7 : machine de mort (section 32)
""")
# achats qui occupent les mains (atouts, armes aux murs, boîte, Glas) : déjà refusés par armsBusy ; le message le dit
rep("""  HUD.prompt(bestPrompt);
  if (!best || bestPrompt.disabled) return;""", """  if (best && mdmActif() && ['perk', 'wallbuy', 'box', 'amp'].includes(best.kind)) bestPrompt = { text: 'Machine de mort en main', disabled: true };   // jeu 2.0.7 (section 32)
  HUD.prompt(bestPrompt);
  if (!best || bestPrompt.disabled) return;""")
