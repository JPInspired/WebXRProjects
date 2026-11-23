import * as THREE from 'three';
import { CanvasPanel, THEME } from '../../../../shared/ui/CanvasPanel.js';
import { activity } from '../data/enzymes.js';
import { TOP } from './Bench.js';

// Inside the flask (see what the textbook only describes): the molecules in the flask, magnified about ten
// million times, following the experiment as it happens.
//  • Hydrogen peroxide (H₂O₂) molecules drift about, faster when it is warmer.
//  • Once the liver is in, catalase (the enzyme) appears. A peroxide molecule that drifts into its active site
//    is held there for a moment and broken apart: water (H₂O) drifts off and, for every two, an oxygen
//    molecule (O₂) rises away as part of a bubble. 2 H₂O₂ → 2 H₂O + O₂.
//  • How often that happens follows the same model as the experiment (activity(T) in data/enzymes.js).
//  • Too hot (above about 45 °C), the enzyme loses its shape: the active site falls apart, the peroxide no
//    longer fits, and nothing happens (denatured).
//  • The peroxide runs out as the reaction goes on, in step with the oxygen in the measuring cylinder.
// Shown in a magnified glass bubble above the flask. (An 'all around you' view was tried on 23 November 2026;
// the bubble was kept as cleaner and tidier.)

const N = 26; // peroxide molecules when the flask is fresh
const ENZYMES = 1;
const R_ATOM = { O: 0.034, H: 0.022 };
const COL = { O: 0xe5484d, H: 0xf4f6fb };
const BUBBLE_AT = new THREE.Vector3(-0.07, TOP + 0.38, -0.04); // above the flask (lab space)
const BUBBLE_R = 0.17; // m

const atomGeo = new THREE.SphereGeometry(1, 16, 12);
const bondGeo = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0).rotateX(Math.PI / 2); // along +z
const mats = {
  O: new THREE.MeshStandardMaterial({ color: COL.O, roughness: 0.35, metalness: 0.05 }),
  H: new THREE.MeshStandardMaterial({ color: COL.H, roughness: 0.35 }),
  bond: new THREE.MeshStandardMaterial({ color: 0xc9cede, roughness: 0.5 }),
};

/** A small ball-and-stick molecule: atoms [[el, x, y, z]], bonds [[i, j]] (unit space). */
function molecule(atoms, bonds) {
  const g = new THREE.Group();
  const at = atoms.map(([el, x, y, z]) => {
    const m = new THREE.Mesh(atomGeo, mats[el]);
    m.scale.setScalar(R_ATOM[el]);
    m.position.set(x, y, z);
    g.add(m);
    return m.position;
  });
  for (const [i, j] of bonds) {
    const b = new THREE.Mesh(bondGeo, mats.bond);
    b.position.copy(at[i]);
    b.lookAt(at[j].clone().add(g.position));
    b.scale.set(0.008, 0.008, at[i].distanceTo(at[j]));
    g.add(b);
  }
  return g;
}
const D = 0.05; // bond length (unit space)
const peroxideShape = () => molecule([['O', -D / 2, 0, 0], ['O', D / 2, 0, 0], ['H', -D / 2 - 0.02, D * 0.75, 0.02], ['H', D / 2 + 0.02, -D * 0.2, D * 0.72]], [[0, 1], [0, 2], [1, 3]]);
const waterShape = () => molecule([['O', 0, 0, 0], ['H', -D * 0.8, D * 0.6, 0], ['H', D * 0.8, D * 0.6, 0]], [[0, 1], [0, 2]]);
const oxygenShape = () => molecule([['O', -D / 2, 0, 0], ['O', D / 2, 0, 0]], [[0, 1]]);

/**
 * Catalase, drawn as a lumpy protein (its chain folded into a shape) with a pocket, the active site, facing
 * +z, and the iron-containing haem glowing at the back of it. denature(d) 0..1 unfolds it.
 */
class Enzyme {
  constructor() {
    this.group = new THREE.Group();
    const lobes = [];
    // a rough ball of lobes, leaving a pocket on the +z side
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() > 1) { i--; continue; }
      const p = v.multiplyScalar(0.2);
      if (p.z > 0.05 && Math.hypot(p.x, p.y) < 0.085) { i--; continue; } // the pocket
      lobes.push({ home: p, r: 0.05 + rnd() * 0.035, loose: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).multiplyScalar(0.18) });
    }
    this.lobes = lobes;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x46b39b, roughness: 0.55, metalness: 0.05 });
    this.mesh = new THREE.InstancedMesh(atomGeo, this.mat, lobes.length);
    this.group.add(this.mesh);
    // the haem at the back of the pocket, and a ring marking the active site
    this.haem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb0322b, emissive: 0xff5a3c, emissiveIntensity: 0.4, roughness: 0.4 }));
    this.haem.position.set(0, 0, 0.06);
    this.group.add(this.haem);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, toneMapped: false }));
    this.ring.position.set(0, 0, 0.27);
    this.group.add(this.ring);
    this.d = 0;
    this.denature(0);
  }

  /** Inside the pocket (enzyme space): where a peroxide molecule is held while it is broken down. */
  get site() { return new THREE.Vector3(0, 0, 0.13); }

  /** The mouth of the pocket, on the surface (enzyme space): a molecule this close is caught. */
  get mouth() { return new THREE.Vector3(0, 0, 0.3); }

  denature(d) {
    this.d = d;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const t = performance.now() / 1000;
    this.lobes.forEach((l, i) => {
      // folded (home) → unfolded (spread out and wobbling)
      p.copy(l.home).lerp(l.home.clone().multiplyScalar(1.5).add(l.loose), d);
      p.x += Math.sin(t * 1.3 + i) * 0.004 * (1 + 4 * d);
      p.y += Math.cos(t * 1.1 + i * 1.7) * 0.004 * (1 + 4 * d);
      m.compose(p, new THREE.Quaternion(), new THREE.Vector3().setScalar(l.r * (1 - 0.15 * d)));
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mat.color.setHex(0x46b39b).lerp(new THREE.Color(0x8a8478), d);
    this.ring.visible = d < 0.5;
    this.haem.position.z = 0.06 + d * 0.08;
  }
}

export class Molecules {
  constructor(app) {
    this.app = app;
    this.mode = 'off'; // 'off' | 'bubble'
    this.root = new THREE.Group(); // unit space: everything happens inside a sphere of radius 1
    this.root.visible = false;

    // the molecules
    this.peroxide = [];
    for (let i = 0; i < N; i++) {
      const g = peroxideShape();
      this.root.add(g);
      this.peroxide.push({ g, v: new THREE.Vector3(), spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).subScalar(0.5), state: 'free', t: 0 });
    }
    this.products = []; // { g, v, life, kind }
    this.enzyme = new Enzyme();
    this.enzyme.group.scale.setScalar(1.25);
    this.root.add(this.enzyme.group);
    this.made = 0; // water molecules made (two make one oxygen)
    this.rate = 0;
    this.scatter(true);

    // the bubble: a glass ball above the flask, and a faint cone down to the flask (it is the flask, magnified)
    this.bubble = new THREE.Group();
    this.glass = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.12, roughness: 0.05, side: THREE.BackSide, depthWrite: false }));
    this.rim = new THREE.Mesh(new THREE.SphereGeometry(1.005, 40, 24), new THREE.MeshBasicMaterial({ color: 0x9ec9ff, transparent: true, opacity: 0.18, wireframe: true, depthWrite: false }));
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9ec9ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    this.cone.position.y = -1.45;
    this.cone.rotation.x = Math.PI; // narrow end down at the flask
    this.bubble.add(this.glass, this.rim, this.cone);

    // the caption: what you are looking at, and what is happening
    this.caption = new CanvasPanel({ width: 0.42, height: 0.2, name: 'molecules-card', fit: 0.08 });
    this.caption.mesh.renderOrder = 5;
    this.caption.setBuilder((ui) => this.drawCaption(ui));
  }

  /** Spread the peroxide out again (a fresh flask), all of it unused. */
  scatter(all = false) {
    for (const m of this.peroxide) {
      if (!all && m.state === 'gone') continue;
      m.state = 'free';
      m.g.visible = true;
      m.g.position.copy(randomInBall(0.92, 0.32));
      m.v.copy(randomInBall(1, 0)).multiplyScalar(0.05);
    }
    for (const p of this.products) this.root.remove(p.g);
    this.products = [];
    this.made = 0;
  }

  /** 'off' | 'bubble' */
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    const app = this.app;
    this.root.removeFromParent();
    this.bubble.removeFromParent();
    this.caption.mesh.removeFromParent();
    this.root.visible = mode !== 'off';
    if (mode === 'bubble') {
      // in the lab, above the flask
      app.lab.add(this.bubble, this.root, this.caption.mesh);
      this.bubble.position.copy(BUBBLE_AT);
      this.bubble.scale.setScalar(BUBBLE_R);
      this.root.position.copy(BUBBLE_AT);
      this.root.scale.setScalar(BUBBLE_R);
      this.root.quaternion.identity();
      this.caption.mesh.position.set(BUBBLE_AT.x + 0.33, BUBBLE_AT.y + 0.08, BUBBLE_AT.z);
      this.caption.mesh.rotation.set(0, -0.35, 0);
    }
    this.caption.redraw();
  }

  get bench() { return this.app.bench; }

  update(dt) {
    if (this.mode === 'off') return;
    const b = this.bench;
    const T = b.T;
    const enzymeIn = !!b.inFlask;
    const used = b.x ?? 0; // share of the peroxide used up
    const d = THREE.MathUtils.smoothstep(T, 47, 63); // how far the enzyme has lost its shape
    this.enzyme.group.visible = enzymeIn;
    this.enzyme.denature(d);

    // how many peroxide molecules are left: in step with the reaction in the flask
    const want = Math.round(N * (1 - used));
    let free = this.peroxide.filter((m) => m.state !== 'gone').length;
    for (const m of this.peroxide) if (free > want && m.state === 'free') { m.state = 'gone'; m.g.visible = false; free--; }
    // a fresh flask: the peroxide is back
    for (const m of this.peroxide) {
      if (free >= want) break;
      if (m.state !== 'gone') continue;
      m.state = 'free';
      m.g.visible = true;
      m.g.position.copy(randomInBall(0.92, 0.45));
      free++;
    }

    // moving about: faster when warmer (speed ∝ √ of the absolute temperature, exaggerated to be seen)
    const speed = 0.11 * Math.sqrt((T + 273) / 300) * (0.5 + T / 80);
    const es = this.enzyme.group.scale.x;
    const site = this.enzyme.site.multiplyScalar(es).add(this.enzyme.group.position);
    const mouth = this.enzyme.mouth.multiplyScalar(es).add(this.enzyme.group.position);
    const act = enzymeIn ? activity(T) : 0;
    // How often the enzyme catches a peroxide molecule follows the same activity as the experiment (about
    // 1.5 a second at its best, a tenth of that at 0 °C, almost never once it has denatured). In the real flask
    // collisions are constant; with only a few molecules shown, the nearest one is drawn into the active site.
    if (act > 0 && !this.peroxide.some((o) => o.state === 'held') && Math.random() < 1 - Math.exp(-act * 1.5 * dt)) {
      let best = null;
      for (const m of this.peroxide) if (m.state === 'free' && (!best || m.g.position.distanceTo(mouth) < best.g.position.distanceTo(mouth))) best = m;
      if (best) { best.state = 'held'; best.t = 0; }
    }
    for (const m of this.peroxide) {
      if (m.state === 'gone') continue;
      if (m.state === 'held') {
        // in the active site: held a moment, then broken apart
        m.t += dt;
        m.g.position.lerp(site, Math.min(1, dt * 6)); // (flies in, then is held)
        m.g.rotation.x += dt * 8;
        if (m.t > 0.8) this.breakDown(m, site);
        continue;
      }
      // a random walk (Brownian motion)
      m.v.add(randomInBall(1, 0).multiplyScalar(speed * 1.6 * dt)).clampLength(0, speed);
      m.g.position.addScaledVector(m.v, dt);
      m.g.rotation.x += m.spin.x * dt * 3;
      m.g.rotation.y += m.spin.y * dt * 3;
      this.keepInside(m);
      // keep them off the enzyme itself (it is solid)
      if (enzymeIn) {
        const c = this.enzyme.group.position;
        const r = 0.3 * es;
        const off = m.g.position.clone().sub(c);
        if (off.length() < r && m.state === 'free') m.g.position.copy(c).addScaledVector(off.normalize(), r);
      }
    }
    // products drift off: water wanders, oxygen rises (a bubble forming)
    for (const p of [...this.products]) {
      p.life += dt;
      if (p.kind === 'O2') p.v.y += dt * 0.06;
      p.g.position.addScaledVector(p.v, dt);
      p.g.rotation.y += dt;
      const fade = p.kind === 'O2' ? p.g.position.y > 0.95 || p.life > 9 : p.life > 7;
      if (fade) { this.root.remove(p.g); this.products.splice(this.products.indexOf(p), 1); }
    }
    // how many are broken down a second (smoothed), for the caption
    this.rateSmooth = (this.rateSmooth ?? 0) + ((this.madeRecent ?? 0) - (this.rateSmooth ?? 0)) * Math.min(1, dt * 0.8);
    this.madeRecent = Math.max(0, (this.madeRecent ?? 0) - dt * (this.madeRecent ?? 0));
    this.captionClock = (this.captionClock ?? 0) + dt;
    if (this.captionClock > 0.5) { this.captionClock = 0; this.caption.redraw(); }
    this.lastState = { enzymeIn, d, T, left: free };
  }

  breakDown(m, site) {
    m.state = 'gone';
    m.g.visible = false;
    const w = waterShape();
    w.position.copy(site);
    this.root.add(w);
    this.products.push({ g: w, v: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, 0.6 + Math.random() * 0.3).multiplyScalar(0.12), life: 0, kind: 'H2O' });
    this.made++;
    this.madeRecent = (this.madeRecent ?? 0) + 1;
    if (this.made % 2 === 0) {
      const o = oxygenShape();
      o.position.copy(site).add(new THREE.Vector3(0, 0.05, 0.05));
      this.root.add(o);
      this.products.push({ g: o, v: new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.08, 0.05), life: 0, kind: 'O2' });
    }
    this.enzyme.ring.material.opacity = 1;
  }

  keepInside(m) {
    const p = m.g.position;
    if (p.length() > 0.93) { p.setLength(0.93); m.v.reflect(p.clone().normalize()).multiplyScalar(0.8); }
  }

  drawCaption(ui) {
    const s = this.lastState ?? { enzymeIn: false, d: 0, T: this.bench?.T ?? 20, left: N };
    ui.y = 22;
    ui.text('INSIDE THE FLASK · ×10 MILLION', { size: 22, weight: 700, color: THEME.accent });
    let line, col = THEME.text;
    if (!s.enzymeIn) line = 'Only hydrogen peroxide: no enzyme yet, so almost nothing happens. Put the liver in.';
    else if (s.d > 0.5) { line = `At ${s.T} °C catalase has lost its shape (denatured). The peroxide no longer fits the active site, so nothing happens.`; col = '#ffb4a8'; }
    else if (s.left === 0) line = 'All the hydrogen peroxide has been broken down.';
    else line = `Catalase holds each peroxide molecule in its active site and breaks it apart: 2 H₂O₂ → 2 H₂O + O₂. ${s.T <= 10 ? 'Cold: the molecules move slowly and meet the enzyme less often.' : s.d > 0.05 ? 'Getting too hot: the enzyme is starting to lose its shape.' : 'Warmer means faster, up to about 45 °C.'}`;
    ui.text(line, { size: 21, color: col });
    // the key
    const ctx = ui.ctx;
    ui.gap(4);
    const items = [['#e5484d', 'O', 'oxygen atom'], ['#f4f6fb', 'H', 'hydrogen atom'], ['#46b39b', '', 'catalase (enzyme)']];
    let x = ui.pad;
    for (const [c, , label] of items) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + 9, ui.y + 12, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = THEME.dim;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 24, ui.y + 13);
      x += 24 + ctx.measureText(label).width + 22;
    }
    ctx.textBaseline = 'top';
    ui.y += 30;
  }
}

/** A random point in a ball of radius r (at least rMin from the middle). */
function randomInBall(r, rMin) {
  const v = new THREE.Vector3();
  do v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  while (v.lengthSq() > 1 || v.length() * r < rMin);
  return v.multiplyScalar(r);
}
