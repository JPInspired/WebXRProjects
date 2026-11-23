import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The furniture of the Art Gallery, made in code (nothing downloaded): wood with a real grain, a carved gilt
// frame moulding with mitred corners, the canvas weave under the varnish, a desk and a studio easel.

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// a small seeded random, so the grain is the same every time
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Wood grain running along the texture's width: long wavy streaks, darker growth lines and a few knots. */
function grain(base, dark, seed) {
  return canvasTexture(512, 512, (g, W, H) => {
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // broad tonal bands
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(${dark},${0.04 + r() * 0.08})`;
      g.fillRect(0, r() * H, W, 8 + r() * 40);
    }
    // the grain lines: thin, slightly wavy
    for (let i = 0; i < 170; i++) {
      const y0 = r() * H, amp = 2 + r() * 6, f = 0.004 + r() * 0.01, ph = r() * 6;
      g.strokeStyle = `rgba(${dark},${0.08 + r() * 0.22})`;
      g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const y = y0 + Math.sin(x * f + ph) * amp;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    // two small knots, with the grain flowing around them
    for (let k = 0; k < 2; k++) {
      const cx = r() * W, cy = r() * H;
      for (let j = 6; j > 0; j--) {
        g.strokeStyle = `rgba(${dark},${0.12 + j * 0.03})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(cx, cy, j * 5, j * 2, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // fine pores
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(${dark},${r() * 0.12})`;
      g.fillRect(r() * W, r() * H, 1 + r() * 3, 1);
    }
  });
}

const grains = {
  desk: () => once('g-desk', () => grain('#a8774a', '70,40,20', 7)),
  easel: () => once('g-easel', () => grain('#8a5a34', '50,28,12', 31)),
  back: () => once('g-back', () => grain('#6d5338', '40,26,14', 53)),
};

/**
 * A wood material. `along`: which way the grain runs on the part ('x' for a long table top, 'y' for a leg).
 * `repeat`: how many times the texture repeats along the grain.
 */
export function woodMaterial(kind = 'desk', along = 'x', repeat = 1) {
  return once(`wood-${kind}-${along}-${repeat}`, () => {
    const map = grains[kind]().clone();
    map.needsUpdate = true;
    map.center.set(0.5, 0.5);
    if (along === 'y') map.rotation = Math.PI / 2;
    map.repeat.set(repeat, 1);
    return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, roughness: 0.58, envMapIntensity: 0.5 });
  });
}

/** Burnished gold leaf: warm, reflective, with worn and darker patches. */
export function goldMaterial() {
  return once('gold', () => {
    const map = canvasTexture(256, 256, (g, W, H) => {
      const r = rng(101);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${r() < 0.7 ? '90,60,20' : '255,240,200'},${r() * 0.14})`;
        const s = 1 + r() * 7;
        g.fillRect(r() * W, r() * H, s, s * (0.3 + r()));
      }
    });
    const rough = canvasTexture(128, 128, (g, W, H) => {
      const r = rng(202);
      g.fillStyle = '#5a5a5a';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 600; i++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.25})`;
        g.fillRect(r() * W, r() * H, 1 + r() * 5, 1 + r() * 5);
      }
    }, false);
    return new THREE.MeshStandardMaterial({ color: 0xc79a48, map, metalness: 0.88, roughness: 0.44, roughnessMap: rough, envMapIntensity: 1.0 });
  });
}

/** The canvas weave, felt rather than seen through the varnish (a bump texture; tile it about every 5 mm). */
export function weave() {
  return once('weave', () => canvasTexture(32, 32, (g, W, H) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, i * 8 + 1, W, 4);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(i * 8 + 1, 0, 4, H);
    }
  }, false));
}

// ── the frame moulding ─────────────────────────────────

// The moulding's cross-section from the inner edge outwards: [out, depth], in frame widths. A lip over the canvas
// edge, a bead, a hollow (cove), the rounded crest (ogee) and the outer edge, then the back.
const PROFILE = [
  [-0.05, 0.02], [-0.05, 0.09], [0.0, 0.13], [0.05, 0.11], [0.1, 0.13], [0.14, 0.2],
  [0.2, 0.24], [0.28, 0.26], [0.36, 0.3], [0.44, 0.38], [0.52, 0.47], [0.6, 0.53],
  [0.68, 0.56], [0.76, 0.56], [0.83, 0.52], [0.89, 0.45], [0.94, 0.36], [0.98, 0.27],
  [1.0, 0.2], [1.0, -0.12], [0.6, -0.12],
];

/**
 * The frame round a w × h painting, t wide: each point of the cross-section traced round the rectangle, so the
 * corners are mitred like a real frame. The canvas is at z = 0, facing +z.
 */
export function frameGeometry(w, h, t) {
  const pos = [], uv = [], index = [];
  const n = PROFILE.length;
  for (let s = 0; s < 4; s++) {
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const [o, z] = PROFILE[i];
      const X = w / 2 + o * t, Y = h / 2 + o * t;
      const c = [[-X, -Y], [X, -Y], [X, Y], [-X, Y]]; // anticlockwise seen from the front
      const a = c[s], b = c[(s + 1) % 4];
      pos.push(a[0], a[1], z * t, b[0], b[1], z * t);
      const len = s % 2 ? h : w;
      uv.push(0, i / (n - 1), len / 0.25, i / (n - 1));
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 3, d = a + 2;
      index.push(a, c, b, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// ── furniture ──────────────────────────────────────────

/** A square leg that tapers towards the foot (a four-sided cylinder turned to square). */
function taperedLeg(top, foot, h, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(top * Math.SQRT1_2, foot * Math.SQRT1_2, h, 4, 1), mat);
  m.rotation.y = Math.PI / 4;
  return m;
}

/** A wooden desk whose top surface is at y = topY, centred on (0, z). */
export function desk(topY, z, w = 1.3, d = 0.75, floorY = topY - 0.9) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(w, 0.035, d, 3, 0.008), woodMaterial('desk', 'x', 1));
  top.position.set(0, topY - 0.0175, z);
  g.add(top);
  // the apron: boards just under the top, joining the legs
  const apron = woodMaterial('desk', 'x', 2);
  const legIn = 0.06;
  for (const [aw, ad, x, zz] of [[w - 2 * legIn, 0.02, 0, z + d / 2 - legIn], [w - 2 * legIn, 0.02, 0, z - d / 2 + legIn], [0.02, d - 2 * legIn, -w / 2 + legIn, z], [0.02, d - 2 * legIn, w / 2 - legIn, z]]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(aw, 0.08, ad, 2, 0.004), apron);
    b.position.set(x, topY - 0.035 - 0.04, zz);
    g.add(b);
  }
  const legH = topY - 0.035 - floorY;
  const legMat = woodMaterial('desk', 'y', 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = taperedLeg(0.05, 0.034, legH, legMat);
    l.position.set(sx * (w / 2 - legIn), floorY + legH / 2, z + sz * (d / 2 - legIn));
    g.add(l);
  }
  return g;
}

/**
 * A studio table easel standing on y = baseY: two splayed front legs, a back leg, a central mast, a crossbar, a
 * tray with a lip at trayY for the painting to rest on, and a top clamp (move `clamp.position.y` to the
 * painting's top edge). Leans back by `lean`.
 */
export function easel(baseY, trayY, trayZ, lean = 0.08) {
  const g = new THREE.Group();
  const mat = woodMaterial('easel', 'y', 1);
  const across = woodMaterial('easel', 'x', 1);
  const H = 0.95;
  const piece = (w, h, d, m = mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, d) * 0.25), m);
  // front legs: wider at the foot, leaning back with the painting
  for (const sx of [-1, 1]) {
    const l = piece(0.032, H, 0.024);
    l.position.set(sx * 0.2, baseY + H / 2 - 0.02, -0.15);
    l.rotation.set(-lean, 0, sx * 0.1);
    g.add(l);
  }
  // back leg: its foot behind, its top meeting the front legs
  const back = piece(0.03, H * 1.02, 0.022);
  back.position.set(0, baseY + H / 2 - 0.02, -0.33);
  back.rotation.x = 0.32;
  g.add(back);
  // the mast: up the middle, behind the painting
  const mast = piece(0.04, H, 0.022);
  mast.position.set(0, baseY + H / 2, trayZ - 0.065);
  mast.rotation.x = -lean;
  g.add(mast);
  // a crossbar between the front legs, low down
  const bar = piece(0.36, 0.024, 0.02, across);
  bar.position.set(0, baseY + 0.03, -0.12);
  g.add(bar);
  // the tray (with a lip at the front, so the painting cannot slide off)
  const tray = piece(0.62, 0.022, 0.1, across);
  tray.position.set(0, trayY - 0.011, trayZ - 0.03);
  g.add(tray);
  const lip = piece(0.62, 0.03, 0.012, across);
  lip.position.set(0, trayY + 0.006, trayZ + 0.017);
  g.add(lip);
  // the top clamp, sliding on the mast
  const clamp = piece(0.11, 0.03, 0.05, across);
  clamp.position.set(0, trayY + 0.4, trayZ - 0.035);
  g.add(clamp);
  return { group: g, clamp };
}
