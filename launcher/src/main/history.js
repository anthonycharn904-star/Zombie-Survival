'use strict';
/* Historique des notes de version : une entrée { version, date, notes } par version du jeu
   publiée. Le manifeste signé (latest.json) porte la version en ligne (game) et, depuis le
   launcher 1.2.6, les versions précédentes (history) ; le launcher y ajoute le jeu installé
   et les versions publiées avant la 1.2.6 (config/notes-history.json).
   Module Node pur, sans Electron, pour pouvoir le tester seul. */

const LIMITS = { entries: 300, notes: 60, noteLength: 600, date: 40 };
const VERSION_RE = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;

function parse(v) {
  const m = VERSION_RE.exec(String(v == null ? '' : v).trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function compare(a, b) {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

/* Entrée propre, ou null si elle n'a pas de numéro de version valide. */
function cleanEntry(e) {
  if (!e || typeof e !== 'object' || !parse(e.version)) return null;
  const notes = Array.isArray(e.notes)
    ? e.notes.filter((n) => typeof n === 'string').map((n) => n.trim().slice(0, LIMITS.noteLength)).filter(Boolean).slice(0, LIMITS.notes)
    : [];
  return { version: String(e.version).trim(), date: typeof e.date === 'string' ? e.date.trim().slice(0, LIMITS.date) : '', notes };
}

/* Fusionne des listes d'entrées : une seule par version, de la plus récente à la plus
   ancienne. Les listes sont données de la plus sûre à la moins sûre : la première qui
   donne une version l'emporte ; une suivante ne fait que compléter une date ou des notes
   absentes. */
function mergeHistory(...lists) {
  const byVersion = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const e = cleanEntry(raw);
      if (!e) continue;
      const prev = byVersion.get(e.version);
      if (!prev) { byVersion.set(e.version, e); continue; }
      if (!prev.notes.length && e.notes.length) prev.notes = e.notes;
      if (!prev.date && e.date) prev.date = e.date;
    }
  }
  return [...byVersion.values()].sort((a, b) => compare(b.version, a.version)).slice(0, LIMITS.entries);
}

/* Versions antérieures à `version` (historique joint à une nouvelle publication). */
function historyBefore(version, ...lists) {
  if (!parse(version)) return [];
  return mergeHistory(...lists).filter((e) => compare(e.version, version) < 0);
}

/* Entrées décrites par un manifeste : la version qu'il publie, puis son historique. */
function manifestEntries(m) {
  if (!m || !m.game) return [];
  return [{ version: m.game.version, date: m.game.date || m.published || '', notes: m.game.notes || [] }, ...(Array.isArray(m.history) ? m.history : [])];
}

module.exports = { LIMITS, cleanEntry, mergeHistory, historyBefore, manifestEntries };
