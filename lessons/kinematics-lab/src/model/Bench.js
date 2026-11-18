import * as THREE from 'three';
import { benchTop, steel, brass, standBase, bossHead, slottedMassGeometry } from '../../../../shared/lab/kit.js';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { G, DROP_OBJECTS, SPRINGS } from '../data/kinematics.js';

// The bench, with one station on it at a time (chosen on the panel):
//  - Drop tower: a 1:20 model of the original's measuring pole and glass balcony (5, 10 or 15 m). Press
//    "Drop" (or tap the object on the balcony) and it falls in real time, so a 15 m drop takes about 1.75 s.
//  - Pendulum: a bob on a string from a stand. Drag the bob out to an angle and let go (or use the buttons).
//  - Spring: a mass on a spring from a stand, with a ruler beside it to read the stretch. Pull the mass down
//    and let go (or use the buttons).
//  - Ramp: a plank at an angle; the ball rolls down it from the top.
// Every run records displacement, velocity and acceleration against time (for the chart), and its result
// (for the datasheet): the fall time, the time for 10 swings or bounces, the stretch, the roll time.

export const TOP = -0.3;
const SCALE = 1 / 20; // the drop tower model
const TOWER = new THREE.Vector3(-0.12, TOP, -0.06);
const STAND = new THREE.Vector3(-0.12, TOP, -0.08);
const PIVOT_Y = 0.42; // pendulum pivot and spring hook (lab y)
const SPRING_L0 = 0.12; // the spring's own length (m)
const RAMP_LEN = 0.7;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, envMapIntensity: 0.6, ...o });
const wood = mat(0xc89a66, { roughness: 0.75 });
const metal = steel();

function rulerTexture(lengthM, every, big, unit) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#d9b07c';
  x.fillRect(0, 0, 64, 1024);
  x.fillStyle = '#2a1e12';
  x.font = '700 18px system-ui, sans-serif';
  const n = Math.round(lengthM / every);
  for (let i = 0; i <= n; i++) {
    const y = 1024 - (i / n) * 1024;
    const major = i % big === 0;
    x.fillStyle = major ? '#c02020' : '#2a1e12';
    x.fillRect(0, y - 1, major ? 40 : 20, 2);
    if (major && i > 0) {
      x.fillStyle = '#2a1e12';
      x.fillText(`${Math.round(i * every * (unit === 'cm' ? 100 : 1))}${unit}`, 26, y + 18);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A helix (the spring) between y = 0 and y = -len, as a tube. */
function helix(len, color) {
  const pts = [];
  const turns = 14;
  for (let i = 0; i <= turns * 16; i++) {
    const t = i / (turns * 16);
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.012, -t * len, Math.sin(a) * 0.012));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, 0.0016, 6, false), mat(color, { metalness: 0.85, roughness: 0.25, envMapIntensity: 1 })); // coloured spring steel (the colour tells the springs apart)
}

export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.station = 'drop';
    this.s = {
      drop: { h: 10, obj: 'tennis', running: false, y: 10, v: 0, t: 0 },
      pendulum: { L: 0.4, m: 100, deg: 10, th: (10 * Math.PI) / 180, w: 0, running: false, t: 0, periods: 0, t10: null },
      spring: { id: 'medium', m: 100, x: 0, v: 0, pull: 0.04, running: false, t: 0, periods: 0, t10: null },
      ramp: { deg: 15, d: 0, v: 0, running: false, t: 0 },
    };
    this.trace = [];
    this.tmp = new THREE.Vector3();

    const top = benchTop(0.92, 0.5); // a dark lab bench (shared lab kit)
    top.position.set(0, TOP, 0.02);
    this.group.add(top);
    this.buildDrop();
    this.buildPendulum();
    this.buildSpring();
    this.buildRamp();
    this.setStation('drop');
  }

  // ───────────── building ─────────────

  buildDrop() {
    const g = new THREE.Group();
    this.dropGroup = g;
    const poleH = 16 * SCALE;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.1), mat(0x5a3418, { roughness: 0.85 }));
    base.position.set(TOWER.x, TOP + 0.01, TOWER.z);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.03, poleH, 0.006), new THREE.MeshStandardMaterial({ map: rulerTexture(16, 0.25, 4, 'm'), roughness: 0.7 }));
    pole.position.set(TOWER.x, TOP + 0.02 + poleH / 2, TOWER.z - 0.02);
    g.add(base, pole);
    // the glass balcony, at the chosen height
    this.balcony = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.004, 0.07), new THREE.MeshStandardMaterial({ color: 0x9fd0e0, transparent: true, opacity: 0.45, roughness: 0.1 }));
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.002), floor.material);
    rail.position.set(0, 0.015, -0.035);
    floor.position.x = 0.05;
    rail.position.x = 0.05;
    this.balcony.add(floor, rail);
    g.add(this.balcony);
    this.dropBall = new THREE.Mesh(new THREE.SphereGeometry(0.012, 20, 14), mat(0xd8f24a));
    this.dropBall.userData = { handler: this, drop: true, tapOnly: true };
    g.add(this.dropBall);
    this.dropTag = makeLabel('1 : 20 model', { height: 0.012, size: 34 });
    this.dropTag.position.set(TOWER.x + 0.12, TOP + 0.02, TOWER.z + 0.06);
    g.add(this.dropTag);
    this.group.add(g);
  }

  buildPendulum() {
    const g = new THREE.Group();
    this.pendGroup = g;
    const base = standBase(0.16, 0.1); // a cast-iron retort-stand base
    base.position.set(STAND.x - 0.12, TOP, STAND.z);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, PIVOT_Y - TOP + 0.02, 12), metal);
    rod.position.set(STAND.x - 0.16, (PIVOT_Y + TOP + 0.02) / 2, STAND.z);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.17, 12).rotateZ(Math.PI / 2), metal); // the clamp arm, held by a boss
    arm.position.set(STAND.x - 0.08, PIVOT_Y + 0.005, STAND.z);
    const boss = bossHead();
    boss.position.set(STAND.x - 0.16, PIVOT_Y + 0.005, STAND.z);
    g.add(boss);
    // protractor behind the pivot
    const prot = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.1, 48, 1, Math.PI * 1.17, Math.PI * 0.66), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    prot.position.set(STAND.x, PIVOT_Y, STAND.z - 0.012);
    g.add(base, rod, arm, prot);
    this.string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf2efe6 }));
    this.bob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 32, 20), brass()); // a brass pendulum bob
    this.bob.userData = { handler: this, bob: true };
    g.add(this.string, this.bob);
    this.group.add(g);
  }

  buildSpring() {
    const g = new THREE.Group();
    this.springGroup = g;
    const base = standBase(0.16, 0.1); // a cast-iron retort-stand base
    base.position.set(STAND.x - 0.12, TOP, STAND.z);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, PIVOT_Y - TOP + 0.02, 12), metal);
    rod.position.set(STAND.x - 0.16, (PIVOT_Y + TOP + 0.02) / 2, STAND.z);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.17, 12).rotateZ(Math.PI / 2), metal); // the clamp arm, held by a boss
    arm.position.set(STAND.x - 0.08, PIVOT_Y + 0.005, STAND.z);
    const boss = bossHead();
    boss.position.set(STAND.x - 0.16, PIVOT_Y + 0.005, STAND.z);
    g.add(boss);
    // the ruler (cm), zero at the bottom of the unstretched spring
    const rl = 0.6;
    const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.025, rl, 0.004), new THREE.MeshStandardMaterial({ map: rulerTexture(0.6, 0.01, 10, 'cm'), roughness: 0.7 }));
    ruler.rotation.z = Math.PI; // numbers increase downwards
    ruler.position.set(STAND.x + 0.045, PIVOT_Y - SPRING_L0 - rl / 2, STAND.z);
    this.springMesh = new THREE.Group();
    this.springMesh.position.set(STAND.x, PIVOT_Y, STAND.z);
    this.hanger = new THREE.Group();
    this.springMass = new THREE.Mesh(slottedMassGeometry(0.018, 0.03), brass());
    this.springMass.userData = { handler: this, mass: true };
    this.pointer = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.0015, 0.002), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    this.pointer.position.set(0.03, 0.015, 0);
    this.hanger.add(this.springMass, this.pointer);
    g.add(base, rod, arm, ruler, this.springMesh, this.hanger);
    this.group.add(g);
    this.springLen = -1;
  }

  buildRamp() {
    const g = new THREE.Group();
    this.rampGroup = g;
    this.plank = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(RAMP_LEN, 0.012, 0.06), wood);
    board.position.x = RAMP_LEN / 2;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(RAMP_LEN, 0.01, 0.004), wood);
    lip.position.set(RAMP_LEN / 2, 0.011, -0.028);
    const lip2 = lip.clone();
    lip2.position.z = 0.028;
    this.plank.add(board, lip, lip2);
    for (let i = 1; i < 7; i++) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.0125, 0.061), new THREE.MeshBasicMaterial({ color: 0x2a1e12 }));
      mark.position.x = RAMP_LEN - i * 0.1;
      this.plank.add(mark);
    }
    this.support = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.05), mat(0x5a3418));
    this.rampBall = new THREE.Mesh(new THREE.SphereGeometry(0.014, 20, 14), mat(0xff6b4a, { roughness: 0.35 }));
    this.rampBall.userData = { handler: this, rampBall: true, tapOnly: true };
    g.add(this.plank, this.support, this.rampBall);
    this.group.add(g);
  }

  // ───────────── settings ─────────────

  setStation(id) {
    this.station = id;
    this.dropGroup.visible = id === 'drop';
    this.pendGroup.visible = id === 'pendulum';
    this.springGroup.visible = id === 'spring';
    this.rampGroup.visible = id === 'ramp';
    this.stopAll();
    this.layout();
  }

  stopAll() {
    for (const st of Object.values(this.s)) st.running = false;
    this.resetStation();
  }

  /** Back to the start position for the current station. */
  resetStation() {
    const s = this.s[this.station];
    s.running = false;
    s.t = 0;
    if (this.station === 'drop') {
      s.y = s.h;
      s.v = 0;
    } else if (this.station === 'pendulum') {
      s.th = (s.deg * Math.PI) / 180;
      s.w = 0;
      s.periods = 0;
      s.t10 = null;
    } else if (this.station === 'spring') {
      s.x = s.pull;
      s.v = 0;
      s.periods = 0;
      s.t10 = null;
    } else {
      s.d = 0;
      s.v = 0;
    }
    this.trace = [];
    this.layout();
  }

  set(key, value) {
    const s = this.s[this.station];
    s[key] = value;
    this.resetStation();
  }

  // ───────────── running ─────────────

  start() {
    this.resetStation();
    const s = this.s[this.station];
    s.running = true;
    this.trace = [{ t: 0, ...this.sample() }];
    this.app.onStart(this.station);
  }

  /** Displacement (m), velocity (m/s) and acceleration (m/s²) for the chart. */
  sample() {
    const st = this.station;
    const s = this.s[st];
    if (st === 'drop') {
      const o = DROP_OBJECTS[s.obj];
      return { s: s.y, v: s.v, a: -G + (G * s.v * s.v) / (o.vt * o.vt) };
    }
    if (st === 'pendulum') {
      const L = s.L;
      return { s: L * Math.sin(s.th), v: L * s.w * Math.cos(s.th), a: -G * Math.sin(s.th) * Math.cos(s.th) };
    }
    if (st === 'spring') {
      const k = SPRINGS[s.id].k;
      return { s: -s.x, v: -s.v, a: (k / (s.m / 1000)) * s.x };
    }
    return { s: s.d, v: s.v, a: s.d < RAMP_LEN ? (5 / 7) * G * Math.sin((s.deg * Math.PI) / 180) : 0 };
  }

  update(dt) {
    const st = this.station;
    const s = this.s[st];
    if (s.running) {
      const n = Math.max(1, Math.ceil(dt / 0.002));
      const h = dt / n;
      for (let i = 0; i < n && s.running; i++) this.step(h);
      this.trace.push({ t: s.t, ...this.sample() });
      if (this.trace.length > 4000) this.trace.shift();
    }
    this.layout();
  }

  step(h) {
    const st = this.station;
    const s = this.s[st];
    s.t += h;
    if (st === 'drop') {
      const o = DROP_OBJECTS[s.obj];
      const a = -G + (G * s.v * s.v) / (o.vt * o.vt);
      s.v += a * h;
      s.y += s.v * h;
      if (s.y <= 0) {
        s.y = 0;
        s.running = false;
        this.app.onFinished('drop', { h: s.h, obj: s.obj, t: s.t, v: s.v });
      }
    } else if (st === 'pendulum') {
      const before = s.w;
      const acc = -(G / s.L) * Math.sin(s.th) - 0.012 * s.w;
      s.w += acc * h;
      s.th += s.w * h;
      // one period each time it turns back at the side it was released from
      if (before > 0 && s.w <= 0 && s.th > 0) {
        s.periods++;
        if (s.periods === 10) {
          s.t10 = s.t;
          this.app.onFinished('pendulum', { L: s.L, m: s.m, deg: s.deg, t10: s.t });
        }
      }
    } else if (st === 'spring') {
      const k = SPRINGS[s.id].k;
      const m = s.m / 1000;
      const before = s.v;
      const acc = -(k / m) * s.x - 0.05 * s.v;
      s.v += acc * h;
      s.x += s.v * h;
      if (before > 0 && s.v <= 0 && s.x > 0) {
        s.periods++;
        if (s.periods === 10) {
          s.t10 = s.t;
          this.app.onFinished('spring', { id: s.id, m: s.m, stretch: this.stretch(), t10: s.t });
        }
      }
    } else {
      const a = (5 / 7) * G * Math.sin((s.deg * Math.PI) / 180);
      s.v += a * h;
      s.d += s.v * h;
      if (s.d >= RAMP_LEN) {
        s.d = RAMP_LEN;
        s.running = false;
        this.app.onFinished('ramp', { deg: s.deg, d: RAMP_LEN, t: s.t });
      }
    }
  }

  /** The spring's stretch at rest, m (what the ruler reads with the mass hanging still). */
  stretch() {
    const s = this.s.spring;
    return ((s.m / 1000) * G) / SPRINGS[s.id].k;
  }

  // ───────────── drawing ─────────────

  layout() {
    const st = this.station;
    if (st === 'drop') {
      const s = this.s.drop;
      const o = DROP_OBJECTS[s.obj];
      this.balcony.position.set(TOWER.x + 0.02, TOP + 0.02 + s.h * SCALE - 0.004, TOWER.z);
      const r = Math.max(0.008, Math.min(0.016, o.r * 0.25));
      this.dropBall.scale.setScalar(r / 0.012);
      this.dropBall.material.color.setHex(o.color);
      this.dropBall.position.set(TOWER.x + 0.06, TOP + 0.02 + s.y * SCALE + r, TOWER.z);
    } else if (st === 'pendulum') {
      const s = this.s.pendulum;
      const pivot = new THREE.Vector3(STAND.x, PIVOT_Y, STAND.z);
      const bobR = 0.012 * Math.cbrt(s.m / 50) * 1.3;
      const p = pivot.clone().add(new THREE.Vector3(Math.sin(s.th) * s.L, -Math.cos(s.th) * s.L, 0));
      this.bob.position.copy(p);
      this.bob.scale.setScalar(bobR / 0.02);
      this.string.geometry.setFromPoints([pivot, p]);
    } else if (st === 'spring') {
      const s = this.s.spring;
      const len = SPRING_L0 + this.stretch() + s.x;
      if (this.springId !== s.id) {
        // one helix 1 m long, stretched to the length needed each frame
        this.springId = s.id;
        for (const c of [...this.springMesh.children]) {
          c.geometry.dispose();
          this.springMesh.remove(c);
        }
        this.springMesh.add(helix(1, SPRINGS[s.id].color));
      }
      this.springMesh.scale.y = len;
      const sc = Math.cbrt(s.m / 100);
      this.springMass.scale.set(sc, sc, sc);
      this.hanger.position.set(STAND.x, PIVOT_Y - len - 0.015 * sc, STAND.z);
      this.pointer.position.y = 0.015 * sc;
    } else {
      const s = this.s.ramp;
      const a = (s.deg * Math.PI) / 180;
      const foot = new THREE.Vector3(0.33, TOP + 0.006, -0.06);
      this.plank.position.copy(foot);
      this.plank.rotation.set(0, Math.PI, a); // rising to the left
      const topEnd = foot.clone().add(new THREE.Vector3(-Math.cos(a) * RAMP_LEN, Math.sin(a) * RAMP_LEN, 0));
      const hgt = topEnd.y - TOP;
      this.support.scale.y = Math.max(0.01, hgt);
      this.support.position.set(topEnd.x + 0.02, TOP + hgt / 2, -0.06);
      const along = RAMP_LEN - s.d;
      this.rampBall.position.copy(foot).add(new THREE.Vector3(-Math.cos(a) * along, Math.sin(a) * along, 0)).add(new THREE.Vector3(Math.sin(a), Math.cos(a), 0).multiplyScalar(0.02));
    }
  }

  // ───────────── grabbing ─────────────

  get targets() {
    const st = this.station;
    if (st === 'drop') return [this.dropBall];
    if (st === 'pendulum') return [this.bob];
    if (st === 'spring') return [this.springMass];
    return [this.rampBall];
  }

  describe(o) {
    const u = o.userData;
    if (u.drop) return 'Tap to drop it';
    if (u.rampBall) return 'Tap to let it roll';
    if (u.bob) return 'Pendulum bob · drag it out to an angle and let go';
    return 'Mass · pull it down and let go';
  }

  tap(o) {
    const u = o.userData;
    if (u.drop || u.rampBall) this.app.run();
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.tapOnly) return null;
    if (u.bob) {
      const s = this.s.pendulum;
      s.running = false;
      const pivot = new THREE.Vector3(STAND.x, PIVOT_Y, STAND.z);
      return {
        move: (w) => {
          const l = this.group.worldToLocal(w.clone()).sub(pivot);
          const th = Math.max(-1.2, Math.min(1.2, Math.atan2(l.x, -l.y)));
          s.th = th;
          s.w = 0;
          s.deg = Math.round((Math.abs(th) * 180) / Math.PI);
        },
        release: () => {
          if (s.deg < 2) {
            this.resetStation();
            return;
          }
          s.deg = Math.min(60, s.deg);
          const th = s.th;
          this.start();
          s.th = Math.sign(th) >= 0 ? (s.deg * Math.PI) / 180 : (s.deg * Math.PI) / 180;
        },
      };
    }
    if (u.mass) {
      const s = this.s.spring;
      s.running = false;
      const rest = PIVOT_Y - SPRING_L0 - this.stretch();
      return {
        move: (w) => {
          const l = this.group.worldToLocal(w.clone());
          s.x = Math.max(-0.03, Math.min(0.08, rest - l.y - 0.015));
          s.v = 0;
        },
        release: () => {
          s.pull = Math.max(0.005, Math.round(Math.abs(s.x) * 200) / 200);
          if (Math.abs(s.x) < 0.005) {
            this.resetStation();
            return;
          }
          this.start();
        },
      };
    }
    return null;
  }
}

export { RAMP_LEN, SPRING_L0 };
