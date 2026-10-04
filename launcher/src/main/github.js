'use strict';
/* Mise en ligne d'une publication depuis le launcher de l'auteur.
   GitHub ne sert que d'entrepôt de fichiers : les launchers des joueurs lisent latest.json à
   l'adresse fixe …/releases/latest/download/latest.json et vérifient sa signature.
   Jeton : « fine-grained », limité au dépôt du jeu, permission « Contents » en lecture et
   écriture. Il est gardé chiffré par Windows et ne sert qu'ici.
   Déroulé : release en brouillon (invisible des launchers) → envoi des fichiers, latest.json
   en dernier → publication comme dernière version → relecture de l'adresse fixe. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const API_BASE = process.env.ZS_GITHUB_API || 'https://api.github.com';
const WEB_BASE = process.env.ZS_GITHUB_WEB || 'https://github.com';
const UA = 'ZombieSurvival-Launcher';
const REPO_RE = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

class GitHubError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'GitHubError'; this.status = status; }
}

/* Requête HTTP(S) : corps JSON ou fichier envoyé en flux (avec progression). Les redirections
   sont suivies pour GET et HEAD ; le jeton n'est jamais transmis à un autre hôte. */
function request(method, url, opts = {}) {
  const { headers = {}, json, file, onProgress, timeoutMs = 120000, redirects = 5 } = opts;
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const h = { 'User-Agent': UA, ...headers };
    let body = null, size = 0;
    if (json !== undefined) {
      body = Buffer.from(JSON.stringify(json));
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = body.length;
    } else if (file) {
      size = fs.statSync(file).size;
      h['Content-Length'] = size;
    }
    const req = mod.request(u, { method, headers: h, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', reject);
      res.on('end', () => {
        const loc = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && loc && (method === 'GET' || method === 'HEAD') && redirects > 0) {
          const next = new URL(loc, u);
          const nh = { ...headers };
          if (next.host !== u.host) delete nh.Authorization;
          request(method, next.href, { headers: nh, timeoutMs, redirects: redirects - 1 }).then(resolve, reject);
          return;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });
    req.on('timeout', () => req.destroy(new GitHubError('GitHub ne répond pas (délai dépassé).')));
    req.on('error', (e) => reject(e instanceof GitHubError ? e : new GitHubError(`Connexion à GitHub impossible : ${e.message}`)));
    if (body) req.end(body);
    else if (file) {
      const rs = fs.createReadStream(file);
      let sent = 0;
      rs.on('data', (c) => { sent += c.length; if (onProgress) onProgress(sent, size); });
      rs.on('error', (e) => req.destroy(e));
      rs.pipe(req);
    } else req.end();
  });
}

function explain(status, data, what) {
  const msg = data && typeof data.message === 'string' ? data.message : '';
  const errs = data && Array.isArray(data.errors) ? data.errors.map((e) => e.message || e.code).filter(Boolean).join(', ') : '';
  if (status === 401) return 'GitHub refuse le jeton (expiré, révoqué ou mal copié). Reliez de nouveau le launcher à GitHub avec un nouveau jeton.';
  if (status === 403 && /rate limit/i.test(msg)) return 'Trop de demandes envoyées à GitHub pour le moment. Réessayez dans quelques minutes.';
  if (status === 403) return `GitHub refuse l'opération (${what}) : le jeton doit avoir la permission « Contents : Read and write » sur ce dépôt.`;
  if (status === 404) return `Introuvable sur GitHub (${what}) : vérifiez le nom du dépôt et que le jeton y donne accès.`;
  if (status === 422) return `GitHub refuse la demande (${what})${errs || msg ? ` : ${errs || msg}` : ''}.`;
  return `GitHub a répondu ${status} (${what})${msg ? ` : ${msg}` : ''}.`;
}
const parse = (r) => { try { return r.body.length ? JSON.parse(r.body.toString('utf8')) : null; } catch (e) { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function contentType(name) {
  if (/\.json$/i.test(name)) return 'application/json';
  if (/\.zip$/i.test(name)) return 'application/zip';
  if (/\.exe$/i.test(name)) return 'application/vnd.microsoft.portable-executable';
  return 'application/octet-stream';
}

function checkToken(token) {
  const t = String(token || '').trim();
  if (!t) throw new GitHubError('Collez le jeton GitHub.');
  if (/\s/.test(t) || t.length < 20 || t.length > 400) throw new GitHubError('Ce texte ne ressemble pas à un jeton GitHub (il commence en général par « github_pat_ »).');
  return t;
}

function createClient({ token, apiBase = API_BASE, webBase = WEB_BASE }) {
  const auth = { Authorization: `Bearer ${checkToken(token)}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  async function api(method, p, json, what) {
    const r = await request(method, /^https?:/.test(p) ? p : apiBase + p, { headers: auth, json });
    const data = parse(r);
    if (r.status < 200 || r.status >= 300) throw new GitHubError(explain(r.status, data, what), r.status);
    return data;
  }

  /* Accès au dépôt : nom exact, branche principale, droit d'écriture, compte du jeton. */
  async function access(repo, { probeWrite = false } = {}) {
    if (!REPO_RE.test(String(repo || ''))) throw new GitHubError('Dépôt GitHub attendu sous la forme pseudo/depot.');
    const r = await api('GET', `/repos/${repo}`, undefined, 'lecture du dépôt');
    if (!r || !r.full_name) throw new GitHubError('Réponse inattendue de GitHub (dépôt).');
    if (!r.permissions || !r.permissions.push) {
      throw new GitHubError('Ce jeton peut lire le dépôt mais pas y écrire : donnez-lui la permission « Contents : Read and write ».', 403);
    }
    if (r.private) throw new GitHubError(`Le dépôt ${r.full_name} est privé : les launchers des joueurs ne pourraient pas y lire les mises à jour. Rendez-le public.`);
    // « push » décrit le compte, pas le jeton : on vérifie l'écriture pour de bon avec un
    // brouillon de version (jamais visible des joueurs), supprimé aussitôt.
    if (probeWrite) {
      let draft = null;
      try {
        draft = await api('POST', `/repos/${r.full_name}/releases`, { tag_name: `zs-verification-${Date.now()}`, name: 'Vérification du launcher (supprimée aussitôt)', draft: true }, 'vérification du droit d’écriture');
      } catch (e) {
        if (e.status === 403 || e.status === 404) throw new GitHubError('Ce jeton ne peut pas publier de version : donnez-lui la permission « Contents : Read and write » sur ce dépôt.', e.status);
        throw e;
      }
      if (draft && draft.id) await api('DELETE', `/repos/${r.full_name}/releases/${draft.id}`, undefined, 'nettoyage de la vérification').catch(() => {});
    }
    let login = null;
    try { const u = await api('GET', '/user', undefined, 'compte'); login = u && u.login ? u.login : null; } catch (e) { /* facultatif */ }
    return { repo: r.full_name, branch: r.default_branch || 'main', login };
  }

  async function findRelease(repo, tag) {
    for (let page = 1; page <= 5; page++) {
      const list = await api('GET', `/repos/${repo}/releases?per_page=100&page=${page}`, undefined, 'liste des versions');
      if (!Array.isArray(list) || !list.length) return null;
      const hit = list.find((x) => x.tag_name === tag);
      if (hit) return hit;
      if (list.length < 100) return null;
    }
    return null;
  }

  async function uploadAsset(release, file, name, onProgress) {
    const base = String(release.upload_url || '').replace(/\{[^}]*\}$/, '');
    if (!base) throw new GitHubError('Réponse inattendue de GitHub (adresse d’envoi).');
    const r = await request('POST', `${base}?name=${encodeURIComponent(name)}`, {
      headers: { ...auth, 'Content-Type': contentType(name) }, file, onProgress, timeoutMs: 300000,
    });
    const data = parse(r);
    if (r.status < 200 || r.status >= 300) throw new GitHubError(explain(r.status, data, `envoi de ${name}`), r.status);
    const size = fs.statSync(file).size;
    if (!data || data.size !== size) throw new GitHubError(`Envoi de ${name} incomplet (${data && data.size} octets reçus sur ${size}). Réessayez.`);
    return data;
  }

  /* Lit l'adresse fixe des mises à jour jusqu'à y trouver ce latest.json (quelques secondes
     de propagation possibles), puis vérifie que le jeu annoncé se télécharge. */
  async function verify(repo, localManifestText, { tries = 8, delayMs = 2500 } = {}) {
    const url = `${webBase}/${repo}/releases/latest/download/latest.json`;
    let last = '';
    for (let i = 0; i < tries; i++) {
      try {
        const r = await request('GET', url, { headers: { 'Cache-Control': 'no-cache' }, timeoutMs: 30000 });
        if (r.status === 200 && r.body.toString('utf8') === localManifestText) {
          const m = JSON.parse(localManifestText);
          const signed = JSON.parse(m.signed);
          if (signed.game && /^https?:/.test(signed.game.file)) {
            // premier octet seulement (les adresses de téléchargement signées n'acceptent que GET)
            const z = await request('GET', signed.game.file, { headers: { Range: 'bytes=0-0' }, timeoutMs: 30000 });
            const range = /\/(\d+)\s*$/.exec(String(z.headers['content-range'] || ''));
            const len = range ? Number(range[1]) : Number(z.headers['content-length']);
            if ((z.status !== 200 && z.status !== 206) || (Number.isFinite(len) && len !== signed.game.size)) { last = `jeu : réponse ${z.status}`; await sleep(delayMs); continue; }
          }
          return { url, verified: true };
        }
        last = `réponse ${r.status}`;
      } catch (e) { last = e.message; }
      if (i < tries - 1) await sleep(delayMs);
    }
    return { url, verified: false, detail: last };
  }

  /* Met en ligne le dossier d'une publication (latest.json + fichiers listés). */
  async function publish({ repo, branch = 'main', version, dir, files, notes = [], onProgress = () => {} }) {
    const tag = `v${version}`;
    const names = [...new Set(files)].filter((n) => n !== 'latest.json').concat('latest.json');
    for (const n of names) if (!fs.existsSync(path.join(dir, n))) throw new GitHubError(`Fichier manquant dans la publication : ${n}.`);
    onProgress({ step: 'prepare' });
    let rel = await findRelease(repo, tag);
    if (rel && !rel.draft) throw new GitHubError(`La version ${version} est déjà en ligne (${tag}). Publiez un numéro de version plus grand.`);
    const body = notes.map((n) => String(n).trim()).filter(Boolean).map((n) => `- ${n.replace(/^[-•]\s*/, '')}`).join('\n');
    if (rel) {
      rel = await api('PATCH', `/repos/${repo}/releases/${rel.id}`, { name: `Zombie Survival ${version}`, body, draft: true, target_commitish: branch }, 'reprise du brouillon');
    } else {
      rel = await api('POST', `/repos/${repo}/releases`, { tag_name: tag, target_commitish: branch, name: `Zombie Survival ${version}`, body, draft: true, prerelease: false }, 'création de la version');
    }
    for (const name of names) {
      const old = (rel.assets || []).find((a) => a.name === name);
      if (old) await api('DELETE', `/repos/${repo}/releases/assets/${old.id}`, undefined, `remplacement de ${name}`);
      await uploadAsset(rel, path.join(dir, name), name, (sent, total) => onProgress({ step: 'upload', name, sent, total }));
    }
    onProgress({ step: 'publish' });
    rel = await api('PATCH', `/repos/${repo}/releases/${rel.id}`, { draft: false, make_latest: 'true' }, 'publication');
    onProgress({ step: 'verify' });
    const check = await verify(repo, fs.readFileSync(path.join(dir, 'latest.json'), 'utf8'));
    return { tag, release: rel.html_url || `${webBase}/${repo}/releases/tag/${tag}`, ...check };
  }

  return { access, publish, verify, findRelease };
}

module.exports = { createClient, request, GitHubError, checkToken, API_BASE, WEB_BASE };
