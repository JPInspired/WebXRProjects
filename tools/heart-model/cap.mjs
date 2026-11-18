// Close the cut ends of the vessels, the way a cut blood vessel looks in a dissection.
// Trimming the vessels (build.mjs) leaves open tubes with ragged edges: from outside you could see straight into
// them, so they seemed to fade away. For each open end (a loop of boundary edges) this:
//  • tidies the edge: flattens it onto its best-fitting plane and evens out the sawtooth, so it reads as a clean cut
//  • closes it: a pale rim (the vessel wall, cut through) around a dark-red opening that dips into the vessel (the
//    lumen). Tiny holes are simply closed.
// Colours are vertex colours that multiply the part's own colour: 1 on the original surface.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));

export const CUT = {
  rim: [1.12, 1.04, 1.02], // the cut wall: a little paler than the outside
  lumenEdge: [0.5, 0.2, 0.22], // the inside wall, going down into the opening
  lumen: [0.26, 0.07, 0.09], // the dark opening
};

/** Find the boundary loops of a triangle mesh: lists of vertex indices, in the direction the triangles run. */
export function boundaryLoops(m) {
  const count = new Map();
  const k = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (let t = 0; t < m.idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const key = k(m.idx[t + e], m.idx[t + ((e + 1) % 3)]);
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const next = new Map(); // a → [b…] along boundary edges
  for (let t = 0; t < m.idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = m.idx[t + e], b = m.idx[t + ((e + 1) % 3)];
    if (count.get(k(a, b)) !== 1) continue;
    if (!next.has(a)) next.set(a, []);
    next.get(a).push(b);
  }
  const used = new Set();
  const loops = [];
  for (const start of next.keys()) {
    if (used.has(start)) continue;
    const loop = [];
    let v = start;
    let ok = false;
    for (let guard = 0; guard < 100000; guard++) {
      loop.push(v);
      used.add(v);
      const nexts = (next.get(v) ?? []).filter((w) => w === start || !used.has(w));
      if (!nexts.length) break;
      v = nexts.includes(start) && loop.length > 2 ? start : nexts[0];
      if (v === start) { ok = true; break; }
    }
    if (ok && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/**
 * Re-cut each ragged open end with one straight cut, at the bottom of its "teeth" (like trimming a vessel with
 * scissors), so the end becomes a clean ring. Only the tip of that vessel is touched: the triangles beyond the cut
 * that connect to the end, within a few radii of it. extra: cut this many radii further in (for squashed ends);
 * keep: points (the valves) the cut must stay at least keepGap away from.
 * Returns a new {pos, idx}.
 */
export function recutEnds(m, { maxDepth = 2.5, minPiece = 120, extra = 0, keep: valves = [], keepGap = 0.3 } = {}) {
  const pos = Array.from(m.pos);
  let idx = Array.from(m.idx);
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const nv0 = pos.length / 3;
  const nbr = Array.from({ length: nv0 }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = idx[t + e], b = idx[t + ((e + 1) % 3)];
    nbr[a].add(b);
    nbr[b].add(a);
  }
  for (const loop of boundaryLoops(m)) {
    const onLoop = new Set(loop);
    let c = [0, 0, 0];
    for (const v of loop) c = add(c, P(v));
    c = mul(c, 1 / loop.length);
    let r = 0;
    for (const v of loop) r += len(sub(P(v), c));
    r /= loop.length;
    // the vessel's direction here: from a ring of the tube further in, out to the end
    const ring = new Set();
    let front = new Set(loop);
    const seen = new Set(loop);
    for (let step = 0; step < 40 && front.size; step++) {
      const nextFront = new Set();
      for (const v of front) for (const w of nbr[v]) if (!seen.has(w)) { seen.add(w); nextFront.add(w); }
      front = nextFront;
      for (const w of front) { const d = len(sub(P(w), c)); if (d > 1.6 * r && d < 2.6 * r) ring.add(w); }
      if (ring.size > 30) break;
    }
    if (!ring.size) continue;
    let c2 = [0, 0, 0];
    for (const v of ring) c2 = add(c2, P(v));
    c2 = mul(c2, 1 / ring.size);
    const out = norm(sub(c, c2));
    const h = (v) => dot(sub(P(v), c), out);
    let d = Math.min(...loop.map(h));
    d = Math.max(d, -maxDepth * r) - extra * r; // never too deep; extra: trim a little further in
    for (const k of valves) d = Math.max(d, dot(sub(k, c), out) + keepGap); // and never close to a valve
    // the tip: everything beyond the cut that connects to this end, close to it
    const tip = new Set();
    const stack = loop.filter((v) => h(v) > d);
    for (const v of stack) tip.add(v);
    while (stack.length) {
      const v = stack.pop();
      for (const w of nbr[v]) {
        if (tip.has(w) || w >= nv0) continue;
        if (h(w) > d && len(sub(P(w), c)) < 6 * r) { tip.add(w); stack.push(w); }
      }
    }
    if (!tip.size) continue;
    // cut: drop triangles wholly in the tip; split those that cross the cut
    const cutVert = new Map();
    const onCut = (a, b) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (cutVert.has(key)) return cutVert.get(key);
      const ha = h(a), hb = h(b);
      // (clamped: a neighbour just outside the tip may also lie a little beyond the cut)
      const t = Math.abs(hb - ha) < 1e-9 ? 0.5 : Math.min(1, Math.max(0, (d - ha) / (hb - ha)));
      const p = add(P(a), mul(sub(P(b), P(a)), t));
      pos.push(...p);
      const id = pos.length / 3 - 1;
      cutVert.set(key, id);
      return id;
    };
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      const beyond = tri.map((v) => tip.has(v));
      const nb = beyond.filter(Boolean).length;
      if (nb === 0) { keep.push(...tri); continue; }
      if (nb === 3) continue;
      // rotate so the odd one out comes first, keeping the winding
      let k = nb === 1 ? beyond.indexOf(true) : beyond.indexOf(false);
      const [a, b, cc] = [tri[k], tri[(k + 1) % 3], tri[(k + 2) % 3]];
      if (nb === 1) { // a is beyond: keep the quad b, cc, cut(cc,a), cut(a,b)
        const ab = onCut(a, b), ca = onCut(cc, a);
        keep.push(ab, b, cc, ab, cc, ca);
      } else { // only a stays: keep a, cut(a,b), cut(cc,a)
        keep.push(a, onCut(a, b), onCut(cc, a));
      }
    }
    idx = keep;
  }
  // drop loose scraps left by the cuts (small pieces no longer joined to the vessel)
  {
    const parent = new Int32Array(pos.length / 3).map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]); parent[find(idx[t + 1])] = a; parent[find(idx[t + 2])] = a; }
    const size = new Map();
    for (let t = 0; t < idx.length; t += 3) { const k = find(idx[t]); size.set(k, (size.get(k) ?? 0) + 1); }
    const kept = [];
    for (let t = 0; t < idx.length; t += 3) if (size.get(find(idx[t])) >= minPiece) kept.push(idx[t], idx[t + 1], idx[t + 2]);
    idx = kept;
  }
  // drop the vertices no longer used
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const np = [];
  const ni = idx.map((v) => {
    if (remap[v] < 0) { remap[v] = np.length / 3; np.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    return remap[v];
  });
  return { pos: new Float32Array(np), idx: new Uint32Array(ni) };
}

/**
 * Close every open end of mesh m ({pos, idx}). Returns {pos, idx, col, ends} with the caps added.
 * opts.tiny: holes smaller than this radius are just closed; opts.depth: how far the opening dips in (× radius).
 */
export function capOpenEnds(m, { tiny = 0.006, depth = 0.45, flatten = true } = {}) {
  const pos = Array.from(m.pos);
  const idx = Array.from(m.idx);
  const nv0 = pos.length / 3;
  const col = new Array(nv0 * 3).fill(1);
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const setP = (v, p) => { pos[v * 3] = p[0]; pos[v * 3 + 1] = p[1]; pos[v * 3 + 2] = p[2]; };
  // neighbours, to tell which side of an end is inside the vessel
  const nbr = Array.from({ length: nv0 }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = idx[t + e], b = idx[t + ((e + 1) % 3)];
    nbr[a].add(b);
    nbr[b].add(a);
  }
  const vert = (p, c) => { pos.push(...p); col.push(...c); return pos.length / 3 - 1; };
  const ends = [];
  for (const loop of boundaryLoops(m)) {
    const n = loop.length;
    let c = [0, 0, 0];
    for (const v of loop) c = add(c, P(v));
    c = mul(c, 1 / n);
    // plane normal (Newell), and the outward direction: away from the rest of the vessel
    let nm = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const a = P(loop[i]), b = P(loop[(i + 1) % n]);
      nm = add(nm, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
    }
    nm = norm(nm);
    const onLoop = new Set(loop);
    let inner = [0, 0, 0], ni = 0;
    for (const v of loop) for (const w of nbr[v]) if (!onLoop.has(w)) { inner = add(inner, P(w)); ni++; }
    if (ni) inner = mul(inner, 1 / ni); else inner = c;
    const out = dot(sub(c, inner), nm) >= 0 ? nm : mul(nm, -1);
    let r = 0;
    for (const v of loop) r += len(sub(P(v), c));
    r /= n;
    let off = 0;
    for (const v of loop) off = Math.max(off, Math.abs(dot(sub(P(v), c), nm)));
    const planar = off / (r || 1);
    ends.push({ n, r, planar, c });
    if (!Number.isFinite(r) || r > 0.3) continue; // not a vessel end (a safety net: leave it open)

    // tidy the edge: onto the plane, and an even radius (a gently smoothed outline)
    if (flatten && r >= tiny && planar < 1.2) {
      const pts = loop.map((v) => { const p = P(v); return sub(p, mul(nm, dot(sub(p, c), nm))); });
      let rad = pts.map((p) => len(sub(p, c)));
      for (let it = 0; it < 4; it++) rad = rad.map((x, i) => (rad[(i + n - 1) % n] + 2 * x + rad[(i + 1) % n]) / 4);
      loop.forEach((v, i) => {
        const d = norm(sub(pts[i], c));
        const target = add(c, mul(d, rad[i]));
        setP(v, target);
        // ease the first ring inside towards the cut, so the tube doesn't kink
        for (const w of nbr[v]) {
          if (onLoop.has(w)) continue;
          const q = P(w);
          const h = dot(sub(q, c), out);
          if (h > 0) setP(w, sub(q, mul(out, h * 0.5)));
        }
      });
    }

    // close it
    const ring0 = loop.map((v) => vert(P(v), CUT.rim));
    const centre = (k) => add(c, mul(out, -depth * r * k));
    if (r < tiny) {
      const cv = vert(c, CUT.rim);
      for (let i = 0; i < n; i++) idx.push(ring0[(i + 1) % n], ring0[i], cv);
      continue;
    }
    const at = (i, s, k) => add(centre(k), mul(sub(P(loop[i]), c), s));
    const ring1 = loop.map((_, i) => vert(at(i, 0.78, 0), CUT.rim)); // the inside of the wall
    const ring1L = loop.map((_, i) => vert(at(i, 0.78, 0), CUT.lumenEdge));
    const ring2 = loop.map((_, i) => vert(at(i, 0.62, 0.55), CUT.lumen));
    const cv = vert(centre(0.8), CUT.lumen);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(ring0[j], ring0[i], ring1[i], ring0[j], ring1[i], ring1[j]); // the rim
      idx.push(ring1L[j], ring1L[i], ring2[i], ring1L[j], ring2[i], ring2[j]); // down into the opening
      idx.push(ring2[j], ring2[i], cv);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), col: new Float32Array(col), ends };
}
