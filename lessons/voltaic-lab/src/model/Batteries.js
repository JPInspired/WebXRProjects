import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { TOP } from './Bench.js';

// Real batteries, cut open (plenary), each about three times life size so the layers are easy to see:
//   an alkaline AA (zinc gel in the middle, manganese dioxide round it, a steel can),
//   a lithium-ion cell (a "jelly roll" of thin layers wound together),
//   a car battery with its lid off (six cells of lead and lead dioxide plates in sulfuric acid).
// Tap one to read about it.

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide, ...o });

function halfCyl(r, h, color, o) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true, 0, Math.PI), mat(color, o));
}

function cutFace(rOut, h, layers) {
  // a flat rectangle (the cut through the middle) coloured in bands from the axis outwards
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const x = c.getContext('2d');
  for (const [r0, r1, col] of layers) {
    x.fillStyle = col;
    const a = 128 - (r1 / rOut) * 128;
    const b = 128 - (r0 / rOut) * 128;
    x.fillRect(a, 0, b - a, 512);
    x.fillRect(256 - b, 0, b - a, 512);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(rOut * 2, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, side: THREE.DoubleSide }));
}

function spiralFace(r, h) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#9aa0aa';
  x.fillRect(0, 0, 512, 512);
  // the wound layers seen end-on
  const cols = ['#202226', '#f2f2ee', '#8a6a52', '#f2f2ee'];
  for (let i = 0; i < 4; i++) {
    x.strokeStyle = cols[i];
    x.lineWidth = 7;
    x.beginPath();
    for (let a = 0; a < Math.PI * 2 * 9; a += 0.05) {
      const rr = 20 + (a / (Math.PI * 2)) * 24 + i * 6;
      if (rr > 245) break;
      const px = 256 + rr * Math.cos(a);
      const py = 256 + rr * Math.sin(a);
      if (a === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
  m.position.y = h / 2 + 0.0005;
  m.rotation.x = -Math.PI / 2;
  return m;
}

export class Batteries {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.picks = [];
    const tagAt = (text, x, y, z) => {
      const t = makeLabel(text, { height: 0.011, size: 34 });
      t.position.set(x, y, z);
      this.group.add(t);
    };
    const pickable = (obj, id) => obj.traverse((o) => { if (o.isMesh) { o.userData = { handler: this, battery: id }; this.picks.push(o); } });

    // ── alkaline AA, ×3: 43 mm across, 150 mm long, lying down, cut along its length ──
    const aa = new THREE.Group();
    const R = 0.0218;
    const L = 0.15;
    const can = halfCyl(R, L, 0xb8bec8, { metalness: 0.7, roughness: 0.3 });
    const label = halfCyl(R * 1.01, L * 0.9, 0x1b1b1f);
    const face = cutFace(R, L, [[0, 0.0015, '#c99a2e'], [0.0015, 0.011, '#9fa6ad'], [0.011, 0.0125, '#f0eee6'], [0.0125, 0.0205, '#26282c'], [0.0205, R, '#b8bec8']]);
    face.rotation.y = Math.PI / 2;
    const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 20), mat(0xc8ced8, { metalness: 0.8, roughness: 0.25 }));
    nub.position.y = L / 2 + 0.002;
    aa.add(can, label, face, nub);
    aa.rotation.set(0.6, 0, -Math.PI / 2); // lying down, the cut face turned up towards you
    aa.position.set(-0.27, TOP + R, 0.1);
    this.group.add(aa);
    pickable(aa, 'aa');
    tagAt('Alkaline AA (cut open, ×3)', -0.27, TOP + 0.07, 0.1);
    tagAt('zinc gel (−)', -0.31, TOP + 0.048, 0.125);
    tagAt('manganese dioxide (+)', -0.23, TOP + 0.048, 0.125);

    // ── lithium-ion 18650, ×3: standing up, a quarter cut away to show the jelly roll ──
    const li = new THREE.Group();
    const r2 = 0.027;
    const h2 = 0.13;
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(r2, r2, h2, 40, 1, true, 0, Math.PI * 1.5), mat(0x2f6bd8, { roughness: 0.4 }));
    const top = spiralFace(r2 * 0.98, h2);
    // the two cut faces of the missing quarter: the wound layers seen side-on, as thin vertical bands
    const bands = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 64;
      const x = c.getContext('2d');
      const cols = ['#202226', '#f2f2ee', '#8a6a52', '#f2f2ee'];
      for (let i = 0; i < 64; i++) {
        x.fillStyle = cols[i % 4];
        x.fillRect(i * 4, 0, 4, 64);
      }
      x.fillStyle = '#c9cfdc';
      x.fillRect(0, 0, 10, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, side: THREE.DoubleSide });
    };
    const faceZ = new THREE.Mesh(new THREE.PlaneGeometry(r2, h2), bands());
    faceZ.rotation.y = -Math.PI / 2;
    faceZ.position.z = r2 / 2;
    const faceX = new THREE.Mesh(new THREE.PlaneGeometry(r2, h2), bands());
    faceX.rotation.y = Math.PI;
    faceX.position.x = -r2 / 2;
    li.add(shell, top, faceZ, faceX);
    li.position.set(0.0, TOP + h2 / 2, 0.1);
    li.rotation.y = Math.PI / 4; // the open quarter faces you
    this.group.add(li);
    pickable(li, 'li');
    tagAt('Lithium-ion cell (×3)', 0.0, TOP + h2 + 0.03, 0.1);
    tagAt('wound layers: graphite | separator | metal oxide', 0.0, TOP + h2 + 0.012, 0.13);

    // ── car battery, about a third of life size, lid off: 6 cells of plates ──
    const car = new THREE.Group();
    const bw = 0.16;
    const bh = 0.1;
    const bd = 0.09;
    const box = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat(0x1d1f24, { transparent: true, opacity: 0.55, depthWrite: false }));
    box.position.y = bh / 2;
    car.add(box);
    for (let i = 0; i < 6; i++) {
      const cx = -bw / 2 + bw / 12 + (i * bw) / 6;
      const acid = new THREE.Mesh(new THREE.BoxGeometry(bw / 6 - 0.004, bh * 0.75, bd - 0.008), mat(0xe9f2c4, { transparent: true, opacity: 0.3, depthWrite: false }));
      acid.position.set(cx, bh * 0.4, 0);
      car.add(acid);
      for (let p = 0; p < 6; p++) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.0018, bh * 0.7, bd - 0.016), mat(p % 2 ? 0x6a4232 : 0x6c7078, { roughness: 0.8 }));
        plate.position.set(cx - bw / 15 + (p * bw) / 50, bh * 0.4, 0);
        car.add(plate);
      }
      if (i < 5) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.002, bh * 0.85, bd - 0.004), mat(0x2a2c32));
        wall.position.set(cx + bw / 12, bh * 0.43, 0);
        car.add(wall);
      }
    }
    for (const [x, col] of [[-bw / 2 + 0.02, 0x2a2c32], [bw / 2 - 0.02, 0xd42a2a]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.016, 16), mat(col));
      post.position.set(x, bh + 0.008, -bd / 2 + 0.015);
      car.add(post);
    }
    car.position.set(0.27, TOP, 0.08);
    this.group.add(car);
    pickable(car, 'lead');
    tagAt('Car battery: 6 cells × 2 V = 12 V', 0.27, TOP + bh + 0.04, 0.08);
    tagAt('lead (−) and lead dioxide (+) plates in sulfuric acid', 0.27, TOP + bh + 0.022, 0.12);
    this.setVisible(false);
  }

  setVisible(on) {
    this.group.visible = on;
  }

  get targets() {
    return this.group.visible ? this.picks : [];
  }

  describe(o) {
    return { aa: 'Alkaline AA · tap to read about it', li: 'Lithium-ion cell · tap to read about it', lead: 'Car battery · tap to read about it' }[o.userData.battery];
  }

  tap(o) {
    this.app.aboutBattery(o.userData.battery);
  }

  grab() {
    return null;
  }
}
