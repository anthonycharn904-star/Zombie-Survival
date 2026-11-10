# Réparation après décimation : le décimateur pince parfois une paroi très fine (coin interne des paupières) en
# une arête partagée par 4 triangles. On sépare chaque sommet pincé en autant de copies que d'éventails de
# triangles indépendants autour de lui, puis on écarte chaque copie de 0,03 mm vers son propre éventail :
# chaque arête est alors partagée par exactement deux triangles (maillage fermé et manifold).
import numpy as np


def edge_counts(f):
    E = np.sort(np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]]), axis=1)
    u, c = np.unique(E, axis=0, return_counts=True)
    return u, c


def weld_close(v, f, tol=0.01):
    """Soude les sommets distants de moins de tol (mm) : le marching cubes laisse des paires de sommets quasi
    confondus (< 4 µm) que la quantification du contrat fusionnerait en triangles dégénérés. Supprime ensuite
    les triangles dégénérés et les paires de triangles superposés."""
    from scipy.spatial import cKDTree
    pairs = cKDTree(v).query_pairs(tol, output_type='ndarray')
    parent = np.arange(len(v))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)
    root = np.array([find(i) for i in range(len(v))])
    used, remap = np.unique(root, return_inverse=True)
    v2 = v[used]
    f2 = remap[f]
    keep = (f2[:, 0] != f2[:, 1]) & (f2[:, 1] != f2[:, 2]) & (f2[:, 0] != f2[:, 2])
    f2 = f2[keep]
    key = np.sort(f2, axis=1)
    _, first, cnt = np.unique(key, axis=0, return_index=True, return_counts=True)
    dup = set(map(tuple, np.unique(key, axis=0)[cnt > 1]))
    if dup:
        f2 = f2[[tuple(k) not in dup for k in key]]
    # sommets devenus inutilisés
    usedv, rem2 = np.unique(f2, return_inverse=True)
    return v2[usedv], rem2.reshape(-1, 3), len(pairs), int((~keep).sum()), len(dup)


def fix_nonmanifold(v, f, push=0.03, log=True):
    v, f, npairs, ndeg, ndup = weld_close(v, f)
    if log:
        print(f'soudure : {npairs} paires de sommets quasi confondus, {ndeg} triangles dégénérés et {ndup} paires superposées retirés')
    v = v.copy(); f = f.copy()
    for it in range(4):
        u, c = edge_counts(f)
        bad = u[c > 2]
        if len(bad) == 0:
            break
        badset = set(map(tuple, bad))
        verts = np.unique(bad)
        vf = {}
        for fi, tri in enumerate(f):
            for k in range(3):
                if tri[k] in verts:
                    vf.setdefault(int(tri[k]), []).append(fi)
        n_split = 0
        for vi in verts:
            faces = vf[int(vi)]
            # composantes : deux triangles du parapluie sont liés s'ils partagent une arête manifold issue de vi
            parent = {fi: fi for fi in faces}
            def find(a):
                while parent[a] != a:
                    parent[a] = parent[parent[a]]; a = parent[a]
                return a
            by_edge = {}
            for fi in faces:
                for w in f[fi]:
                    if w == vi:
                        continue
                    e = (min(vi, w), max(vi, w))
                    by_edge.setdefault(e, []).append(fi)
            for e, fl in by_edge.items():
                if e in badset or len(fl) != 2:
                    continue
                a, b = find(fl[0]), find(fl[1])
                if a != b:
                    parent[a] = b
            groups = {}
            for fi in faces:
                groups.setdefault(find(fi), []).append(fi)
            if len(groups) < 2:
                continue
            p0 = v[vi].copy()
            for gi, fl in enumerate(sorted(groups.values(), key=len, reverse=True)):
                others = [w for fi in fl for w in f[fi] if w != vi]
                cen = v[others].mean(0)
                dvec = cen - p0
                dvec = dvec / (np.linalg.norm(dvec) + 1e-12) * push
                if gi == 0:
                    v[vi] = p0 + dvec
                    continue
                nid = len(v)
                v = np.vstack([v, (p0 + dvec)[None, :]])
                for fi in fl:
                    f[fi][f[fi] == vi] = nid
                n_split += 1
        if log:
            print(f'réparation manifold : {len(bad)} arêtes pincées, {n_split} sommets dédoublés')
    u, c = edge_counts(f)
    return v, f, int((c == 1).sum()), int((c > 2).sum())


if __name__ == '__main__':
    import sys, fast_simplification
    d = np.load(sys.argv[1]); v, f = d['v'], d['f']
    red = 1.0 - 15000 / len(f)
    v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=red, agg=6)
    v3, f3, b, nm = fix_nonmanifold(v2.astype(np.float64), f2.astype(np.int64))
    print('après : bords', b, 'non manifold', nm, 'sommets', len(v3), 'triangles', len(f3))
