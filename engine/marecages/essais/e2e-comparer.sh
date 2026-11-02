#!/usr/bin/env bash
# Marécages Maudits : les blocs des essais E2 du jeu rejoués dans la page (engine/tools/e2e-page.js, sans le modifier),
# sur le jeu officiel puis sur le jeu avec le marais, pour voir si le marais change quelque chose aux autres cartes
# (accord d'Anthony du 2 novembre 2026 : npm ci, puis e2e-page.js par zs-lourd). Chaque essai est un travail de la file
# commune (classe jeu) : les autres sessions passent entre deux. La souris verrouillée est refusée par refus-souris.js.
# Les essais des Mod Tools et de la publication demandent le launcher (méthode E2) : ils ne sont pas rejoués ici.
# Avec --sections : les sections des essais qui suivent des clics (par défaut « écran Modèles » de dogs et de
# zone-zombies) rejouées telles quelles par e2e-tranche.js, un seul travail de la file par jeu.
# Usage : engine/marecages/essais/e2e-comparer.sh [--sections] JEU_MARAIS.html DOSSIER [essai…]
set -u
SECTIONS=0; if [ "${1:-}" = --sections ]; then SECTIONS=1; shift; fi
REPO=$(cd "$(dirname "$0")/../../.." && pwd)
MARAIS=$1; OUT=$2; shift 2
if [ $SECTIONS = 1 ]; then ESSAIS=${*:-dogs zone-zombies}; else ESSAIS=${*:-game-menu stairs rank perk-drink outskirts zone-zombies glas elixirs zombie-anims weapons personnage glissade hud-points dogs grenade knife khamsin khepesh ombre}; fi
HOOK=$REPO/engine/marecages/essais/refus-souris.js
mkdir -p "$OUT"
cd "$REPO"
for JEU in officiel marais; do
  if [ $JEU = officiel ]; then SRC=$REPO/game/zombie-survival.html; else SRC=$MARAIS; fi
  echo "=== $JEU : $(sha256sum "$SRC" | cut -c1-16)…"
  (cd launcher && node scripts/prepare-game.js "$SRC") || exit 1
  if [ $SECTIONS = 1 ]; then
    ~/outils/bin/zs-lourd --classe jeu --memoire 3500 --attente-max 7200 --nom "Marécages : e2e-sections $JEU" -- \
      node engine/marecages/essais/e2e-tranche.js "$OUT/$JEU" $ESSAIS 2>&1 | tee -a "$OUT/$JEU.txt"
  else
    for E in $ESSAIS; do
      ~/outils/bin/zs-lourd --classe jeu --memoire 3500 --attente-max 7200 --nom "Marécages : e2e-page $JEU $E" -- \
        env NODE_OPTIONS="--require $HOOK" node engine/tools/e2e-page.js "$OUT/$JEU" "$E" 2>&1 | tee -a "$OUT/$JEU.txt"
    done
  fi
done
(cd launcher && node scripts/prepare-game.js) > /dev/null          # launcher/game/ : de nouveau le jeu officiel
python3 -I "$REPO/engine/marecages/essais/e2e-bilan.py" "$OUT"
