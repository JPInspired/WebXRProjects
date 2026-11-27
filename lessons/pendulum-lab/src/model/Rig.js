import * as THREE from 'three';
import { benchTop, standBase, bossHead } from '../../../../shared/lab/kit.js';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { BOBS, dragK } from '../data/pendulum.js';
import { mirrorLine } from '../../../../shared/net/LabMirror.js'; // (the class copy draws these lines from their points)

// The bench rig, as in the original lesson: a big protractor board (0–90° each side) with the pendulum hanging
// in front of it and up / down buttons for the length. Grab the bob, pull it out to an angle and let go (or
// use the panel). A stopwatch on the bench (start / stop, count a swing, reset) for timing by hand, and a light
// gate at the bottom of the swing that times each period exactly.
// Beside it, a giant pendulum hangs from the classroom ceiling (1.5–2.5 m).
//
// Pend is the physics, shared by every pendulum in the lesson: θ'' = −(g/L) sin θ − k v|v| / L − friction.

export const TOP = -0.3;
const PIVOT = new THREE.Vector3(0, 0.68, -0.12);
const PROT_R = 0.3;
const WATCH = new THREE.Vector3(0.27, TOP, 0.14);
const GIANT_AT = new THREE.Vector3(0, 0, -1.15); // x, z; the pivot is 2.75 m above the floor
const GIANT_PIVOT_H = 2.75;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, envMapIntensity: 0.6, ...o });
const metal = mat(0xb8bec8, { metalness: 0.75, roughness: 0.3 });

export class Pend {
  constructor({ L = 0.5, g = 9.81, bob = 'steel', air = 1 } = {}) {
    this.L = L;
    this.g = g;
    this.bob = bob;
    this.air = air;
    this.th = 0;
    this.w = 0;
    this.t = 0;
    this.running = false;
    this.E0 = 0;
    this.peaks = []; // [t, |θ| in degrees] at each turning point
    this.crossings = []; // times it crossed the bottom going the same way (light gate)
    this.onCross = null;
    this.onTurn = null;
  }

  get m() {
    return BOBS[this.bob].m;
  }

  release(deg) {
    this.th = (deg * Math.PI) / 180;
    this.w = 0;
    this.t = 0;
    this.running = true;
    this.E0 = this.gpe();
    this.peaks = [[0, deg]];
    this.crossings = [];
  }

  hold(th) {
    this.running = false;
    this.th = th;
    this.w = 0;
  }

  stop() {
    this.running = false;
    this.th = 0;
    this.w = 0;
    this.peaks = [];
    this.crossings = [];
  }

  gpe() {
    return this.m * this.g * this.L * (1 - Math.cos(this.th));
  }

  ke() {
    const v = this.L * this.w;
    return 0.5 * this.m * v * v;
  }

  step(dt) {
    if (!this.running) return;
    const k = dragK(this.bob, this.air);
    const n = Math.max(1, Math.ceil(dt / 0.002));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const v = this.L * this.w;
      const acc = -(this.g / this.L) * Math.sin(this.th) - (k * v * Math.abs(v)) / this.L - 0.002 * this.w;
      const wBefore = this.w;
      const thBefore = this.th;
      this.w += acc * h;
      this.th += this.w * h;
      this.t += h;
      if (thBefore < 0 && this.th >= 0) {
        this.crossings.push(this.t);
        this.onCross?.(this);
      }
      if (Math.sign(wBefore) !== Math.sign(this.w) && wBefore !== 0) {
        this.peaks.push([this.t, (Math.abs(this.th) * 180) / Math.PI]);
        if (this.peaks.length > 400) this.peaks.shift();
        this.onTurn?.(this);
      }
    }
  }

  /** Exact period from the last two light-gate crossings (s), or null. */
  gatePeriod() {
    const c = this.crossings;
    return c.length >= 2 ? c.at(-1) - c.at(-2) : null;
  }

  get amplitude() {
    return this.peaks.at(-1)?.[1] ?? 0;
  }
}

function protractorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 560;
  const x = c.getContext('2d');
  const cx = 512;
  const cy = 30;
  const R = 490;
  x.fillStyle = '#e9c97a';
  x.beginPath();
  x.moveTo(cx - R, cy);
  x.arc(cx, cy, R, 0, Math.PI);
  x.closePath();
  x.fill();
  x.strokeStyle = '#3a2a10';
  x.fillStyle = '#2a1e0a';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let d = -90; d <= 90; d++) {
    const a = Math.PI / 2 + (d * Math.PI) / 180;
    const len = d % 10 === 0 ? 46 : d % 5 === 0 ? 30 : 16;
    x.lineWidth = d % 10 === 0 ? 4 : 2;
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    x.lineTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len));
    x.stroke();
    if (d % 10 === 0) {
      x.font = 'italic 800 34px system-ui, sans-serif';
      x.fillText(String(Math.abs(d)), cx + Math.cos(a) * (R - 80), cy + Math.sin(a) * (R - 80));
    }
  }
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(cx - R, cy);
  x.lineTo(cx + R, cy);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function canvasTex(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t, x: c.getContext('2d') };
}

function makeBob(id) {
  const b = BOBS[id];
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(b.r, 24, 16), mat(b.color, b.metal ? { metalness: 0.8, roughness: 0.25 } : { roughness: 0.7 }));
  g.add(ball);
  if (b.sail) {
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.11), mat(0xf6f3ea, { side: THREE.DoubleSide, roughness: 0.9 }));
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.14, 0.25), mat(0xf6f3ea, { roughness: 0.9 }));
    card.position.y = 0.08;
    g.add(card);
    void sail;
  }
  g.userData.ball = ball;
  return g;
}

export class Rig {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.bench = new Pend({ L: 0.5 });
    this.giant = new Pend({ L: 2.0 });
    this.target = 'bench'; // which pendulum the stopwatch, gate and energy display follow
    this.deg = 10;
    this.watch = { running: false, t0: 0, t: 0, n: 0 };
    this.tmp = new THREE.Vector3();

    const top = benchTop(0.92, 0.5); // a dark lab bench (shared lab kit)
    top.position.set(0, TOP, 0.02);
    this.group.add(top);

    // ── the protractor board and the gallows ──
    this.benchGroup = new THREE.Group();
    this.group.add(this.benchGroup);
    const prot = new THREE.Mesh(new THREE.PlaneGeometry(PROT_R * 2.09, PROT_R * 1.14), new THREE.MeshStandardMaterial({ map: protractorTexture(), transparent: true, roughness: 0.8 }));
    prot.position.set(PIVOT.x, PIVOT.y - PROT_R * 0.51, PIVOT.z - 0.03);
    // an anodised aluminium frame on cast-iron feet, the string held in a boss clamp
    const frame = mat(0x3a3f50, { metalness: 0.65, roughness: 0.35, envMapIntensity: 0.9 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, PIVOT.y - TOP + 0.03, 0.03), frame);
    post.position.set(PIVOT.x - 0.4, (PIVOT.y + TOP + 0.03) / 2, PIVOT.z - 0.03);
    const post2 = post.clone();
    post2.position.x = PIVOT.x + 0.4;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.03, 0.03), frame);
    for (const fx of [-0.4, 0.4]) {
      const foot = standBase(0.09, 0.12);
      foot.position.set(PIVOT.x + fx, TOP, PIVOT.z - 0.03);
      this.benchGroup.add(foot);
    }
    beam.position.set(PIVOT.x, PIVOT.y + 0.03, PIVOT.z - 0.03);
    const clamp = bossHead();
    clamp.position.set(PIVOT.x, PIVOT.y + 0.012, PIVOT.z - 0.012);
    this.benchGroup.add(prot, post, post2, beam, clamp);
    this.string = mirrorLine(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x222222 })));
    this.benchGroup.add(this.string);
    this.bobMesh = makeBob('steel');
    this.bobMesh.userData.ball.userData = { handler: this, bob: 'bench' };
    this.benchGroup.add(this.bobMesh);

    // up / down buttons for the length, as in the original
    const btn = (label, y, key) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.012), mat(0x1b2a44));
      b.position.set(PIVOT.x - 0.47, PIVOT.y - 0.18 + y, PIVOT.z);
      b.userData = { handler: this, [key]: true, tapOnly: true };
      const t = makeLabel(label, { height: 0.022, size: 48 });
      t.position.copy(b.position).add(new THREE.Vector3(0, 0, 0.008));
      this.benchGroup.add(b, t);
      return b;
    };
    this.upBtn = btn('∧', 0.025, 'shorter');
    this.downBtn = btn('∨', -0.025, 'longer');
    this.lenTag = makeLabel('0.50 m', { height: 0.016, size: 40 });
    this.benchGroup.add(this.lenTag);

    // light gate at the bottom of the swing (moves with the length)
    this.gate = new THREE.Group();
    const gpost = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 8), mat(0x30343e));
    this.gatePost = gpost;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), mat(0x30343e));
    armL.position.set(0, 0, -0.04);
    const armR = armL.clone();
    armR.position.z = 0.04;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.08, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.6 }));
    this.gate.add(armL, armR, this.beam);
    this.benchGroup.add(this.gate, gpost);
    this.gateFlash = 0;

    // ── stopwatch ──
    this.watchGroup = new THREE.Group();
    this.watchGroup.position.copy(WATCH);
    this.group.add(this.watchGroup);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.11), mat(0x23293d));
    body.position.y = 0.006;
    this.screen = canvasTex(384, 128);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.05), new THREE.MeshBasicMaterial({ map: this.screen.t, toneMapped: false }));
    face.rotation.x = -Math.PI / 2 + 0.5;
    face.position.set(0, 0.03, -0.025);
    this.watchGroup.add(body, face);
    const wbtn = (label, x, color, key) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 20), mat(color));
      b.position.set(x, 0.016, 0.03);
      b.userData = { handler: this, [key]: true, tapOnly: true };
      const t = makeLabel(label, { height: 0.009, size: 32 });
      t.position.set(x, 0.035, 0.03);
      this.watchGroup.add(b, t);
      return b;
    };
    this.watchBtns = [wbtn('Start / stop', -0.055, 0x2f9b5c, 'startStop'), wbtn('Count a swing', 0.005, 0xe08a2a, 'count'), wbtn('Reset', 0.06, 0x6a7186, 'reset')];

    // ── giant pendulum from the ceiling ──
    this.giantGroup = new THREE.Group();
    this.group.add(this.giantGroup);
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.15), mat(0x5a6070));
    mount.position.y = GIANT_PIVOT_H;
    this.giantString = mirrorLine(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xdddddd })));
    this.giantBob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), mat(0xd4a83a, { metalness: 0.8, roughness: 0.25 }));
    this.giantBob.userData = { handler: this, bob: 'giant' };
    this.giantArc = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.42, 64, 1, Math.PI * 1.25, Math.PI * 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    this.giantArc.position.y = GIANT_PIVOT_H;
    this.giantGate = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.3, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.6 }));
    this.giantGroup.add(mount, this.giantString, this.giantBob, this.giantArc, this.giantGate);
    this.giantTag = makeLabel('Giant pendulum', { height: 0.05, size: 44 });
    this.giantGroup.add(this.giantTag);
    this.giantGroup.visible = false;

    for (const p of [this.bench, this.giant]) p.onCross = (pp) => { if (pp === this.active) this.gateFlash = 1; };
    this.drawWatch();
  }

  get active() {
    return this.target === 'giant' ? this.giant : this.bench;
  }

  setBob(id) {
    this.bench.bob = id;
    this.bench.stop();
    this.benchGroup.remove(this.bobMesh);
    this.bobMesh = makeBob(id);
    this.bobMesh.userData.ball.userData = { handler: this, bob: 'bench' };
    this.benchGroup.add(this.bobMesh);
  }

  // ───────────── stopwatch ─────────────

  startStop() {
    const w = this.watch;
    if (!w.running) {
      this.watch = { running: true, t0: performance.now(), t: 0, n: 0, g0: this.active.crossings.length };
      return 'start';
    }
    w.t = (performance.now() - w.t0) / 1000;
    w.running = false;
    return 'stop';
  }

  countSwing() {
    if (!this.watch.running) return false;
    this.watch.n++;
    return true;
  }

  resetWatch() {
    this.watch = { running: false, t0: 0, t: 0, n: 0 };
  }

  /** The light gate's mean period over the stopwatch timing (s), or its last period. */
  gateMean() {
    const c = this.active.crossings;
    const from = this.watch.g0 ?? 0;
    const seg = c.slice(Math.max(0, from - 1));
    if (seg.length >= 2) return (seg.at(-1) - seg[0]) / (seg.length - 1);
    return this.active.gatePeriod();
  }

  drawWatch() {
    const { x, c, t } = this.screen;
    const w = this.watch;
    x.fillStyle = '#0e1a14';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = w.running ? '#7dffb0' : '#c8f5d8';
    x.font = '700 62px ui-monospace, monospace';
    x.textBaseline = 'middle';
    x.fillText(`${String(Math.floor(w.t / 60)).padStart(2, '0')}:${(w.t % 60).toFixed(2).padStart(5, '0')}`, 18, 48);
    x.font = '600 30px system-ui, sans-serif';
    x.fillStyle = '#ffd166';
    x.fillText(`Swings: ${w.n}`, 20, 104);
    t.needsUpdate = true;
  }

  // ───────────── interaction ─────────────

  get targets() {
    const t = [...this.watchBtns];
    if (this.benchGroup.visible) t.push(this.bobMesh.userData.ball, this.upBtn, this.downBtn);
    if (this.giantGroup.visible) t.push(this.giantBob);
    return t;
  }

  describe(o) {
    const u = o.userData;
    if (u.shorter) return 'Make the string shorter';
    if (u.longer) return 'Make the string longer';
    if (u.startStop) return 'Stopwatch: start / stop';
    if (u.count) return 'Count a swing (each time it comes back to where you let go)';
    if (u.reset) return 'Reset the stopwatch';
    if (u.bob === 'giant') return 'Giant pendulum · pull it out and let go';
    return 'Pendulum bob · pull it out to an angle and let go';
  }

  tap(o) {
    const u = o.userData;
    if (u.shorter) this.app.stepLength(-1);
    else if (u.longer) this.app.stepLength(1);
    else if (u.startStop) this.app.pressStartStop();
    else if (u.count) this.app.pressCount();
    else if (u.reset) this.app.pressReset();
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.tapOnly || !u.bob) return null;
    const p = u.bob === 'giant' ? this.giant : this.bench;
    const pivot = u.bob === 'giant' ? this.giantPivot() : PIVOT.clone();
    p.running = false;
    void world;
    return {
      move: (w) => {
        const l = this.group.worldToLocal(w.clone()).sub(pivot);
        const th = Math.max(-1.05, Math.min(1.05, Math.atan2(l.x, -l.y)));
        p.hold(th);
        this.deg = Math.round((Math.abs(th) * 180) / Math.PI);
      },
      release: () => {
        if (this.deg < 2) {
          p.stop();
          return;
        }
        this.target = u.bob === 'giant' ? 'giant' : 'bench';
        const sign = Math.sign(p.th) || 1;
        p.release(this.deg);
        p.th *= sign;
        this.app.onReleased(p);
      },
    };
  }

  giantPivot() {
    return new THREE.Vector3(GIANT_AT.x, this.floorY + GIANT_PIVOT_H, GIANT_AT.z);
  }

  // ───────────── every frame ─────────────

  update(dt, floorY) {
    this.floorY = floorY;
    this.bench.step(dt);
    if (this.giantGroup.visible) this.giant.step(dt);

    // bench pendulum
    const L = this.bench.L;
    const bp = PIVOT.clone().add(new THREE.Vector3(Math.sin(this.bench.th) * L, -Math.cos(this.bench.th) * L, 0));
    this.string.geometry.setFromPoints([PIVOT, bp]);
    this.bobMesh.position.copy(bp);
    this.bobMesh.rotation.z = this.bench.th;
    this.lenTag.position.set(PIVOT.x - 0.47, PIVOT.y - 0.11, PIVOT.z);
    if (this.lenTagL !== L) {
      this.lenTagL = L;
      this.benchGroup.remove(this.lenTag);
      this.lenTag = makeLabel(`${L.toFixed(2)} m`, { height: 0.016, size: 40 });
      this.lenTag.position.set(PIVOT.x - 0.47, PIVOT.y - 0.11, PIVOT.z);
      this.benchGroup.add(this.lenTag);
    }
    const gy = PIVOT.y - L;
    this.gate.position.set(PIVOT.x, gy, PIVOT.z);
    this.gatePost.scale.y = Math.max(0.01, gy - 0.03 - TOP);
    this.gatePost.position.set(PIVOT.x + 0.0, (gy - 0.03 + TOP) / 2, PIVOT.z - 0.05);

    // giant pendulum
    if (this.giantGroup.visible) {
      this.giantGroup.position.set(GIANT_AT.x, floorY, GIANT_AT.z);
      const G = this.giant;
      const piv = new THREE.Vector3(0, GIANT_PIVOT_H, 0);
      const gp = piv.clone().add(new THREE.Vector3(Math.sin(G.th) * G.L, -Math.cos(G.th) * G.L, 0));
      this.giantString.geometry.setFromPoints([piv, gp]);
      this.giantBob.position.copy(gp);
      this.giantGate.position.set(0, GIANT_PIVOT_H - G.L, 0);
      this.giantTag.position.set(0.5, GIANT_PIVOT_H - 0.25, 0);
    }

    this.gateFlash = Math.max(0, this.gateFlash - dt * 6);
    this.beam.material.opacity = 0.35 + 0.6 * (this.target === 'bench' ? this.gateFlash : 0);
    this.giantGate.material.opacity = 0.35 + 0.6 * (this.target === 'giant' ? this.gateFlash : 0);

    const w = this.watch;
    if (w.running) w.t = (performance.now() - w.t0) / 1000;
    this.redraw = (this.redraw ?? 0) + dt;
    if (this.redraw > 0.05) {
      this.redraw = 0;
      this.drawWatch();
    }
  }
}

export { PIVOT };
