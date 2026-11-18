import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 3D organelles built from simple shapes, sized in metres for the displayed cell.
// `clip` is the cutting plane that opens the cell; only "shell" materials use it, so organelles stay whole.

export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An organelle's surface: soft and slightly glossy, like the wet surfaces in a cell. */
export const mat = (color, opts = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35, ...opts });

/**
 * Membranes seen edge-on look darker and denser (as in a microscope image and in textbook drawings): brighter,
 * more solid where the surface turns away from you, clear where you look straight through it.
 */
export function rimmed(m, rim = 1) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rim };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;')
      .replace('#include <opaque_fragment>', `
        float edgeOn = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2) * uRim;
        outgoingLight = mix(outgoingLight, outgoingLight * 1.5 + diffuseColor.rgb * 0.15, edgeOn);
        diffuseColor.a = clamp(diffuseColor.a + edgeOn * 0.55, 0.0, 1.0);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'cell-rim';
  return m;
}

/** A see-through shell (membrane, wall, envelope…) that is cut open by the clipping plane. */
export const shellMat = (color, opacity, clip) => rimmed(new THREE.MeshStandardMaterial({
  color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, roughness: 0.4, clippingPlanes: [clip],
}));

/** A sphere with a gently uneven surface (real cells are never perfect balls). Same seed → same shape. */
export function blobSphere(r, amp, seed, w = 64, h = 48) {
  const g = new THREE.SphereGeometry(r, w, h);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  const k = seed * 1.7;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const d = Math.sin(v.x * 2.3 + k) * Math.sin(v.y * 1.9 + k * 0.7) + 0.6 * Math.sin(v.z * 3.1 + v.x * 1.3 + k * 1.3) + 0.35 * Math.sin(v.y * 4.7 - v.z * 2.1 + k);
    v.multiplyScalar(r * (1 + amp * d));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Random direction / point helpers */
export function randomInSphere(rand, r) {
  for (;;) {
    const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (v.lengthSq() <= 1) return v.multiplyScalar(r);
  }
}

export function orientRandom(obj, rand) {
  obj.rotation.set(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2);
}

// ── organelles ─────────────────────────────────────────

export function nucleus(r, clip, rand) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), shellMat(0x8e6cc4, 0.55, clip)));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.94, 48, 32), shellMat(0x6c4aa8, 0.35, clip)));
  // nucleoplasm
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 32, 24), shellMat(0xd9c8f5, 0.18, clip)));
  const nucleolus = new THREE.Mesh(blobSphere(r * 0.3, 0.12, 3, 32, 24), mat(0x4b2a7a, { roughness: 0.75, clearcoat: 0.1 }));
  nucleolus.position.set(r * 0.2, r * 0.15, -r * 0.2);
  g.add(nucleolus);
  // chromatin threads
  const chromMat = mat(0xb08ee0);
  for (let i = 0; i < 6; i++) {
    const pts = [];
    let p = randomInSphere(rand, r * 0.6);
    for (let k = 0; k < 6; k++) {
      pts.push(p.clone());
      p = p.add(randomInSphere(rand, r * 0.3)).clampLength(0, r * 0.8);
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r * 0.025, 6), chromMat));
  }
  // chromatin granules: denser (heterochromatin) in patches against the envelope, as in a microscope image
  const grains = [];
  while (grains.length < 260) {
    const d = randomInSphere(rand, 1);
    if (d.lengthSq() < 0.05) continue;
    const near = rand() < 0.65;
    const p = d.normalize().multiplyScalar(r * (near ? 0.8 + rand() * 0.1 : 0.2 + rand() * 0.6));
    if (p.distanceTo(nucleolus.position) < r * 0.36) continue;
    grains.push(p);
  }
  const gm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(r * 0.03, 0), mat(0x7a55b8, { roughness: 0.8, clearcoat: 0 }), grains.length);
  const dm = new THREE.Object3D();
  grains.forEach((p, i) => { dm.position.copy(p); dm.scale.setScalar(0.6 + rand() * 0.9); dm.updateMatrix(); gm.setMatrixAt(i, dm.matrix); });
  g.add(gm);
  // nuclear pores
  const poreMat = mat(0x3d2566);
  for (let i = 0; i < 26; i++) {
    const d = randomInSphere(rand, 1).normalize();
    if (d.z > 0.05) d.z *= -1; // keep them on the visible back half
    const pore = new THREE.Mesh(new THREE.TorusGeometry(r * 0.06, r * 0.018, 6, 12), poreMat);
    pore.position.copy(d.multiplyScalar(r));
    pore.lookAt(0, 0, 0);
    g.add(pore);
  }
  return g;
}

export function mitochondrion(r, len) {
  const g = new THREE.Group();
  // the matrix inside, then the folded inner membrane (cristae), then the see-through outer membrane
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.8, len, 6, 14), mat(0xf7b07a, { roughness: 0.7, clearcoat: 0, transparent: true, opacity: 0.3, depthWrite: false })));
  g.add(new THREE.Mesh(cristae(r, len), mat(0xc4501f)));
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 18), rimmed(mat(0xe8743b, { transparent: true, opacity: 0.22, depthWrite: false }), 1.4)));
  g.userData.glow = true;
  return g;
}

/** The inner membrane of a mitochondrion: rounded folds (cristae) reaching in from alternate sides, as in a textbook drawing. */
function cristae(r, len) {
  const n = Math.max(4, Math.round(len / (r * 0.6)));
  const parts = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const y = -len / 2 - r * 0.2 + ((i + 0.5) / n) * (len + r * 0.4);
    const over = Math.max(0, Math.abs(y) - len / 2);
    const inside = Math.sqrt(Math.max(0, (r * 0.8) ** 2 - over * over)); // the room across, at this height
    if (inside < r * 0.3) continue;
    const reach = inside * 1.25; // how far the fold reaches across (from the wall, past the middle)
    const fold = new THREE.SphereGeometry(1, 16, 10);
    fold.scale(reach / 2, r * 0.11, inside * 0.85);
    fold.translate(side * (inside - reach / 2), y, 0);
    parts.push(fold);
  }
  return mergeGeometries(parts);
}

/** Ribosomes as instanced dots (there are millions in a real cell). */
export function ribosomeCloud(points, r, color = 0x5a3e8c) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), mat(color), points.length);
  const dummy = new THREE.Object3D();
  points.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  });
  return m;
}

/** Rough ER: curved folded sheets hugging the nucleus, studded with ribosomes. */
export function roughER(nr, rand, ribosomeR) {
  const g = new THREE.Group();
  const sheet = mat(0x5aa0d8, { transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const dots = [];
  for (let k = 0; k < 5; k++) {
    const R = nr * (1.22 + k * 0.16);
    const arc = 1.9 - k * 0.15;
    const t = new THREE.Mesh(new THREE.TorusGeometry(R, nr * 0.035, 6, 48, arc), sheet);
    t.scale.z = 3.5;
    t.rotation.z = 0.25 + k * 0.08;
    g.add(t);
    for (let i = 0; i < 26; i++) {
      const a = t.rotation.z + rand() * arc;
      const side = rand() < 0.5 ? -1 : 1;
      dots.push(new THREE.Vector3(Math.cos(a) * (R + side * nr * 0.05), Math.sin(a) * (R + side * nr * 0.05), (rand() - 0.5) * nr * 0.2));
    }
  }
  g.add(ribosomeCloud(dots, ribosomeR));
  return g;
}

export function smoothER(nr, rand) {
  const g = new THREE.Group();
  const m = mat(0x8cc8ee);
  for (let i = 0; i < 4; i++) {
    const pts = [];
    let a = 3.4 + i * 0.35;
    for (let k = 0; k < 5; k++) {
      const R = nr * (1.3 + rand() * 0.7);
      pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, (rand() - 0.5) * nr * 0.5));
      a += 0.3;
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, nr * 0.035, 8), m));
  }
  return g;
}

/** Golgi apparatus: a stack of curved, flattened sacs with vesicles budding off. */
export function golgi(size, rand) {
  const g = new THREE.Group();
  const m = mat(0xf0c040);
  for (let i = 0; i < 5; i++) {
    const w = size * (0.95 - i * 0.1);
    // a flattened sac (cisterna), swollen at its rim and curved like a bowl
    const geo = new THREE.SphereGeometry(1, 40, 14);
    const p = geo.getAttribute('position');
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const rim = Math.hypot(x, z);
      const X = x * w, Z = z * size * 0.5;
      const thick = size * 0.035 * (1 + 2.2 * rim ** 6);
      p.setXYZ(k, X, y * thick + ((X / size) ** 2 + (Z / size) ** 2) * size * 0.55, Z);
    }
    geo.computeVertexNormals();
    const sac = new THREE.Mesh(geo, m);
    sac.position.y = i * size * 0.13 - size * 0.25;
    g.add(sac);
  }
  const vm = mat(0xffe08a);
  for (let i = 0; i < 6; i++) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(size * 0.09, 12, 8), vm);
    const a = rand() * Math.PI * 2;
    v.position.set(Math.cos(a) * size * 0.65, (rand() - 0.2) * size * 0.4, Math.sin(a) * size * 0.35);
    g.add(v);
  }
  return g;
}

export function vesicle(r) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(0xffd97a, { transparent: true, opacity: 0.85 }));
}

export function lysosome(r, rand) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(0xc04a8a, { transparent: true, opacity: 0.8 })));
  const dm = mat(0x6d1f4d);
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 8, 6), dm);
    d.position.copy(randomInSphere(rand, r * 0.6));
    g.add(d);
  }
  return g;
}

export function centrioles(len) {
  const g = new THREE.Group();
  const m = mat(0x7ad0b8);
  const bundle = () => {
    const b = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.05, len * 0.05, len, 6), m);
      rod.position.set(Math.cos(a) * len * 0.22, 0, Math.sin(a) * len * 0.22);
      b.add(rod);
    }
    return b;
  };
  const a = bundle();
  const b = bundle();
  b.rotation.x = Math.PI / 2;
  b.position.set(len * 0.6, 0, 0);
  g.add(a, b);
  return g;
}

export function chloroplast(len, rand) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat(0x3f9a3f, { transparent: true, opacity: 0.6, depthWrite: false }));
  outer.scale.set(len / 2, len / 5, len / 3.2);
  g.add(outer);
  outer.material = rimmed(outer.material, 1.1);
  const stroma = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(0x9fd27a, { roughness: 0.8, clearcoat: 0, transparent: true, opacity: 0.35, depthWrite: false }));
  stroma.scale.set(len / 2 - len * 0.03, len / 5 - len * 0.03, len / 3.2 - len * 0.03);
  g.add(stroma);
  const gm = mat(0x1f6b2a);
  const disc = new THREE.CylinderGeometry(len * 0.065, len * 0.065, len * 0.014, 14);
  const stacks = [];
  for (let i = 0; i < 6; i++) {
    // grana: stacks of thylakoid discs
    const stack = new THREE.Group();
    const h = 4 + Math.floor(rand() * 3);
    for (let k = 0; k < h; k++) {
      const d = new THREE.Mesh(disc, gm);
      d.position.y = k * len * 0.019;
      stack.add(d);
    }
    const x = -len * 0.34 + i * len * 0.135;
    const room = Math.sqrt(Math.max(0, 1 - (x / (len * 0.5)) ** 2));
    stack.position.set(x, -len * 0.045 * room, (rand() - 0.5) * len * 0.14 * room);
    stack.scale.y = 0.6 + 0.4 * room;
    stacks.push(stack);
    g.add(stack);
  }
  // lamellae: thin membranes joining the grana
  const lm = mat(0x2f8a36);
  for (let i = 1; i < stacks.length; i++) {
    for (const lift of [0.2, 0.6]) {
      const a = stacks[i - 1].position.clone().add(new THREE.Vector3(0, len * 0.019 * 4 * lift, 0));
      const b = stacks[i].position.clone().add(new THREE.Vector3(0, len * 0.019 * 4 * (1 - lift), 0));
      const l = new THREE.Mesh(new THREE.BoxGeometry(a.distanceTo(b), len * 0.005, len * 0.05), lm);
      l.position.copy(a).lerp(b, 0.5);
      l.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      g.add(l);
    }
  }
  g.userData.glow = true;
  return g;
}

export function dnaLoop(rx, ry, rand) {
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * rx * (0.5 + rand() * 0.5), Math.sin(a * 3) * ry * 0.7 + (rand() - 0.5) * ry * 0.6, Math.sin(a) * ry * (0.4 + rand() * 0.6)));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, ry * 0.05, 6, true), mat(0x6a5acd));
}

export function plasmid(r) {
  return new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.2, 8, 24), mat(0xffa94d));
}

export function flagellum(len, r) {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    pts.push(new THREE.Vector3(t * len, Math.sin(t * Math.PI * 6) * r * 6 * Math.min(1, t * 4), Math.cos(t * Math.PI * 6) * r * 6 * Math.min(1, t * 4)));
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, r, 6), mat(0x9ad0ff)));
  g.userData.spin = true;
  return g;
}
