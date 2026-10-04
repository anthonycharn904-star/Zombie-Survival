'use strict';
/* Faux GitHub pour les essais : l'API des releases (dépôt, versions, envoi de fichiers) et
   les adresses de téléchargement, dont l'adresse fixe …/releases/latest/download/<fichier>.
   Noms de dépôt insensibles à la casse, comme sur GitHub. */
const http = require('http');

function fakeGitHub({ token = 'github_pat_essai_0123456789abcdef', owner = 'Anthony', name = 'Zombie-Survival', push = true, isPrivate = false, tokenWrite = true } = {}) {
  const st = { releases: [], nextId: 1, nextAsset: 1000, uploads: [], failNext: null, deleted: 0, token, push, isPrivate, owner, name, tokenWrite };
  const full = () => `${st.owner}/${st.name}`;
  const isRepo = (o, r) => `${o}/${r}`.toLowerCase() === full().toLowerCase();
  let base = '';
  const send = (res, code, data, headers = {}) => {
    const body = data === undefined ? '' : Buffer.isBuffer(data) ? data : JSON.stringify(data);
    res.writeHead(code, { 'Content-Type': Buffer.isBuffer(data) ? 'application/octet-stream' : 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers });
    res.end(body);
  };
  const pub = (r) => ({
    id: r.id, tag_name: r.tag_name, name: r.name, body: r.body, draft: r.draft, prerelease: false,
    html_url: `${base}/${full()}/releases/tag/${r.tag_name}`,
    upload_url: `${base}/uploads/repos/${full()}/releases/${r.id}/assets{?name,label}`,
    assets: r.assets.map((a) => ({ id: a.id, name: a.name, size: a.data.length, state: 'uploaded' })),
  });
  const latest = () => [...st.releases].reverse().find((r) => !r.draft && r.latest !== false);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const json = () => { try { return JSON.parse(raw.toString('utf8') || '{}'); } catch (e) { return {}; } };
      // ---- téléchargements publics (sans jeton)
      if (p[0] === 'dl') {
        const a = st.releases.flatMap((r) => r.assets).find((x) => String(x.id) === p[1]);
        if (!a) return send(res, 404, { message: 'Not Found' });
        if (req.method === 'HEAD') { res.writeHead(200, { 'Content-Length': a.data.length }); return res.end(); }
        return send(res, 200, a.data);
      }
      if (p.length >= 5 && p[2] === 'releases' && (p[3] === 'latest' || p[3] === 'download') && isRepo(p[0], p[1])) {
        let rel, file;
        if (p[3] === 'latest' && p[4] === 'download') { rel = latest(); file = p[5]; } else { rel = st.releases.find((r) => !r.draft && r.tag_name === p[4]); file = p[5]; }
        const a = rel && rel.assets.find((x) => x.name === file);
        if (!a) return send(res, 404, { message: 'Not Found' });
        return send(res, 302, undefined, { Location: `${base}/dl/${a.id}` });
      }
      // ---- API (jeton obligatoire)
      if (req.headers.authorization !== `Bearer ${st.token}`) return send(res, 401, { message: 'Bad credentials' });
      if (p[0] === 'user') return send(res, 200, { login: st.owner });
      if (p[0] === 'uploads') {
        const rel = st.releases.find((r) => String(r.id) === p[5]);
        const nameQ = u.searchParams.get('name');
        if (!rel || !isRepo(p[2], p[3])) return send(res, 404, { message: 'Not Found' });
        if (st.failNext && st.failNext === nameQ) { st.failNext = null; return send(res, 500, { message: 'Server Error' }); }
        if (rel.assets.some((a) => a.name === nameQ)) return send(res, 422, { message: 'Validation Failed', errors: [{ code: 'already_exists' }] });
        if (Number(req.headers['content-length']) !== raw.length) return send(res, 400, { message: 'Bad length' });
        const a = { id: st.nextAsset++, name: nameQ, data: raw };
        rel.assets.push(a);
        st.uploads.push({ name: nameQ, draft: rel.draft });
        return send(res, 201, { id: a.id, name: a.name, size: raw.length, state: 'uploaded' });
      }
      if (p[0] !== 'repos') return send(res, 404, { message: 'Not Found' });
      if (!isRepo(p[1], p[2])) return send(res, 404, { message: 'Not Found' });
      if (p.length === 3 && req.method === 'GET') {
        return send(res, 200, { full_name: full(), default_branch: 'main', private: st.isPrivate, permissions: { admin: false, push: st.push, pull: true } });
      }
      if (p[3] === 'releases' && p.length === 4 && req.method === 'GET') {
        const page = Number(u.searchParams.get('page') || 1);
        return send(res, 200, page === 1 ? [...st.releases].reverse().map(pub) : []);
      }
      if (p[3] === 'releases' && p.length === 4 && req.method === 'POST') {
        if (!st.push || !st.tokenWrite) return send(res, 403, { message: 'Resource not accessible by personal access token' });
        const b = json();
        if (st.releases.some((r) => r.tag_name === b.tag_name && !r.draft)) return send(res, 422, { message: 'Validation Failed', errors: [{ code: 'already_exists', field: 'tag_name' }] });
        const r = { id: st.nextId++, tag_name: b.tag_name, name: b.name, body: b.body, draft: b.draft !== false, assets: [] };
        st.releases.push(r);
        return send(res, 201, pub(r));
      }
      if (p[3] === 'releases' && p[4] === 'assets' && req.method === 'DELETE') {
        for (const r of st.releases) r.assets = r.assets.filter((a) => String(a.id) !== p[5]);
        return send(res, 204);
      }
      if (p[3] === 'releases' && p.length === 5 && req.method === 'DELETE') {
        const before = st.releases.length;
        st.releases = st.releases.filter((x) => String(x.id) !== p[4]);
        st.deleted += before - st.releases.length;
        return send(res, 204);
      }
      if (p[3] === 'releases' && p.length === 5 && req.method === 'PATCH') {
        const r = st.releases.find((x) => String(x.id) === p[4]);
        if (!r) return send(res, 404, { message: 'Not Found' });
        const b = json();
        for (const k of ['name', 'body', 'draft']) if (k in b) r[k] = b[k];
        if (b.make_latest === 'true') { for (const x of st.releases) x.latest = x === r; }
        return send(res, 200, pub(r));
      }
      return send(res, 404, { message: 'Not Found' });
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve({ server, state: st, base, repo: full(), close: () => new Promise((r) => server.close(r)) });
  }));
}

module.exports = { fakeGitHub };
