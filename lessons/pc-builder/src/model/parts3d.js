import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARTS, CASES, layoutOf } from '../data/parts.js';
import { font } from '../../../../shared/ui/CanvasPanel.js';

// Life-size 3D models of every part, built in code: simple shapes plus small drawn textures (circuit boards,
// chips, grilles, fins) so they look like the real hardware. Nothing is downloaded.
// Convention (inside the case): x = towards the back of the case, y = up, z = out of the motherboard towards you.
// Every part's origin is the point that sits on its slot; the sizes are the real ones (see ../data/parts.js).

// ── materials and textures (shared and cached: the tray and the ghosts build parts often) ──

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

/** A plain material (shared by colour and options). */
const mat = (color, extra = {}) => once(`m${color}${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.35, ...extra }));
const metal = (color, rough = 0.35) => mat(color, { metalness: 0.85, roughness: rough });
const plastic = (color) => mat(color, { metalness: 0, roughness: 0.6 });

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A seeded random number generator, so every board looks the same each time. */
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (c) => `#${new THREE.Color(c).getHexString()}`;
const shade = (c, k) => hex(new THREE.Color(c).multiplyScalar(k));

/** A circuit board: copper traces, vias, little components and white printed outlines. */
function pcbTexture(color, seed, aspect = 1, { chips = 0, chipColor = '#15171c' } = {}) {
  return once(`pcb${color}-${seed}-${aspect.toFixed(2)}-${chips}`, () => canvas(512, Math.max(64, Math.round(512 / aspect)), (g, W, H) => {
    const r = rng(seed);
    g.fillStyle = shade(color, 0.8);
    g.fillRect(0, 0, W, H);
    // traces: runs that turn at 45°, a little lighter than the board
    g.strokeStyle = shade(color, 1.45);
    g.lineWidth = 1.2;
    for (let i = 0; i < 70; i++) {
      let x = r() * W, y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        const len = 20 + r() * 80;
        const dir = Math.floor(r() * 8) * (Math.PI / 4);
        x += Math.cos(dir) * len;
        y += Math.sin(dir) * len;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // vias
    g.fillStyle = shade(color, 1.9);
    for (let i = 0; i < 160; i++) {
      g.beginPath();
      g.arc(r() * W, r() * H, 1.4, 0, Math.PI * 2);
      g.fill();
    }
    // tiny surface-mount parts
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = r() * H, w = 3 + r() * 5, h = 2 + r() * 2;
      g.fillStyle = r() < 0.5 ? '#2a2a2a' : '#6b5a3a';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#c9c9c9';
      g.fillRect(x - 1, y, 1.2, h);
      g.fillRect(x + w, y, 1.2, h);
    }
    // printed outlines (silkscreen)
    g.strokeStyle = 'rgba(235,240,245,0.55)';
    g.lineWidth = 1;
    for (let i = 0; i < 12; i++) g.strokeRect(r() * W, r() * H, 12 + r() * 40, 8 + r() * 24);
    // memory chips along the board (RAM, SSDs)
    for (let i = 0; i < chips; i++) {
      const cw = W / (chips + 1) * 0.8;
      const x = (i + 0.6) * (W / (chips + 0.2)) - cw / 2 + 8;
      g.fillStyle = chipColor;
      g.fillRect(x, H * 0.2, cw, H * 0.55);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.font = font(Math.round(H * 0.08), 700);
      g.textAlign = 'center';
      g.fillText('▪ 16Gb', x + cw / 2, H * 0.5);
    }
  }));
}

/** Fine parallel lines: heatsink fins seen edge-on, radiators. */
const finTexture = (color, n = 64, vertical = false) => once(`fin${color}${n}${vertical}`, () => {
  const t = canvas(256, 256, (g, W, H) => {
    g.fillStyle = shade(color, 0.55);
    g.fillRect(0, 0, W, H);
    g.fillStyle = hex(color);
    const s = W / n;
    for (let i = 0; i < n; i++) vertical ? g.fillRect(i * s, 0, s * 0.55, H) : g.fillRect(0, i * s, W, s * 0.55);
  });
  return t;
});

/** A honeycomb grille (power-supply fans, front panels): white = open. Used as a see-through (alpha) map. */
const honeycomb = (cell = 14) => once(`hc${cell}`, () => {
  const t = canvas(256, 256, (g, W, H) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    const dx = cell, dy = cell * 0.866;
    for (let row = -1; row * dy < H + dy; row++) {
      for (let col = -1; col * dx < W + dx; col++) {
        const x = col * dx + (row % 2 ? dx / 2 : 0), y = row * dy;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + (k * Math.PI) / 3;
          g.lineTo(x + Math.cos(a) * cell * 0.42, y + Math.sin(a) * cell * 0.42);
        }
        g.fill();
      }
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
});

/** Lightly brushed metal / matte paint, so big flat panels are not a single flat colour. */
const brushed = () => once('brushed', () => {
  const t = canvas(256, 256, (g, W, H) => {
    g.fillStyle = '#d8d8d8';
    g.fillRect(0, 0, W, H);
    const r = rng(5);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.01 + r() * 0.025})`;
      g.fillRect(0, r() * H, W, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
});

function box(w, h, d, color, x = 0, y = 0, z = 0, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color, extra) : color);
  m.position.set(x, y, z);
  return m;
}

function cyl(r, h, color, x = 0, y = 0, z = 0, axis = 'z', seg = 20) {
  const geo = new THREE.CylinderGeometry(r, r, h, seg);
  if (axis === 'z') geo.rotateX(Math.PI / 2);
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  return m;
}

/** A flat printed label (like the writing on a real part). */
function printed(text, w, h, { color = '#e8ecf5', bg = null, size = 64, weight = 700 } = {}) {
  const map = once(`txt${text}|${w.toFixed(4)}|${h.toFixed(4)}|${color}|${bg}|${size}|${weight}`, () => canvas(512, Math.max(32, Math.round((512 * h) / w)), (g, W, H) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
    }
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lines = text.split('\n');
    let s = size;
    g.font = font(s, weight);
    while (s > 12 && Math.max(...lines.map((l) => g.measureText(l).width)) > W * 0.92) g.font = font(--s, weight);
    lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * s * 1.15));
  }));
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false }));
}

/** A flat textured panel facing +z. */
function panel(w, h, map, extra = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0, envMapIntensity: 0.3, ...extra }));
}

// ── fans ───────────────────────────────────────────────

/** Curved, twisted fan blades as one mesh (n blades between radius rh and rt). */
function bladesGeometry(rh, rt, n = 7) {
  return once(`blades${rh.toFixed(4)}${rt.toFixed(4)}${n}`, () => {
    const parts = [];
    const U = 6, V = 5;
    const width = (Math.PI * 2 / n) * 0.78;
    for (let b = 0; b < n; b++) {
      const pos = [], idx = [];
      for (let i = 0; i <= U; i++) {
        const u = i / U;
        const rad = rh + (rt - rh) * u;
        for (let j = 0; j <= V; j++) {
          const v = j / V;
          const a = (b / n) * Math.PI * 2 + (v - 0.5) * width * (0.75 + 0.35 * u) + 0.55 * u; // swept back towards the tip
          const lift = (v - 0.5) * rad * width * 0.55; // pitched, like a propeller
          pos.push(Math.cos(a) * rad, Math.sin(a) * rad, lift);
        }
      }
      for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
        const a = i * (V + 1) + j, c = a + V + 1;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      parts.push(g);
    }
    return mergeGeometries(parts);
  });
}

/** A square fan frame (like a 120 mm case fan): a square with a round opening, plus the four corner struts. */
function frameGeometry(r, depth) {
  return once(`frame${r.toFixed(4)}${depth.toFixed(4)}`, () => {
    const s = r * 1.1;
    const shape = new THREE.Shape();
    const c = r * 0.18; // rounded corners
    shape.moveTo(-s + c, -s);
    shape.lineTo(s - c, -s);
    shape.quadraticCurveTo(s, -s, s, -s + c);
    shape.lineTo(s, s - c);
    shape.quadraticCurveTo(s, s, s - c, s);
    shape.lineTo(-s + c, s);
    shape.quadraticCurveTo(-s, s, -s, s - c);
    shape.lineTo(-s, -s + c);
    shape.quadraticCurveTo(-s, -s, -s + c, -s);
    const hole = new THREE.Path();
    hole.absarc(0, 0, r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, -depth / 2);
    return g;
  });
}

/**
 * A fan, facing +z: blades that spin when the PC is on (userData.spin), a hub with a sticker and, unless
 * frameless (graphics cards), a square frame.
 */
function fan(r, color = 0x2a2f3a, { frameless = false, bladeColor = 0x30353f } = {}) {
  const g = new THREE.Group();
  const depth = r * 0.42;
  if (!frameless) {
    g.add(new THREE.Mesh(frameGeometry(r, depth), plastic(color)));
    // the struts holding the motor, at the back
    for (let k = 0; k < 4; k++) {
      const s = box(r * 0.9, r * 0.05, r * 0.04, color, 0, 0, -depth / 2 + r * 0.02);
      s.position.x = Math.cos(k * Math.PI / 2 + Math.PI / 4) * r * 0.55;
      s.position.y = Math.sin(k * Math.PI / 2 + Math.PI / 4) * r * 0.55;
      s.rotation.z = k * Math.PI / 2 + Math.PI / 4;
      g.add(s);
    }
  } else {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.035, 6, 40), plastic(color)));
  }
  const blades = new THREE.Group();
  blades.add(new THREE.Mesh(bladesGeometry(r * 0.32, r * 0.95), mat(bladeColor, { side: THREE.DoubleSide, roughness: 0.5, metalness: 0 })));
  blades.add(cyl(r * 0.32, depth * 0.7, plastic(0x1c2029)));
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(r * 0.24, 24), once('sticker', () => new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvas(128, 128, (c, W) => {
    c.fillStyle = '#20242e';
    c.fillRect(0, 0, W, W);
    c.strokeStyle = '#7f8aa3';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(W / 2, W / 2, W * 0.32, 0, Math.PI * 2);
    c.stroke();
  }) })));
  sticker.position.z = depth * 0.35 + 0.0002;
  blades.add(sticker);
  blades.userData.spin = 'z';
  g.add(blades);
  return g;
}

// ── individual parts ───────────────────────────────────

export function boardMesh(id) {
  const p = PARTS[id];
  const L = layoutOf(id);
  const [bw, bh] = L.size;
  const g = new THREE.Group();
  const seed = id.length * 97 + bw * 1000;
  // the board itself, with its circuit printed on top
  g.add(box(bw, bh, 0.0016, p.color, -bw / 2, -bh / 2, 0));
  const top = panel(bw, bh, pcbTexture(p.color, seed, bw / bh), { roughness: 0.6 });
  top.position.set(-bw / 2, -bh / 2, 0.00081);
  g.add(top);
  const dark = 0x14161c;
  const [cx, cy] = L.cpu;
  const intel = p.socket === 'LGA1700';
  // CPU socket: metal retention frame, lever, and the socket itself
  g.add(box(0.052, 0.052, 0.002, 0x2a2d35, cx, cy, 0.0015));
  for (const [x, y, w, h] of [[0, 0.024, 0.054, 0.005], [0, -0.024, 0.054, 0.005], [0.024, 0, 0.005, 0.054], [-0.024, 0, 0.005, 0.054]]) {
    g.add(box(w, h, 0.0035, 0x9aa0aa, cx + x, cy + y, 0.0025, { metalness: 0.85, roughness: 0.35 }));
  }
  g.add(cyl(0.0012, 0.05, metal(0xb0b6c0), cx - 0.03, cy, 0.003, 'y', 8));
  if (!intel) g.add(box(0.004, 0.004, 0.001, 0xd4af37, cx - 0.019, cy - 0.019, 0.0035, { metalness: 0.9 })); // the gold triangle marking pin 1
  // power delivery (VRM): rows of chokes, covered by finned heatsinks above and behind the socket
  const vrm = (len, horizontal, x, y) => {
    const s = new THREE.Group();
    s.add(box(horizontal ? len : 0.014, horizontal ? 0.014 : len, 0.006, 0x3d424e, 0, 0, 0.0045, { metalness: 0.6, roughness: 0.4 }));
    const n = Math.round(len / 0.004);
    for (let i = 0; i < n; i++) {
      const o = -len / 2 + (i + 0.5) * (len / n);
      s.add(box(horizontal ? 0.0022 : 0.014, horizontal ? 0.014 : 0.0022, 0.009, 0x4a505c, horizontal ? o : 0, horizontal ? 0 : o, 0.011, { metalness: 0.6, roughness: 0.4 }));
    }
    s.position.set(x, y, 0);
    return s;
  };
  g.add(vrm(0.062, false, cx + 0.04, cy));
  g.add(vrm(0.06, true, cx - 0.004, cy + 0.04));
  // chokes and capacitors in front of the heatsinks
  for (let i = 0; i < 6; i++) g.add(box(0.006, 0.006, 0.005, 0x5c6170, cx - 0.032, cy + 0.028 - i * 0.011, 0.0035));
  for (let i = 0; i < 4; i++) g.add(cyl(0.0028, 0.008, 0x2a2e38, cx + 0.03 - i * 0.008, cy + 0.03, 0.005));
  // rear I/O cover, angled, with the board's name
  const io = box(0.022, 0.075, 0.032, 0x30353f, -0.012, -0.055, 0.016, { metalness: 0.5, roughness: 0.45 });
  g.add(io);
  g.add(box(0.003, 0.07, 0.03, 0x8a93ad, -0.0235, -0.055, 0.016, { metalness: 0.8, roughness: 0.3 })); // a light accent strip
  // the 8-pin CPU power socket at the top edge, and the 24-pin main power socket on the front edge
  g.add(box(0.019, 0.008, 0.011, dark, cx + 0.005, -0.008, 0.0065));
  g.add(box(0.009, 0.052, 0.013, dark, -bw + 0.008, L.ramY - 0.005, 0.0065));
  // RAM slots, with a latch at each end
  for (const [i, x] of L.ram.entries()) {
    const c = i % 2 ? 0x5a5f69 : dark;
    g.add(box(0.0065, 0.135, 0.008, c, x, L.ramY, 0.004, { metalness: 0, roughness: 0.6 }));
    for (const e of [-1, 1]) g.add(box(0.0072, 0.006, 0.01, 0xcfd3da, x, L.ramY + e * 0.0705, 0.005));
  }
  // M.2 slots: the connector, the mounting screw and a printed outline
  for (const [x, y] of L.m2) {
    g.add(box(0.084, 0.024, 0.0008, 0x2c3140, x, y, 0.0009));
    g.add(box(0.004, 0.024, 0.004, dark, x + 0.042, y, 0.002));
    g.add(cyl(0.0025, 0.003, metal(0xc0c4cc), x - 0.039, y, 0.0022, 'z', 12));
  }
  // PCIe slots: the graphics card slot (metal-reinforced), and a short one below
  g.add(box(0.09, 0.0065, 0.009, dark, -0.06, L.pcieY, 0.0045));
  g.add(box(0.091, 0.0075, 0.0065, 0xb8bec8, -0.06, L.pcieY, 0.0045, { metalness: 0.9, roughness: 0.25 }));
  if (bh > 0.2) g.add(box(0.026, 0.0055, 0.008, dark, -0.035, L.pcieY - 0.045, 0.004));
  // chipset heatsink (with the board's name), CMOS battery, audio capacitors, SATA ports, front-panel pins
  const chip = box(0.034, 0.034, 0.009, 0x3a3f4c, -bw + 0.055, -bh + 0.06, 0.0045, { metalness: 0.6, roughness: 0.35 });
  g.add(chip);
  const label = printed(p.short.toUpperCase(), 0.03, 0.008, { color: '#c8d0e0' });
  label.position.set(-bw + 0.055, -bh + 0.06, 0.0092);
  g.add(label);
  g.add(cyl(0.01, 0.003, metal(0xd0d4dc, 0.25), -0.11, L.pcieY - 0.022, 0.0025, 'z', 24));
  for (let i = 0; i < 4; i++) g.add(cyl(0.0032, 0.009, 0xc8a24a, -0.02 - i * 0.009, -bh + 0.018, 0.0055));
  g.add(box(0.008, 0.03, 0.006, dark, -bw + 0.006, -bh * 0.6, 0.003));
  for (let i = 0; i < 2; i++) g.add(box(0.0085, 0.006, 0.007, 0x1a1c22, -bw + 0.006, -bh * 0.6 - 0.008 + i * 0.016, 0.007));
  g.add(box(0.02, 0.005, 0.006, dark, -bw + 0.03, -bh + 0.006, 0.003));
  // status LED (glows when the PC is on)
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshStandardMaterial({ color: 0x103018, emissive: 0x000000 }));
  led.position.set(-bw + 0.02, -0.02, 0.003);
  led.userData.led = true;
  g.add(led);
  return g;
}

export function cpuMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  const intel = p.socket === 'LGA1700';
  const [w, h] = intel ? [0.0375, 0.045] : [0.04, 0.04];
  // the green substrate, with tiny components showing round the edge
  g.add(box(w, h, 0.0015, 0x2f5b3a, 0, 0, 0.00075));
  const sub = panel(w, h, pcbTexture(0x2f5b3a, intel ? 11 : 12, w / h));
  sub.position.z = 0.00151;
  g.add(sub);
  const ihs = metal(0xc5c9d0, 0.28);
  if (intel) {
    // Intel: a rectangular heat spreader with a step round its edge
    g.add(box(w * 0.86, h * 0.72, 0.0012, ihs, 0, 0, 0.0021));
    g.add(box(w * 0.8, h * 0.66, 0.0026, ihs, 0, 0, 0.0034));
  } else {
    // AMD AM5: the heat spreader's cut-out sides
    g.add(box(w * 0.86, h * 0.6, 0.0035, ihs, 0, 0, 0.0033));
    g.add(box(w * 0.6, h * 0.86, 0.0035, ihs, 0, 0, 0.0033));
    g.add(box(0.004, 0.004, 0.0004, 0xd4af37, -w * 0.44, -h * 0.44, 0.0017, { metalness: 0.9 }));
  }
  const label = printed(`${intel ? 'intel' : 'AMD'}\n${p.short.replace(/^(Ryzen|Core) /, '')}`, w * 0.6, h * 0.42, { color: '#3a3f4a' });
  label.position.z = 0.0052;
  g.add(label);
  return g;
}

/** A stack of thin heatsink fins (one mesh), w × h each, `n` of them from z0 to z1. */
function finStack(w, h, z0, z1, n, color = 0xc4c9d2) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, 0.0005), metal(color, 0.3), n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set(0, 0, z0 + ((i + 0.5) / n) * (z1 - z0));
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  }
  return m;
}

/** Copper heat pipes rising from the base through the fins. */
function heatPipes(n, spacing, height, y = 0) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) g.add(cyl(0.003, height, metal(0xc07a3f, 0.3), -spacing * (n - 1) / 2 + i * spacing, y, height / 2 + 0.006, 'z', 10));
  return g;
}

export function coolerMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  if (p.kind === 'stock') {
    // a round aluminium heatsink: a copper core with fins all round it, under a fan in a shroud
    const s = new THREE.Group();
    s.add(cyl(0.012, 0.028, metal(0xc07a3f, 0.3), 0, 0, 0.014));
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.0008, 0.026), metal(0xb4bac4, 0.3), 36);
    const o = new THREE.Object3D();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      o.position.set(Math.cos(a) * 0.027, Math.sin(a) * 0.027, 0.014);
      o.rotation.set(0, 0, a + 0.35);
      o.updateMatrix();
      fins.setMatrixAt(i, o.matrix);
    }
    s.add(fins);
    s.add(box(0.095, 0.095, 0.006, plastic(0x1f232b), 0, 0, 0.031));
    const f = fan(0.04, 0x1f232b);
    f.position.z = 0.044;
    s.add(f);
    g.add(s);
    g.scale.z = p.height / 0.06; // the low-profile one is flatter
  } else if (p.kind === 'tower') {
    const towers = p.dual ? [-0.035, 0.035] : [0];
    const tw = p.dual ? 0.045 : 0.05;
    const fh = p.dual ? 0.135 : 0.125;
    const z0 = p.dual ? 0.035 : 0.035, z1 = p.dual ? 0.165 : 0.155;
    g.add(box(p.dual ? 0.05 : 0.045, 0.045, 0.01, metal(0xc07a3f, 0.3), 0, 0, 0.005)); // copper base
    g.add(box(0.06, 0.012, 0.004, metal(0x9aa0aa), 0, 0, 0.011)); // mounting bar
    for (const x of towers) {
      const t = new THREE.Group();
      t.add(finStack(tw, fh, z0, z1, 40));
      const pipes = heatPipes(4, 0.009, z1 - 0.004);
      t.add(pipes);
      // a cap on top with the pipe ends showing
      t.add(box(tw + 0.002, fh + 0.002, 0.004, metal(0x2a2f3a, 0.4), 0, 0, z1 + 0.002));
      for (let i = 0; i < 4; i++) t.add(cyl(0.0031, 0.001, metal(0xd08a4f, 0.25), -0.0135 + i * 0.009, 0, z1 + 0.0045, 'z', 10));
      t.position.x = x;
      g.add(t);
    }
    // the fan clipped to the side (between the towers on the dual one)
    const f = fan(0.055, 0x2a2f3a);
    f.rotation.y = -Math.PI / 2;
    f.position.set(p.dual ? 0 : -0.038, 0, (z0 + z1) / 2);
    g.add(f);
  } else {
    // liquid cooler pump: a round block with a lit ring and its name on top
    g.add(box(0.05, 0.05, 0.006, metal(0x9aa0aa), 0, 0, 0.003));
    g.add(cyl(0.03, 0.026, plastic(0x1f232b), 0, 0, 0.019, 'z', 40));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0015, 6, 48), new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0x000000 }));
    ring.position.z = 0.0322;
    ring.userData.led = true;
    g.add(ring);
    const top = printed(`LIQUID ${p.radiator}`, 0.04, 0.011, { color: '#7ec8ff' });
    top.position.z = 0.0325;
    g.add(top);
  }
  return g;
}

/** The radiator + tubes of the liquid cooler, in case space (from pump at `from` to the top of the case). */
export function radiatorMesh(c, from, mm = 240) {
  const g = new THREE.Group();
  const y = c.h / 2 - 0.03;
  const len = mm / 1000 + 0.03;
  // the radiator: fins between two end tanks
  const core = box(len - 0.03, 0.027, 0.12, mat(0xffffff, { map: finTexture(0x3a3f4a, 80, true), metalness: 0.6, roughness: 0.45 }), 0, y, 0);
  g.add(core);
  for (const e of [-1, 1]) g.add(box(0.015, 0.03, 0.124, plastic(0x1c1f26), e * (len / 2 - 0.0075), y, 0));
  const nFans = mm / 120;
  for (let i = 0; i < nFans; i++) {
    const x = (i - (nFans - 1) / 2) * 0.12;
    const f = fan(0.055);
    f.rotation.x = Math.PI / 2;
    f.position.set(x, y - 0.026, 0);
    g.add(f);
  }
  for (const dz of [-0.01, 0.01]) {
    const curve = new THREE.CatmullRomCurve3([
      from.clone().add(new THREE.Vector3(0.02, 0, 0.03 + dz)),
      new THREE.Vector3(from.x + 0.06, (from.y + y) / 2, 0.05 + dz),
      new THREE.Vector3(len / 2 - 0.0075, y - 0.01, 0.03 + dz),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.006, 10), mat(0x15171c, { roughness: 0.7, metalness: 0 })));
  }
  return bake(g);
}

export function ramMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  const contacts = (len, h) => {
    // gold contacts, split by the notch that stops it going in the wrong way round
    const a = len * 0.55, b = len - a - 0.003;
    g.add(box(0.0014, a, h, 0xd4af37, 0, -len / 2 + a / 2, h / 2, { metalness: 0.9, roughness: 0.25 }));
    g.add(box(0.0014, b, h, 0xd4af37, 0, len / 2 - b / 2, h / 2, { metalness: 0.9, roughness: 0.25 }));
  };
  if (p.sodimm) {
    // laptop memory: a short green board with its chips showing, no heat spreader
    g.add(box(0.0012, 0.0696, 0.03, 0x1d5a2e, 0, 0, 0.015));
    const face = panel(0.0696, 0.03, pcbTexture(0x1d5a2e, 21, 0.0696 / 0.03, { chips: 4 }));
    face.geometry.rotateZ(Math.PI / 2); // along the stick
    face.rotation.y = -Math.PI / 2;
    face.position.set(-0.00061, 0, 0.015);
    g.add(face);
    contacts(0.062, 0.004);
    return g;
  }
  g.add(box(0.0012, 0.133, 0.031, 0x1d5a2e, 0, 0, 0.0155)); // circuit board
  contacts(0.12, 0.004);
  // heat spreaders on both sides, with a ridged top edge
  const hs = mat(p.color, { metalness: 0.3, roughness: 0.45 });
  for (const s of [-1, 1]) {
    g.add(box(0.0018, 0.133, 0.024, hs, s * 0.0016, 0, 0.018));
    g.add(box(0.0022, 0.131, 0.0035, hs, s * 0.0014, 0, 0.0312)); // the folded top edge
  }
  const label = printed(`${p.type}  ${p.gb} GB`, 0.1, 0.012, { color: p.color === 0xa8adb8 ? '#1d2236' : '#ffffff' });
  label.rotation.y = -Math.PI / 2;
  label.rotation.z = Math.PI / 2;
  label.position.set(-0.0027, 0, 0.018);
  g.add(label);
  return g;
}

const gbLabel = (gb) => (gb >= 1000 ? `${gb / 1000}TB` : `${gb}GB`);

export function storageMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  if (p.size === 'm2') {
    const col = p.iface === 'nvme' ? 0x1a1c22 : 0x1d4a2e;
    g.add(box(0.08, 0.022, 0.0012, col, 0, 0, 0.0006));
    const face = panel(0.08, 0.022, pcbTexture(col, p.iface === 'nvme' ? 31 : 32, 0.08 / 0.022));
    face.position.z = 0.00121;
    g.add(face);
    // controller and memory chips, the gold contacts and the screw notch
    g.add(box(0.011, 0.011, 0.0012, 0x2a2d35, -0.028, 0, 0.0018));
    for (const x of [-0.008, 0.012]) g.add(box(0.015, 0.014, 0.0014, 0x15171c, x, 0, 0.0019));
    g.add(box(0.004, 0.02, 0.0013, 0xd4af37, 0.038, 0, 0.0006, { metalness: 0.9 }));
    const l = printed(`${p.iface === 'nvme' ? 'NVMe' : 'SATA'} ${gbLabel(p.gb)}`, 0.026, 0.008, { color: '#1d2236', bg: '#e8ecf2' });
    l.position.set(0.002, 0, 0.00265);
    g.add(l);
  } else if (p.size === 2.5) {
    g.add(box(0.1, 0.007, 0.07, mat(0xffffff, { map: brushed(), color: 0x7a808c, metalness: 0.7, roughness: 0.35 }), 0, 0, 0));
    const l = printed(`SSD ${gbLabel(p.gb)}`, 0.07, 0.045, { color: '#e8ecf5', bg: '#1d2236' });
    l.rotation.x = -Math.PI / 2;
    l.position.y = 0.0036;
    g.add(l);
    g.add(box(0.004, 0.005, 0.02, 0x15171c, 0.05, 0, 0.015)); // SATA connector
  } else {
    // hard drive: an aluminium lid with screws and a label, the circuit board underneath
    g.add(box(0.147, 0.024, 0.102, mat(0xffffff, { map: brushed(), color: 0xa4aab4, metalness: 0.75, roughness: 0.35 }), 0, 0.001, 0));
    g.add(box(0.12, 0.002, 0.09, 0x1d4a2e, 0.005, -0.012, 0));
    const l = printed(`HDD ${gbLabel(p.gb)}\n7200 RPM`, 0.075, 0.06, { color: '#1d2236', bg: '#e8ecf2' });
    l.rotation.x = -Math.PI / 2;
    l.position.set(0.02, 0.0131, 0.005);
    g.add(l);
    for (const [x, z] of [[-0.065, -0.042], [-0.065, 0.042], [0.068, -0.042], [0.068, 0.042], [-0.03, 0], [0.0, -0.045]]) g.add(cyl(0.0025, 0.0008, metal(0xd0d4dc, 0.2), x, 0.0133, z, 'y', 10));
  }
  return g;
}

/** Graphics card: origin at the rear bracket, card extends towards the front (-x), hangs below the slot. */
export function gpuMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  const L = p.length;
  const T = p.thick;
  const hi = p.watts > 200;
  // the circuit board (just under the slot) and a metal backplate on top of it
  g.add(box(L * 0.98, 0.002, 0.1, 0x1d5a2e, -L / 2, -0.001, 0.058));
  g.add(box(L * 0.97, 0.0015, 0.098, metal(0x2a2e36, 0.45), -L / 2, 0.0008, 0.058));
  // the heatsink between the board and the shroud: fins seen edge-on
  const fins = box(L * 0.94, T * 0.55, 0.104, mat(0xffffff, { map: finTexture(0x9aa0aa, 90, true), metalness: 0.7, roughness: 0.35 }), -L / 2, -T * 0.3, 0.06);
  g.add(fins);
  // the shroud underneath, holding the fans, with an angled accent
  const shroudCol = hi ? 0x1c1f26 : 0x2a2e36;
  g.add(box(L, T * 0.3, 0.11, plastic(shroudCol), -L / 2, -T * 0.85, 0.06));
  g.add(box(L, T * 0.12, 0.003, mat(hi ? 0x7a8cff : 0x9aa0aa, { metalness: 0.7, roughness: 0.3 }), -L / 2, -T * 0.66, 0.1155));
  g.add(box(0.004, T + 0.01, 0.12, metal(0x9aa0aa), 0.002, -T / 2, 0.06)); // bracket
  // display outputs on the bracket
  for (let i = 0; i < 4; i++) g.add(box(0.002, 0.006, 0.013, 0x111318, 0.0045, -T * 0.4, 0.02 + i * 0.022));
  g.add(box(0.07, 0.003, 0.008, 0xd4af37, -0.06, 0.001, 0.004, { metalness: 0.9 })); // PCIe contacts
  // power sockets on the top edge, facing you
  for (let i = 0; i < (p.watts > 250 ? 3 : p.watts > 90 ? 2 : 1); i++) g.add(box(0.019, 0.008, 0.009, 0x111318, -L * 0.62 - i * 0.022, -0.005, 0.111));
  const n = p.fans;
  for (let i = 0; i < n; i++) {
    const f = fan(Math.min(0.045, (L / n) * 0.42), shroudCol, { frameless: true });
    f.rotation.x = Math.PI / 2;
    f.position.set(-L * ((i + 0.5) / n), -T - 0.002, 0.06);
    g.add(f);
  }
  const l = printed(hi ? 'GRAPHICS  ULTRA' : 'GRAPHICS', Math.min(0.12, L * 0.5), 0.016, { color: hi ? '#b9c4ff' : '#dfe4ee' });
  l.position.set(-L / 2, -T * 0.86, 0.1157);
  g.add(l);
  return g;
}

export function psuMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  const [w, h, d] = p.form === 'SFX' ? [0.125, 0.0635, 0.1] : [0.15, 0.086, 0.14];
  g.add(box(w, h, d, mat(0x1c1f26, { roughness: 0.75, metalness: 0.3 })));
  // the fan, behind a honeycomb grille on the underside
  const r = Math.min(w, d) * 0.4;
  const f = fan(r, 0x15171c, { frameless: true });
  f.rotation.x = Math.PI / 2;
  f.position.y = -h / 2 + r * 0.25;
  g.add(f);
  const grille = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 40), new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.6, roughness: 0.4, alphaMap: honeycomb(), alphaTest: 0.5, side: THREE.DoubleSide }));
  grille.material.alphaMap.repeat.set(4, 4);
  grille.rotation.x = Math.PI / 2;
  grille.position.y = -h / 2 - 0.0008;
  g.add(grille);
  // label on the side facing you, modular sockets on the front, the power switch and socket at the back
  const l = printed(`${p.watts} W\n80 PLUS`, w * 0.55, h * 0.55, { color: '#ffd166', bg: '#24272f' });
  l.position.z = d / 2 + 0.0006;
  g.add(l);
  for (let i = 0; i < 4; i++) g.add(box(0.0015, 0.012, 0.016, 0x0d0f12, -w / 2 - 0.0005, h * 0.18 - (i % 2) * 0.022, -d * 0.25 + Math.floor(i / 2) * 0.03));
  g.add(box(0.0015, 0.022, 0.028, 0x0d0f12, w / 2 + 0.0005, 0, -d * 0.2));
  g.add(box(0.002, 0.012, 0.008, 0x2a2e36, w / 2 + 0.001, 0, d * 0.05));
  return g;
}

/**
 * Joins a part's many small pieces into one mesh per material, so the headset draws a motherboard in a handful of
 * steps instead of a hundred. Spinning fans, lights and the power button stay separate (they change).
 */
function bake(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.led || o.userData.powerButton) return;
    for (let a = o.parent; a && a !== root; a = a.parent) if (a.userData.spin) return;
    const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(geo);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const [m, list] of groups) {
    const indexed = list.every((g) => g.index);
    const geos = list.map((g) => {
      const x = indexed ? g : g.index ? g.toNonIndexed() : g;
      for (const name of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(name)) x.deleteAttribute(name);
      if (!x.getAttribute('uv')) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.getAttribute('position').count * 2), 2));
      return x;
    });
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
    root.add(new THREE.Mesh(merged ?? geos[0], m));
  }
  // drop groups left empty
  const empty = [];
  root.traverse((o) => { if (o.isGroup && o !== root && !o.children.length) empty.push(o); });
  for (const o of empty) o.parent.remove(o);
  return root;
}

export function partMesh(id) {
  switch (PARTS[id].cat) {
    case 'board': return bake(boardMesh(id));
    case 'cpu': return bake(cpuMesh(id));
    case 'cooler': return bake(coolerMesh(id));
    case 'ram': return bake(ramMesh(id));
    case 'storage': return bake(storageMesh(id));
    case 'gpu': return bake(gpuMesh(id));
    case 'psu': return bake(psuMesh(id));
    default: return new THREE.Group();
  }
}

// ── the case ───────────────────────────────────────────

export function caseMesh(caseId) {
  const c = CASES[caseId];
  const { w, h, d } = c;
  const g = new THREE.Group();
  const paint = (color) => mat(0xffffff, { map: brushed(), color, metalness: 0.35, roughness: 0.55 });
  const body = paint(0x3a4150);
  const t = 0.004;
  g.add(box(w, h, t, paint(0x4a5262), 0, 0, -d / 2)); // right side (motherboard tray) — lighter so parts stand out
  g.add(box(w, t, d, body, 0, h / 2, 0)); // top
  g.add(box(w, t, d, body, 0, -h / 2, 0)); // bottom
  g.add(box(t, h, d, body, w / 2, 0, 0)); // rear
  // cable cut-outs in the tray, with rubber grommets, along the front of the motherboard
  const front = c.anchor[0] - (c.boards.includes('ATX') ? 0.244 : c.boards.includes('mATX') ? 0.244 : 0.17) - 0.022;
  if (front > -w / 2 + 0.03) {
    for (const y of [c.anchor[1] - 0.04, c.anchor[1] - 0.15]) {
      if (y < -h / 2 + 0.06) continue;
      g.add(box(0.014, 0.06, 0.001, plastic(0x0d0f12), front, y, -d / 2 + 0.0025));
    }
  }
  // Front panel: a mesh you can partly see through, with intake fans behind it
  const mesh = new THREE.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.5, roughness: 0.45, alphaMap: honeycomb(10), alphaTest: 0.5, side: THREE.DoubleSide });
  mesh.alphaMap.repeat.set(6, 6);
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(d, h), mesh);
  fp.rotation.y = -Math.PI / 2;
  fp.position.x = -w / 2;
  g.add(fp);
  for (const s of [-1, 1]) g.add(box(t, h, 0.012, body, -w / 2, 0, s * (d / 2 - 0.006))); // the frame round the mesh
  const nFans = h > 0.4 ? 2 : 1;
  for (let i = 0; i < nFans; i++) {
    const f = fan(Math.min(0.06, d * 0.3));
    f.rotation.y = Math.PI / 2;
    f.position.set(-w / 2 + 0.017, h * (nFans === 2 ? (i === 0 ? 0.18 : -0.12) : 0.05), 0);
    g.add(f);
  }
  // Glass side (the side facing you) — very faint, so you can see in, with a darker edge
  const glass = box(w, h, 0.002, new THREE.MeshStandardMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.06, depthWrite: false, roughness: 0.05, metalness: 0.1 }), 0, 0, d / 2);
  g.add(glass);
  // Feet and rear exhaust fan
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) g.add(box(0.03, 0.01, d * 0.9, plastic(0x15171c), x, -h / 2 - 0.007, 0));
  if (h > 0.3) {
    const ex = fan(0.05);
    ex.rotation.y = Math.PI / 2;
    ex.position.set(w / 2 - 0.014, c.anchor[1] - 0.06, 0);
    g.add(ex);
  }
  // Drive bay cages
  for (const bay of c.bays) {
    const cage = box(bay.size === 3.5 ? 0.152 : 0.105, 0.03, d * 0.75, new THREE.MeshStandardMaterial({ color: 0x5a6070, transparent: true, opacity: 0.25 }), bay.pos[0], bay.pos[1], 0);
    g.add(cage);
  }
  // Power button on the top front
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 24), new THREE.MeshStandardMaterial({ color: 0x2a3040, emissive: 0x000000, metalness: 0.6, roughness: 0.3 }));
  btn.position.set(-w / 2 + 0.04, h / 2 + 0.004, d / 4);
  btn.userData.powerButton = true;
  g.add(btn);
  const name = printed(c.short.toUpperCase(), 0.12, 0.02, { color: '#8a93ad' });
  name.position.set(-w / 2 + 0.1, -h / 2 + 0.03, d / 2 - 0.004);
  g.add(name);
  return bake(g);
}

/** A see-through copy of a part, used to preview where it will go (green = fits, red = does not). */
export function ghostOf(id, ok) {
  const g = partMesh(id);
  const m = new THREE.MeshBasicMaterial({ color: ok ? 0x56d68c : 0xff5a5a, transparent: true, opacity: 0.35, depthWrite: false });
  g.traverse((o) => {
    if (o.isMesh) o.material = m;
  });
  return g;
}
