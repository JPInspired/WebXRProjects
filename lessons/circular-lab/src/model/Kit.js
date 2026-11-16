import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { G, BALLS, idealRps } from '../data/circular.js';
import { fx } from './sounds.js';

// The bench: the school circular-motion kit in a tall clamp stand, so the ball goes round above your head.
//
//  - A string runs through a smooth upright tube. The ball is tied to the top end; a hanger of slotted masses
//    hangs from the bottom end, pulling the string down with a fixed force F = Mg.
//  - A red clip on the string, just below the tube, marks the radius chosen: spin too fast and the clip is
//    pulled up against the tube; too slow and the weight drags the string back in, so the clip drops away. A
//    light on the tube shows which (amber / green / blue).
//  - Spin it: pick up the tube and swirl your hand (in a headset), or drag the ball or tube round in circles (on
//    a screen). Or use the buttons: faster, slower, "hold steady" (keeps the clip in place for you) and stop.
//  - Measure: a stopwatch with start/stop, reset and a "count a turn" button, and a light gate whose vertical
//    beam the ball crosses once a turn (it reads the turns per second exactly, while the kit is in its stand).
//  - The ball rack holds the original lesson's five balls, 50 g to 250 g: tap one to tie it on.
//  - Cut the string (plenary): the ball flies off along the tangent and falls, leaving a trail.
//
// Physics (in the plane of the circle, string length r out of the top of the tube, angle θ, ball mass m,
// hanging mass M; the tube can move, with acceleration a_T):
//   (m + M) r̈ = m r ω² − M g − m a_T·r̂ − tube friction
//   ω̇ = (a_drive − 2 ṙ ω − a_T·θ̂) / r           (a_drive: your hand or the motor buttons, minus air drag)
// so it settles where M g = m ω² r. The ball's droop below the tube (a conical pendulum) is drawn but not
// fed back into the radius.

export const TOP = -0.3;
const AXIS = new THREE.Vector3(0, 0, -0.1); // the tube's axis when it is in the stand (x, z)
const TUBE_TOP_Y = 0.62; // above head height
const TUBE_LEN = 0.12;
const RMIN = 0.03;
const STOP = 0.6; // a knot below the clip stops the string being pulled in further than 60% of the length
const SLACK = 0.15; // string below the tube when the clip is in place
const GATE_ANGLE = Math.PI / 6; // where round the circle the light gate stands (back right)
const RACK = new THREE.Vector3(-0.34, TOP, 0.17);
const WATCH = new THREE.Vector3(0.24, TOP, 0.14);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const metal = mat(0xb8bec8, { metalness: 0.75, roughness: 0.3 });
const ballRadius = (g) => 0.017 * Math.cbrt(g / 50);

function canvasTex(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t, x: c.getContext('2d') };
}

function makeBall(g) {
  const grp = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(ballRadius(g), 24, 16), mat(0x34373f, { roughness: 0.35, metalness: 0.3 }));
  grp.add(s);
  const tag = makeLabel(`${g} g`, { height: 0.014, size: 40, color: '#ff9a3c', bg: 'rgba(20,20,26,0.82)' });
  tag.position.y = ballRadius(g) + 0.016;
  grp.add(tag);
  grp.userData.sphere = s;
  grp.userData.tag = tag;
  return grp;
}

function arrow(color) {
  const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.1, color, 0.03, 0.018);
  a.line.material.depthTest = false;
  a.cone.material.depthTest = false;
  a.renderOrder = 5;
  a.visible = false;
  return a;
}

export class Kit {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.m = 100;
    this.L = 0.3;
    this.M = 200;
    this.theta = 0;
    this.clock = 0; // simulation time (s)
    this.omega = 0;
    this.r = 0.18;
    this.rdot = 0;
    this.motor = 'off'; // 'off' | 'target' | 'steady'
    this.target = 0;
    this.swirl = 0; // your hand's swirl rate (rad/s)
    this.swirlAt = 0;
    this.held = false;
    this.cut = null;
    this.arrows = false;
    this.T = new THREE.Vector3(AXIS.x, TUBE_TOP_Y, AXIS.z);
    this.Tvel = new THREE.Vector3();
    this.Tacc = new THREE.Vector3();
    this.inZone = 0;
    this.watch = { running: false, t: 0, n: 0, gateSum: 0, gateN: 0, zone: 0, total: 0 };
    this.gate = { on: true, last: null, rps: null, flash: 0 };

    // ── bench and stand ──
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.012, 0.6), mat(0xe9ecf2, { roughness: 0.4 }));
    top.position.set(0, TOP - 0.006, -0.06);
    this.group.add(top);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.11), mat(0x2b3040));
    base.position.set(AXIS.x - 0.1, TOP + 0.006, AXIS.z - 0.02);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, TUBE_TOP_Y - TOP - 0.04, 12), metal);
    rod.position.set(AXIS.x - 0.1, (TUBE_TOP_Y + TOP - 0.04) / 2, AXIS.z - 0.02);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), metal);
    arm.position.set(AXIS.x - 0.05, TUBE_TOP_Y - TUBE_LEN * 0.6, AXIS.z - 0.01);
    this.group.add(base, rod, arm);

    // ── the tube (held or in the stand), with its status light ──
    this.tube = new THREE.Group();
    const tubeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, TUBE_LEN, 16, 1, true), mat(0xdfe6f0, { roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide }));
    tubeMesh.position.y = -TUBE_LEN / 2;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 16), mat(0x3a64c8));
    grip.position.y = -TUBE_LEN * 0.55;
    this.light = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 8, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b9bff }));
    this.light.position.y = -0.008;
    this.tube.add(tubeMesh, grip, this.light);
    for (const m of [tubeMesh, grip]) m.userData = { handler: this, tube: true };
    this.tubePicks = [tubeMesh, grip];
    this.group.add(this.tube);

    // ── ball, strings, clip, hanger ──
    this.ball = makeBall(this.m);
    this.ball.userData.sphere.userData = { handler: this, ball: true };
    this.group.add(this.ball);
    const strMat = new THREE.LineBasicMaterial({ color: 0xf2efe6 });
    this.upper = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), strMat);
    this.lower = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), strMat);
    this.group.add(this.upper, this.lower);
    this.clip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.012), mat(0xe03030));
    this.group.add(this.clip);
    this.hanger = new THREE.Group();
    this.group.add(this.hanger);
    this.buildHanger();

    // ── light gate: a vertical beam the ball crosses once a turn ──
    this.gateGroup = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, TUBE_TOP_Y + 0.1 - TOP, 10), mat(0x30343e));
    post.position.set(0.025, (TUBE_TOP_Y + 0.1 + TOP) / 2, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.05), mat(0x30343e));
    foot.position.set(0.012, TOP + 0.01, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.025), mat(0x30343e));
    head.position.set(0.012, TUBE_TOP_Y + 0.1, 0);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, TUBE_TOP_Y + 0.1 - TOP - 0.02, 6), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.55 }));
    this.beam.position.set(0, (TUBE_TOP_Y + 0.1 + TOP) / 2, 0);
    this.gateGroup.add(post, foot, head, this.beam);
    this.gateScreen = canvasTex(256, 96);
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.0375), new THREE.MeshBasicMaterial({ map: this.gateScreen.t, toneMapped: false }));
    gs.position.set(0.012, TOP + 0.05, 0.028);
    this.gateGroup.add(gs);
    this.group.add(this.gateGroup);

    // ── ball rack ──
    this.rack = BALLS.map((g, i) => {
      const b = makeBall(g);
      b.position.set(RACK.x + i * 0.065, TOP + ballRadius(g) + 0.008, RACK.z);
      b.userData.sphere.userData = { handler: this, rack: g, tapOnly: true };
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.008, 16), mat(0x5a6070));
      cup.position.set(RACK.x + i * 0.065, TOP + 0.004, RACK.z);
      this.group.add(b, cup);
      b.userData.cup = cup;
      return b;
    });

    // ── stopwatch: display, start/stop, reset, count ──
    this.watchGroup = new THREE.Group();
    this.watchGroup.position.copy(WATCH);
    this.group.add(this.watchGroup);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.11), mat(0x23293d));
    body.position.y = 0.006;
    this.watchScreen = canvasTex(384, 128);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.0467), new THREE.MeshBasicMaterial({ map: this.watchScreen.t, toneMapped: false }));
    face.rotation.x = -Math.PI / 2 + 0.5;
    face.position.set(0, 0.03, -0.025);
    this.watchGroup.add(body, face);
    const btn = (label, x, color, key) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 20), mat(color));
      b.position.set(x, 0.016, 0.03);
      b.userData = { handler: this, [key]: true, tapOnly: true };
      const t = makeLabel(label, { height: 0.009, size: 32 });
      t.position.set(x, 0.035, 0.03);
      this.watchGroup.add(b, t);
      return b;
    };
    this.btnStart = btn('Start / stop', -0.05, 0x2f9b5c, 'startStop');
    this.btnCount = btn('Count a turn', 0.005, 0xe08a2a, 'count');
    this.btnReset = btn('Reset', 0.055, 0x6a7186, 'reset');
    this.buttons = [this.btnStart, this.btnCount, this.btnReset];

    // ── arrows, cut trail, tangent line ──
    this.vArrow = arrow(0x46d17a);
    this.fArrow = arrow(0xff4d4d);
    this.group.add(this.vArrow, this.fArrow);
    this.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd166 }));
    this.tangent = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.03, gapSize: 0.02 }));
    this.trail.visible = false;
    this.tangent.visible = false;
    this.group.add(this.trail, this.tangent);

    this.setBall(this.m);
    this.drawWatch();
    this.drawGate();
  }

  // ───────────── settings ─────────────

  get F() {
    return (this.M / 1000) * G;
  }

  /** The speed (rad/s) at which the clip stays in place. */
  get idealOmega() {
    return 2 * Math.PI * idealRps(this.m, this.L, this.M);
  }

  setBall(g) {
    this.m = g;
    this.ball.remove(this.ball.userData.sphere, this.ball.userData.tag);
    const fresh = makeBall(g);
    this.ball.userData.sphere = fresh.userData.sphere;
    this.ball.userData.tag = fresh.userData.tag;
    this.ball.add(fresh.userData.sphere, fresh.userData.tag);
    this.ball.userData.sphere.userData = { handler: this, ball: true };
    this.rack.forEach((b) => { b.visible = b.userData.sphere.userData.rack !== g; });
    this.stop(true);
  }

  setLength(L) {
    this.L = L;
    this.stop(true);
  }

  setHanging(M) {
    this.M = M;
    this.buildHanger();
  }

  buildHanger() {
    while (this.hanger.children.length) this.hanger.remove(this.hanger.children[0]);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.03, 8), metal);
    hook.position.y = -0.015;
    this.hanger.add(hook);
    const n = Math.round(this.M / 50);
    for (let i = 0; i < n; i++) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.0065, 20), mat(0x9a7b3c, { metalness: 0.6, roughness: 0.35 }));
      disc.position.y = -0.033 - i * 0.0072;
      this.hanger.add(disc);
    }
  }

  // ───────────── spinning ─────────────

  faster() {
    this.motor = 'target';
    this.target = Math.max(this.omega, 0) + 2 * Math.PI * 0.15;
  }

  slower() {
    this.motor = 'target';
    this.target = Math.max(0, this.omega - 2 * Math.PI * 0.15);
  }

  holdSteady() {
    this.motor = this.motor === 'steady' ? 'off' : 'steady';
  }

  stop(now = false) {
    this.motor = 'off';
    this.target = 0;
    if (now) {
      this.omega = 0;
      this.r = this.rMin;
      this.rdot = 0;
    } else {
      this.motor = 'target';
      this.target = 0;
    }
  }

  /** 'fast' (clip against the tube), 'steady' or 'slow' */
  get zone() {
    const gap = this.L + 0.02 - this.r;
    if (gap < 0.005) return 'fast';
    if (gap <= 0.035) return 'steady';
    return 'slow';
  }

  get rMin() {
    return Math.max(RMIN, this.L * STOP);
  }

  get rps() {
    return Math.abs(this.omega) / (2 * Math.PI);
  }

  get inStand() {
    return !this.held && this.T.distanceTo(new THREE.Vector3(AXIS.x, TUBE_TOP_Y, AXIS.z)) < 0.01;
  }

  step(dt) {
    const m = this.m / 1000;
    const M = this.M / 1000;
    const n = Math.max(1, Math.ceil(dt / 0.002));
    const h = dt / n;
    const swirlOn = performance.now() - this.swirlAt < 400 && Math.abs(this.swirl) > 0.5;
    for (let i = 0; i < n; i++) {
      const w = this.omega;
      const r = this.r;
      let wt = null;
      let k = 0;
      if (swirlOn) {
        wt = this.swirl;
        k = 2.2;
      } else if (this.motor === 'steady') {
        // like a careful student: speed up when the clip drops away, ease off as it rises (and as it moves)
        wt = this.idealOmega * (1 + (2 * (this.L - r) - 0.6 * this.rdot) / this.L) * Math.sign(w || 1);
        k = 6.0;
      } else if (this.motor === 'target') {
        wt = this.target * Math.sign(w || 1);
        k = 1.8;
      }
      // the tube's own acceleration (when you hold it), in the ball's radial and tangential directions
      const c = Math.cos(this.theta);
      const s = Math.sin(this.theta);
      const aR = this.Tacc.x * c - this.Tacc.z * s;
      const aTan = -this.Tacc.x * s - this.Tacc.z * c;
      let aDrive = wt == null ? 0 : k * (wt - w) * Math.max(r, 0.08);
      aDrive -= 0.04 * w * r + 0.012 * Math.sign(w) * (Math.abs(w) > 0.05 ? 1 : 0); // air drag
      const wdot = (aDrive - 2 * this.rdot * w - aTan) / Math.max(r, RMIN);
      const rdd = (m * r * w * w - M * G - m * aR - 1.2 * (m + M) * this.rdot) / (m + M);
      this.omega += wdot * h;
      if (wt == null && Math.abs(this.omega) < 0.05) this.omega = 0;
      this.rdot += rdd * h;
      this.r += this.rdot * h;
      if (this.r > this.L + 0.02) {
        this.r = this.L + 0.02;
        this.rdot = Math.min(0, this.rdot);
      }
      if (this.r < this.rMin) {
        this.r = this.rMin;
        this.rdot = Math.max(0, this.rdot);
      }
      this.clock += h;
      const before = this.theta;
      this.theta += this.omega * h;
      this.checkCrossings(before, this.theta);
    }
    if (this.motor === 'target' && this.target === 0 && Math.abs(this.omega) < 0.3) this.motor = 'off';
  }

  /** Light gate and the whoosh as you are passed. */
  checkCrossings(a, b) {
    const crossed = (ang) => {
      const k = Math.floor((a - ang) / (2 * Math.PI));
      const k2 = Math.floor((b - ang) / (2 * Math.PI));
      return k !== k2;
    };
    if (crossed(-Math.PI / 2) && Math.abs(this.omega) > 2.5) fx.whoosh(Math.abs(this.omega) * this.r);
    if (this.gate.on && this.inStand && crossed(GATE_ANGLE) && Math.abs(this.r - this.L) < 0.1) {
      const now = this.clock;
      if (this.gate.last != null) {
        const period = now - this.gate.last;
        // (a pass the beam missed would look like a period twice as long: ignore it)
        if (period > 0.1 && period < 1.5 * ((2 * Math.PI) / Math.max(0.3, Math.abs(this.omega)))) {
          this.gate.rps = 1 / period;
          if (this.watch.running) {
            this.watch.gateSum += this.gate.rps;
            this.watch.gateN++;
          }
        }
      }
      this.gate.last = now;
      this.gate.flash = 1;
      fx.gate();
    }
  }

  // ───────────── measuring ─────────────

  startStop() {
    const w = this.watch;
    if (!w.running) {
      if (w.t > 0) this.resetWatch();
      this.watch.running = true;
      this.watch.t0 = performance.now();
      return 'start';
    }
    w.t = (performance.now() - w.t0) / 1000;
    w.running = false;
    return 'stop';
  }

  countTurn() {
    if (!this.watch.running) return false;
    this.watch.n++;
    return true;
  }

  resetWatch() {
    this.watch = { running: false, t: 0, n: 0, gateSum: 0, gateN: 0, zone: 0, total: 0 };
  }

  /** The result of the last timing, or null. */
  result() {
    const w = this.watch;
    if (w.running || w.n < 1 || w.t <= 0) return null;
    return {
      m: this.m,
      L: this.L,
      M: this.M,
      n: w.n,
      t: w.t,
      f: w.n / w.t,
      gate: w.gateN ? w.gateSum / w.gateN : null,
      steady: w.total ? w.zone / w.total : 0,
    };
  }

  drawWatch() {
    const { x, c, t } = this.watchScreen;
    const w = this.watch;
    x.fillStyle = '#0e1a14';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = w.running ? '#7dffb0' : '#c8f5d8';
    x.font = '700 64px ui-monospace, monospace';
    x.textBaseline = 'middle';
    const secs = w.t;
    const mm = Math.floor(secs / 60);
    x.fillText(`${String(mm).padStart(2, '0')}:${(secs % 60).toFixed(2).padStart(5, '0')}`, 18, 50);
    x.font = '600 32px system-ui, sans-serif';
    x.fillStyle = '#ffd166';
    x.fillText(`Turns: ${w.n}`, 20, 104);
    t.needsUpdate = true;
  }

  drawGate() {
    const { x, c, t } = this.gateScreen;
    x.fillStyle = '#151a26';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#ff8080';
    x.font = '600 22px system-ui, sans-serif';
    x.textBaseline = 'middle';
    x.fillText('LIGHT GATE', 12, 22);
    x.fillStyle = '#ffffff';
    x.font = '700 34px system-ui, sans-serif';
    const on = this.gate.on && this.inStand;
    x.fillText(!this.gate.on ? 'off' : !on ? 'kit not in stand' : this.gate.rps ? `${this.gate.rps.toFixed(2)} turns/s` : '— turns/s', 12, 66);
    t.needsUpdate = true;
  }

  // ───────────── cutting the string ─────────────

  cutString() {
    if (this.cut || Math.abs(this.omega) < 1) return false;
    const p = this.ballPos();
    const tan = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta)).multiplyScalar(this.omega * this.r);
    const v = tan.add(this.Tvel);
    this.cut = { p: p.clone(), v, path: [p.clone()], t: 0, start: p.clone(), dir: v.clone().setY(0).normalize() };
    this.tangent.geometry.dispose();
    this.tangent.geometry = new THREE.BufferGeometry().setFromPoints([p.clone().addScaledVector(this.cut.dir, -0.25), p.clone().addScaledVector(this.cut.dir, 2)]);
    this.tangent.computeLineDistances();
    this.tangent.visible = true;
    this.trail.visible = true;
    this.omega = 0;
    this.motor = 'off';
    fx.snip();
    return true;
  }

  retie() {
    this.cut = null;
    this.trail.visible = false;
    this.tangent.visible = false;
    this.stop(true);
  }

  // ───────────── grabbing ─────────────

  get targets() {
    const t = [...this.tubePicks, ...this.buttons];
    if (!this.cut) t.push(this.ball.userData.sphere);
    for (const b of this.rack) if (b.visible) t.push(b.userData.sphere);
    return t;
  }

  describe(o) {
    const u = o.userData;
    if (u.rack) return `${u.rack} g ball · tap to tie it on`;
    if (u.startStop) return 'Stopwatch: start / stop';
    if (u.count) return 'Count a turn (each time the ball passes you)';
    if (u.reset) return 'Reset the stopwatch';
    if (u.ball) return this.app.presenting ? 'The ball · pick up the tube and swirl it' : 'The ball · drag it round in circles to spin it';
    return this.app.presenting ? 'The tube · pick it up and swirl it above your head' : 'The tube · drag round in circles to spin the ball';
  }

  tap(o) {
    const u = o.userData;
    if (u.rack) this.app.chooseBall(u.rack);
    else if (u.startStop) this.app.pressStartStop();
    else if (u.count) this.app.pressCount();
    else if (u.reset) this.app.pressReset();
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.tapOnly) return null;
    if (this.cut) return null;
    this.motor = 'off';
    if (this.app.presenting && u.tube) {
      // in a headset: the tube follows your hand
      this.held = true;
      const off = this.T.clone().sub(this.group.worldToLocal(world.clone()));
      const centre = this.T.clone();
      let lastA = null;
      let lastT = performance.now();
      return {
        move: (w) => {
          this.T.copy(this.group.worldToLocal(w.clone())).add(off);
          const now = performance.now();
          const dtm = Math.max(0.001, (now - lastT) / 1000);
          lastT = now;
          centre.lerp(this.T, Math.min(1, dtm / 0.45));
          const dx = this.T.x - centre.x;
          const dz = this.T.z - centre.z;
          if (Math.hypot(dx, dz) > 0.006) {
            const a = Math.atan2(-dz, dx);
            if (lastA != null) {
              let d = a - lastA;
              while (d > Math.PI) d -= 2 * Math.PI;
              while (d < -Math.PI) d += 2 * Math.PI;
              this.swirl += (d / dtm - this.swirl) * Math.min(1, dtm / 0.25);
              this.swirlAt = now;
            }
            lastA = a;
          }
        },
        release: () => {
          this.held = false;
          this.swirl = 0;
        },
      };
    }
    // on a screen: drag in circles round the tube (as seen on the screen)
    const cam = this.app.camera;
    let lastA = null;
    let lastT = performance.now();
    return {
      move: (w) => {
        const p = w.clone().project(cam);
        const c = this.group.localToWorld(this.T.clone()).project(cam);
        const now = performance.now();
        const dtm = Math.max(0.001, (now - lastT) / 1000);
        lastT = now;
        // seen from the front and a little below, anticlockwise on screen is anticlockwise from above
        const a = Math.atan2(p.y - c.y, (p.x - c.x) * cam.aspect);
        if (Math.hypot((p.x - c.x) * cam.aspect, p.y - c.y) > 0.02 && lastA != null) {
          let d = a - lastA;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          this.swirl += (d / dtm - this.swirl) * Math.min(1, dtm / 0.3);
          this.swirlAt = now;
        }
        lastA = a;
      },
      release: () => { this.swirl = 0; },
    };
  }

  // ───────────── every frame ─────────────

  ballPos() {
    // conical pendulum: the string tilts down by α, tan α = g / (ω² r)
    const w2 = this.omega * this.omega;
    const alpha = Math.min(1.25, Math.atan2(G, Math.max(1e-6, w2 * this.r))); // at rest it hangs a little out to the side
    const horiz = this.r * Math.cos(alpha);
    return new THREE.Vector3(this.T.x + horiz * Math.cos(this.theta), this.T.y - this.r * Math.sin(alpha) - ballRadius(this.m) * 0.3, this.T.z - horiz * Math.sin(this.theta));
  }

  update(dt, floorY) {
    // the tube: back to the stand when you let go
    const prevVel = this.Tvel.clone();
    const prev = this.T.clone();
    if (!this.held) this.T.lerp(new THREE.Vector3(AXIS.x, TUBE_TOP_Y, AXIS.z), Math.min(1, dt * 6));
    if (dt > 0) {
      this.Tvel.copy(this.T).sub(prev).divideScalar(dt);
      const acc = this.Tvel.clone().sub(prevVel).divideScalar(dt);
      this.Tacc.lerp(acc.clampLength(0, 40), Math.min(1, dt * 20));
    }
    if (!this.held) this.Tacc.multiplyScalar(0.8);
    this.tube.position.copy(this.T);
    this.gateGroup.position.set(AXIS.x + this.L * Math.cos(GATE_ANGLE), 0, AXIS.z - this.L * Math.sin(GATE_ANGLE));

    if (!this.cut) this.step(dt);

    // stopwatch
    const w = this.watch;
    if (w.running) {
      w.t = (performance.now() - w.t0) / 1000; // the real clock, however slowly the frames come
      w.total += dt;
      if (this.zone === 'steady') w.zone += dt;
    }

    // status light
    const z = this.zone;
    this.light.material.color.setHex(Math.abs(this.omega) < 1 ? 0x404858 : z === 'fast' ? 0xffb020 : z === 'steady' ? 0x3ddc84 : 0x5b9bff);

    // ball and strings
    const tubeBottom = this.T.clone().add(new THREE.Vector3(0, -TUBE_LEN, 0));
    if (this.cut) {
      const c = this.cut;
      c.t += dt;
      const floor = floorY + ballRadius(this.m);
      for (let i = 0; i < 4; i++) {
        const h = dt / 4;
        c.v.y -= G * h;
        c.p.addScaledVector(c.v, h);
        if (c.p.y < floor) {
          c.p.y = floor;
          c.v.y = -c.v.y * 0.45;
          c.v.x *= 0.8;
          c.v.z *= 0.8;
        }
      }
      if (c.path.length < 400 && c.path.at(-1).distanceTo(c.p) > 0.01) c.path.push(c.p.clone());
      this.trail.geometry.dispose();
      this.trail.geometry = new THREE.BufferGeometry().setFromPoints(c.path);
      this.ball.position.copy(c.p);
      // the cut ends dangle: the weight drops to its stop
      this.r = Math.max(this.rMin, this.r - dt * 1.5);
      this.upper.geometry.setFromPoints([this.T, this.T.clone().add(new THREE.Vector3(0, -0.01, 0))]);
    } else {
      this.ball.position.copy(this.ballPos());
      this.upper.geometry.setFromPoints([this.T, this.ball.position]);
    }
    const clipY = tubeBottom.y - (this.L + 0.02 - this.r) - 0.004;
    const hangY = tubeBottom.y - (this.L + SLACK - this.r);
    this.lower.geometry.setFromPoints([tubeBottom, new THREE.Vector3(this.T.x, hangY, this.T.z)]);
    this.clip.position.set(this.T.x, clipY, this.T.z);
    this.hanger.position.set(this.T.x, hangY, this.T.z);
    this.ball.userData.tag.visible = Math.abs(this.omega) < 2;

    // arrows: velocity (green, along the tangent) and the force (red, towards the centre)
    const show = this.arrows && !this.cut && Math.abs(this.omega) > 1;
    this.vArrow.visible = show;
    this.fArrow.visible = show;
    if (show) {
      const p = this.ball.position;
      const tan = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta)).multiplyScalar(Math.sign(this.omega));
      const v = Math.abs(this.omega) * this.r;
      this.vArrow.position.copy(p);
      this.vArrow.setDirection(tan);
      this.vArrow.setLength(Math.min(0.35, 0.05 + v * 0.07), 0.03, 0.018);
      const toC = this.T.clone().sub(p).setY(0).normalize();
      this.fArrow.position.copy(p);
      this.fArrow.setDirection(toC);
      this.fArrow.setLength(Math.min(0.3, 0.05 + this.F * 0.06), 0.03, 0.018);
    }

    // light gate
    this.gate.flash = Math.max(0, this.gate.flash - dt * 6);
    this.beam.visible = this.gate.on;
    this.beam.material.opacity = 0.35 + 0.6 * this.gate.flash;
    if (!this.inStand || Math.abs(this.omega) < 0.5) this.gate.rps = null;
    this.redrawClock = (this.redrawClock ?? 0) + dt;
    if (this.redrawClock > 0.05) {
      this.redrawClock = 0;
      this.drawWatch();
      this.drawGate();
    }
  }
}
