#!/usr/bin/env bash
# Scène de la Mère-Vase : copie, en lecture seule, du jeu du kit 2.0.7 d'Anthony dans ce worktree (scene-bete/kit/,
# hors de Git). Rien n'est exécuté : la copie est vérifiée par empreintes, le kit d'origine n'est pas modifié.
#   bash maquettes/launcher/scene-bete/preparer.sh ["<dossier du kit>"]
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# par défaut, le kit dans les Documents de Windows ; le nom du compte n'est pas écrit ici (dépôt public)
KIT_DEFAUT=""
for d in /mnt/c/Users/*/Documents/"Zombie Survival - Publications"/"Zombie Survival 2.0.7 - a publier (Stryges)"; do
  if [ -d "$d" ]; then KIT_DEFAUT="$d"; break; fi
done
KIT="${1:-$KIT_DEFAUT}"
[ -n "$KIT" ] && [ -f "$KIT/jeu/index.html" ] || { echo "kit introuvable : ${KIT:-aucun dossier « Zombie Survival - Publications » dans les Documents de Windows}" >&2; exit 2; }
mkdir -p "$ICI/kit"
rm -rf "$ICI/kit/jeu"
cp -r "$KIT/jeu" "$ICI/kit/jeu"
cp "$KIT/a-publier/zombie-survival-2.0.7.zip.sha256" "$ICI/kit/" 2>/dev/null || true
# contrôle : chaque fichier copié a la même empreinte que l'original
( cd "$KIT/jeu" && find . -type f -print0 | sort -z | xargs -0 sha256sum ) > "$ICI/kit/empreintes-origine.txt"
( cd "$ICI/kit/jeu" && find . -type f -print0 | sort -z | xargs -0 sha256sum ) > "$ICI/kit/empreintes-copie.txt"
if cmp -s "$ICI/kit/empreintes-origine.txt" "$ICI/kit/empreintes-copie.txt"; then
  echo "copie conforme : $(wc -l < "$ICI/kit/empreintes-copie.txt") fichiers, index.html $(sha256sum "$ICI/kit/jeu/index.html" | cut -c1-16)…"
else
  echo "ÉCART entre l'original et la copie" >&2; exit 1
fi
# sources des sons calculés (pluie, orage), lues par exporter-sons.js (export autorisé par Anthony le 31 octobre 2026)
SRC="$KIT/sources/src/ma"
mkdir -p "$ICI/kit/sources"
cp "$SRC/ma17_pluie.js" "$SRC/ma18_orage.js" "$ICI/kit/sources/"
( cd "$SRC" && sha256sum ma17_pluie.js ma18_orage.js ) > "$ICI/kit/sources/empreintes-origine.txt"
( cd "$ICI/kit/sources" && sha256sum ma17_pluie.js ma18_orage.js ) > "$ICI/kit/sources/empreintes-copie.txt"
if cmp -s "$ICI/kit/sources/empreintes-origine.txt" "$ICI/kit/sources/empreintes-copie.txt"; then
  echo "sources des sons conformes : ma17_pluie.js $(sha256sum "$ICI/kit/sources/ma17_pluie.js" | cut -c1-16)…, ma18_orage.js $(sha256sum "$ICI/kit/sources/ma18_orage.js" | cut -c1-16)…"
else
  echo "ÉCART entre les sources des sons et leur copie" >&2; exit 1
fi
