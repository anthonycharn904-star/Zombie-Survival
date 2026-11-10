'use strict';
/* Sauvegardes des parties solo (jeu 2.0.7, « Sauvegarder et quitter », demande d'Anthony du 3 novembre 2026) : fichiers
   du dossier utilisateur du launcher (%APPDATA%\Zombie Survival\sauvegardes\<carte>\<type>.json), gardés lors des mises
   à jour du jeu et du launcher. Module Node pur (aucune dépendance à Electron), branché par main.js.
   · écriture atomique : fichier temporaire écrit et vidé sur le disque (fsync), puis renommé par-dessus l'ancien ; la
     précédente sauvegarde lisible est d'abord copiée en .bak ; relecture et vérification ;
   · lecture vérifiée : JSON, enveloppe, somme de l'état (la même que le jeu : FNV-1a de JSON.stringify(etat)) ; si la
     principale est abîmée, la copie .bak sert, avec un avertissement ; rien n'est jamais effacé sur un échec ;
   · une écriture interrompue (plantage, coupure) laisse un fichier temporaire : la sauvegarde d'avant reste intacte, le
     temporaire est retiré à l'écriture suivante ;
   · identifiant de carte et type contrôlés, taille limitée. */
const fs = require('fs');
const path = require('path');

const TYPES = ['manuelle', 'secours'];
const ID = /^[a-z0-9_-]{1,64}$/;
const MAX = 4 * 1024 * 1024;

/* Somme FNV-1a sur 32 bits, en hexadécimal, comme sauveSomme du jeu (section 29). */
function sommeTexte(txt) {
  let h = 0x811c9dc5;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
/* Enveloppe lisible et intacte ? { ok, env, erreur } */
function verifier(texte) {
  let env;
  try { env = JSON.parse(texte); } catch (e) { return { ok: false, erreur: 'illisible' }; }
  if (!env || typeof env !== 'object' || !env.etat || typeof env.somme !== 'string') return { ok: false, erreur: 'incomplète' };
  if (sommeTexte(JSON.stringify(env.etat)) !== env.somme) return { ok: false, erreur: 'abîmée (somme)' };
  return { ok: true, env };
}

class Sauvegardes {
  constructor(dir) { this.dir = dir; }

  fichier(carte, type) {
    if (typeof carte !== 'string' || !ID.test(carte)) throw new Error(`Carte invalide : ${carte}`);
    if (!TYPES.includes(type)) throw new Error(`Type de sauvegarde invalide : ${type}`);
    return path.join(this.dir, carte, `${type}.json`);
  }

  /* Écrit une sauvegarde (texte JSON de l'enveloppe du jeu). { ok, octets } ou { ok: false, erreur } */
  ecrire(carte, type, texte) {
    let f;
    try { f = this.fichier(carte, type); } catch (e) { return { ok: false, erreur: e.message }; }
    if (typeof texte !== 'string' || Buffer.byteLength(texte, 'utf8') > MAX) return { ok: false, erreur: 'sauvegarde trop grande ou invalide' };
    const v = verifier(texte);
    if (!v.ok) return { ok: false, erreur: `sauvegarde refusée : ${v.erreur}` };
    const dossier = path.dirname(f);
    const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
    try {
      fs.mkdirSync(dossier, { recursive: true });
      for (const n of fs.readdirSync(dossier)) if (n.startsWith(`${type}.json.tmp-`)) fs.rmSync(path.join(dossier, n), { force: true });
      const fd = fs.openSync(tmp, 'w');
      try { fs.writeSync(fd, texte, 0, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      // la précédente, si elle est intacte, devient la copie (une copie intacte n'est jamais remplacée par un fichier abîmé)
      if (fs.existsSync(f) && verifier(fs.readFileSync(f, 'utf8')).ok) fs.copyFileSync(f, `${f}.bak`);
      fs.renameSync(tmp, f);
      try { const d = fs.openSync(dossier, 'r'); fs.fsyncSync(d); fs.closeSync(d); } catch (e) { /* Windows : sans objet */ }
      if (fs.readFileSync(f, 'utf8') !== texte) return { ok: false, erreur: 'relecture différente' };
      return { ok: true, octets: Buffer.byteLength(texte, 'utf8') };
    } catch (e) {
      try { fs.rmSync(tmp, { force: true }); } catch (e2) { /* déjà retiré */ }
      return { ok: false, erreur: `écriture impossible : ${e.message}` };
    }
  }

  /* Lit et vérifie : la principale, sinon la copie. { ok, texte, source, avertissement } ou { ok: false, erreur } */
  lire(carte, type) {
    let f;
    try { f = this.fichier(carte, type); } catch (e) { return { ok: false, erreur: e.message }; }
    const essai = (p) => {
      if (!fs.existsSync(p)) return { ok: false, erreur: 'absente' };
      const texte = fs.readFileSync(p, 'utf8');
      const v = verifier(texte);
      return v.ok ? { ok: true, texte } : { ok: false, erreur: v.erreur };
    };
    const a = essai(f);
    if (a.ok) return { ...a, source: 'principale' };
    const b = essai(`${f}.bak`);
    if (b.ok) return { ...b, source: 'copie', avertissement: a.erreur === 'absente' ? null : `sauvegarde principale ${a.erreur} : copie précédente utilisée` };
    return { ok: false, erreur: a.erreur, source: 'principale' };
  }

  /* Efface une sauvegarde consommée ou remplacée (principale et copie). */
  supprimer(carte, type) {
    let f;
    try { f = this.fichier(carte, type); } catch (e) { return false; }
    for (const p of [f, `${f}.bak`]) fs.rmSync(p, { force: true });
    return true;
  }

  /* Accès brut, pour les essais (fichier abîmé, copie) : texte lu ; texte écrit sans contrôle ; null : effacé. */
  brut(carte, type, copie, texte) {
    let f;
    try { f = this.fichier(carte, type); } catch (e) { return null; }
    if (copie) f = `${f}.bak`;
    if (texte === undefined) return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    if (texte === null) { fs.rmSync(f, { force: true }); return true; }
    if (typeof texte !== 'string' || Buffer.byteLength(texte, 'utf8') > MAX) return false;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, texte);
    return true;
  }

  /* Résumés des sauvegardes présentes, la plus récente d'abord. */
  liste() {
    const out = [];
    let cartes = [];
    try { cartes = fs.readdirSync(this.dir).filter((n) => ID.test(n)); } catch (e) { return out; }
    for (const carte of cartes) {
      for (const type of TYPES) {
        const r = this.lire(carte, type);
        if (!r.ok) { if (r.erreur !== 'absente') out.push({ carte, type, etat: 'abîmée', erreur: r.erreur }); continue; }
        const env = JSON.parse(r.texte);
        out.push({ carte, type, etat: r.source === 'copie' ? 'copie' : 'ok', apercu: env.apercu || null, cree: env.cree || null, jeu: env.jeu || null });
      }
    }
    out.sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || '')));
    return out;
  }
}

module.exports = { Sauvegardes, sommeTexte, verifier, TYPES };
