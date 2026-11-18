// Last touches to the heart model (after the cut ends are closed, cap.mjs):
//  • dropFloating: removes small pieces of vessel left hanging in the air by the trimming (not touching the heart
//    wall, another vessel or the rest of their own vessel)
//  • fatAmount: how much epicardial fat covers each point of the heart's outer surface. In a real heart, yellowish
//    fat fills the grooves where the coronary arteries and cardiac veins run; here it follows those vessels.
//    Stored per vertex (0–1) as the custom attribute _FAT; the lesson blends it in (realistic look only).

const cellKey = (x, y, z, cell) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
/** A spatial hash of points, for "how far to the nearest point". */
export function pointGrid(pointLists, cell = 0.04) {
  const g = new Map();
  for (const pos of pointLists) for (let i = 0; i < pos.length; i += 3) {
    const k = cellKey(pos[i], pos[i + 1], pos[i + 2], cell);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(pos[i], pos[i + 1], pos[i + 2]);
  }
  const nearest = (x, y, z, max) => {
    let best = max, bx = 0, by = 0, bz = 0;
    const R = Math.ceil(max / cell), cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) for (let c = -R; c <= R; c++) {
      const list = g.get(`${cx + a},${cy + b},${cz + c}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i += 3) {
        const d = Math.hypot(list[i] - x, list[i + 1] - y, list[i + 2] - z);
        if (d < best) { best = d; bx = list[i]; by = list[i + 1]; bz = list[i + 2]; }
      }
    }
    return { d: best, p: [bx, by, bz] };
  };
  return { nearest };
}

/** Connected pieces of a mesh (vertices at the same place count as joined: the closed ends are separate vertices). */
function pieces(m) {
  const n = m.pos.length / 3;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  for (let t = 0; t < m.idx.length; t += 3) { join(m.idx[t], m.idx[t + 1]); join(m.idx[t], m.idx[t + 2]); }
  const at = new Map();
  for (let v = 0; v < n; v++) {
    const k = `${m.pos[v * 3].toFixed(5)},${m.pos[v * 3 + 1].toFixed(5)},${m.pos[v * 3 + 2].toFixed(5)}`;
    if (at.has(k)) join(v, at.get(k)); else at.set(k, v);
  }
  const out = new Map();
  for (let t = 0; t < m.idx.length; t += 3) {
    const r = find(m.idx[t]);
    if (!out.has(r)) out.set(r, []);
    out.get(r).push(t);
  }
  return [...out.values()]; // lists of triangle offsets
}

/** Keep only the triangles listed (offsets into idx), dropping unused vertices (and their colours). */
function keepTris(m, tris) {
  const remap = new Int32Array(m.pos.length / 3).fill(-1);
  const pos = [], col = [], idx = [];
  for (const t of tris) for (let e = 0; e < 3; e++) {
    const v = m.idx[t + e];
    if (remap[v] < 0) {
      remap[v] = pos.length / 3;
      pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
      if (m.col) col.push(m.col[v * 3], m.col[v * 3 + 1], m.col[v * 3 + 2]);
    }
    idx.push(remap[v]);
  }
  return { ...m, pos: new Float32Array(pos), idx: new Uint32Array(idx), col: m.col ? new Float32Array(col) : undefined };
}

/**
 * Remove vessel pieces floating in the air. parts: {id: mesh}; vessels: the ids to check; gap: how close a piece must
 * come to something else (the wall, another vessel, or the rest of its own vessel) to count as attached.
 * Returns a log of what was removed.
 */
export function dropFloating(parts, vessels, gap = 0.012) {
  const log = [];
  for (const id of vessels) {
    const m = parts[id];
    const list = pieces(m);
    const total = m.idx.length / 3;
    const keep = [];
    for (const tris of list) {
      if (tris.length > total * 0.5) { keep.push(...tris); continue; } // the main piece
      const inPiece = new Set();
      for (const t of tris) for (let e = 0; e < 3; e++) inPiece.add(m.idx[t + e]);
      // everything else: other parts, and the rest of this one
      const restOwn = [];
      for (let t = 0; t < m.idx.length; t += 3) if (!tris.includes(t)) for (let e = 0; e < 3; e++) { const v = m.idx[t + e]; restOwn.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); }
      const grid = pointGrid([...Object.entries(parts).filter(([k]) => k !== id).map(([, p]) => p.pos), restOwn]);
      let d = Infinity;
      for (const v of inPiece) {
        d = Math.min(d, grid.nearest(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2], 0.1).d);
        if (d <= gap) break;
      }
      if (d <= gap) keep.push(...tris);
      else log.push(`${id}: removed a floating piece of ${tris.length} triangles (${(d * 100).toFixed(1)} mm from anything)`);
    }
    if (keep.length !== m.idx.length / 3) parts[id] = keepTris(m, keep.sort((a, b) => a - b));
  }
  return log;
}

/**
 * Epicardial fat on the heart wall m ({pos, idx}, normals nrm), 0–1 per vertex. Most of it fills the grooves: where
 * one chamber meets another on the outside (grooveGrid: the other chambers' surfaces), which is where the main
 * coronary vessels run; a thinner trace follows the vessels themselves (vesselGrid). Only on the outer surface (the
 * side a vessel lies on), so the chambers' insides stay muscle.
 */
export function fatAmount(m, nrm, vesselGrid, grooveGrid, { reach = 0.1, smoothing = 6 } = {}) {
  const n = m.pos.length / 3;
  const fat = new Float32Array(n);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let v = 0; v < n; v++) {
    const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2];
    const { d, p } = vesselGrid.nearest(x, y, z, reach);
    if (d >= reach) continue; // no vessel nearby: not a groove, or not the outside
    const dx = p[0] - x, dy = p[1] - y, dz = p[2] - z;
    const l = Math.hypot(dx, dy, dz) || 1;
    const facing = smooth(-0.3, 0.3, (nrm[v * 3] * dx + nrm[v * 3 + 1] * dy + nrm[v * 3 + 2] * dz) / l);
    const groove = grooveGrid ? 1 - smooth(0.02, 0.1, grooveGrid.nearest(x, y, z, 0.1).d) : 0;
    const alongVessel = 1 - smooth(0.008, 0.035, d);
    fat[v] = Math.max(groove * (1 - smooth(0.04, reach, d)), 0.35 * alongVessel) * facing;
  }
  // soften it across the surface, so it fades gently instead of following the triangles
  const nbr = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < m.idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = m.idx[t + e], b = m.idx[t + ((e + 1) % 3)]; nbr[a].add(b); nbr[b].add(a); }
  let cur = fat;
  for (let it = 0; it < smoothing; it++) {
    const next = new Float32Array(n);
    for (let v = 0; v < n; v++) { let s = cur[v] * 2, w = 2; for (const u of nbr[v]) { s += cur[u]; w++; } next[v] = s / w; }
    cur = next;
  }
  return cur;
}
