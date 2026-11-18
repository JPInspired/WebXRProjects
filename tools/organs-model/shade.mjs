// Adds soft shadows in the folds (ambient occlusion) to body.glb: the grooves of the brain, the coils of the
// intestines, the gaps between bones and ribs. For each point of each surface, it checks how much of the space
// around it is blocked by the same part (each organ on its own, so it looks right on the desk and in the body;
// the skeleton's pieces together). Stored per vertex (0 = fully hidden, 1 = open) as the custom attribute _AO;
// the lesson darkens the colour with it.
// usage (after build.mjs): node shade.mjs ../../lessons/organs-lab/models/body.glb [out.glb]
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [, , input, output = input] = process.argv;
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
await doc.transform(dequantize());

const SKELETON = ['bones', 'ribcage', 'skullcap'];
const VOXEL = 0.003; // m
const REACH = 0.045; // how far a fold can shade (m)
const RAYS = 24;

const apply = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

// every mesh, in body coordinates
const parts = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const W = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL');
    const n = P.getCount();
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    const e = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      P.getElement(i, e);
      pos.set(apply(W, e[0], e[1], e[2]), i * 3);
      N.getElement(i, e);
      const [a, b, c] = [W[0] * e[0] + W[4] * e[1] + W[8] * e[2], W[1] * e[0] + W[5] * e[1] + W[9] * e[2], W[2] * e[0] + W[6] * e[1] + W[10] * e[2]];
      const l = Math.hypot(a, b, c) || 1;
      nrm.set([a / l, b / l, c / l], i * 3);
    }
    parts.push({ name: node.getName(), prim, pos, nrm, idx: prim.getIndices().getArray() });
  }
}

/** A grid of the cells the surfaces pass through. */
function occupancy(list) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of list) for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], p.pos[i + k]); max[k] = Math.max(max[k], p.pos[i + k]);
  }
  for (let k = 0; k < 3; k++) { min[k] -= REACH; max[k] += REACH; }
  const dim = min.map((v, k) => Math.ceil((max[k] - v) / VOXEL) + 1);
  const grid = new Uint8Array(dim[0] * dim[1] * dim[2]);
  const mark = (x, y, z) => {
    const i = Math.floor((x - min[0]) / VOXEL), j = Math.floor((y - min[1]) / VOXEL), k = Math.floor((z - min[2]) / VOXEL);
    grid[i + dim[0] * (j + dim[1] * k)] = 1;
  };
  for (const p of list) {
    const { pos, idx } = p;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ab = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
      const ac = Math.hypot(pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]);
      const steps = Math.max(1, Math.ceil(Math.max(ab, ac) / (VOXEL * 0.5)));
      for (let u = 0; u <= steps; u++) for (let v = 0; v <= steps - u; v++) {
        const s = u / steps, r = v / steps, q = 1 - s - r;
        mark(q * pos[a] + s * pos[b] + r * pos[c], q * pos[a + 1] + s * pos[b + 1] + r * pos[c + 1], q * pos[a + 2] + s * pos[b + 2] + r * pos[c + 2]);
      }
    }
  }
  const hit = (x, y, z) => {
    const i = Math.floor((x - min[0]) / VOXEL), j = Math.floor((y - min[1]) / VOXEL), k = Math.floor((z - min[2]) / VOXEL);
    if (i < 0 || j < 0 || k < 0 || i >= dim[0] || j >= dim[1] || k >= dim[2]) return false;
    return grid[i + dim[0] * (j + dim[1] * k)] === 1;
  };
  return hit;
}

// the same set of directions for every point (evenly spread, cosine-weighted around +z)
const DIRS = [];
for (let r = 0; r < RAYS; r++) {
  const u = (r + 0.5) / RAYS, phi = r * 2.399963;
  const s = Math.sqrt(u);
  DIRS.push([s * Math.cos(phi), s * Math.sin(phi), Math.sqrt(1 - u)]);
}

function bake(p, hit) {
  const n = p.pos.length / 3;
  const ao = new Float32Array(n);
  const start = VOXEL * 2.2, step = VOXEL * 0.8;
  for (let v = 0; v < n; v++) {
    const x = p.pos[v * 3], y = p.pos[v * 3 + 1], z = p.pos[v * 3 + 2];
    const nz = [p.nrm[v * 3], p.nrm[v * 3 + 1], p.nrm[v * 3 + 2]];
    // a frame around the normal
    const t0 = Math.abs(nz[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let tx = [nz[1] * t0[2] - nz[2] * t0[1], nz[2] * t0[0] - nz[0] * t0[2], nz[0] * t0[1] - nz[1] * t0[0]];
    const tl = Math.hypot(...tx); tx = tx.map((c) => c / tl);
    const ty = [nz[1] * tx[2] - nz[2] * tx[1], nz[2] * tx[0] - nz[0] * tx[2], nz[0] * tx[1] - nz[1] * tx[0]];
    let open = 0;
    for (const [a, b, c] of DIRS) {
      const dx = tx[0] * a + ty[0] * b + nz[0] * c, dy = tx[1] * a + ty[1] * b + nz[1] * c, dz = tx[2] * a + ty[2] * b + nz[2] * c;
      let blocked = 0;
      for (let d = start; d < REACH; d += step) {
        if (hit(x + dx * d, y + dy * d, z + dz * d)) { blocked = 1 - (d / REACH) ** 2 * 0.6; break; } // nearer = darker
      }
      open += 1 - blocked;
    }
    ao[v] = open / RAYS;
  }
  // soften across the surface
  const nbr = Array.from({ length: n }, () => []);
  for (let t = 0; t < p.idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = p.idx[t + e], b = p.idx[t + ((e + 1) % 3)]; nbr[a].push(b); nbr[b].push(a); }
  let cur = ao;
  for (let it = 0; it < 2; it++) {
    const next = new Float32Array(n);
    for (let v = 0; v < n; v++) { let s = cur[v] * 2, w = 2; for (const u of nbr[v]) { s += cur[u]; w++; } next[v] = s / w; }
    cur = next;
  }
  return cur;
}

const groups = [parts.filter((p) => SKELETON.includes(p.name)), ...parts.filter((p) => !SKELETON.includes(p.name)).map((p) => [p])];
const buffer = doc.getRoot().listBuffers()[0];
for (const g of groups) {
  const t0 = Date.now();
  const hit = occupancy(g);
  for (const p of g) {
    const ao = bake(p, hit);
    p.prim.setAttribute('_AO', doc.createAccessor().setType('SCALAR').setArray(ao).setBuffer(buffer));
    let s = 0; for (const a of ao) s += a;
    console.log(`${p.name.padEnd(16)} ${String(ao.length).padStart(6)} points, average ${(s / ao.length).toFixed(2)} (${Date.now() - t0} ms)`);
  }
}

await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, doc);
console.log('wrote', output);
