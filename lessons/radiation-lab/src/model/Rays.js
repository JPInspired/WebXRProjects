import * as THREE from 'three';
import { TYPES, ABSORBERS } from '../data/radiation.js';
import { HOLDER, SLOT_X } from './Bench.js';
import { shapeRecipe } from '../../../../shared/net/LabMirror.js';

const ABS = Object.keys(ABSORBERS);

// "X-ray vision": the radiation drawn as streaks flying out of every source. Alpha (red) only gets a few
// centimetres and is stopped by any absorber; beta (blue) flies further and is stopped by aluminium or lead;
// gamma (yellow) goes a long way, and lead stops only some of it. Purely a picture: the counter's numbers
// come from Bench.rate(), not from these streaks.

const MAX = 600;
const LEN = { a: 0.006, b: 0.02, g: 0.05 };
const SPEED = { a: 0.06, b: 0.35, g: 0.9 };
const RANGE = { a: 0.045, b: 0.6, g: 1.4 };
const VISIBLE = { a: 0.5, b: 0.9, g: 2.2 }; // streaks per second for each count per second (gamma is detected less often)

export class Rays {
  constructor(app, bench) {
    this.app = app;
    this.bench = bench;
    this.parts = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 5;
    bench.group.add(this.lines);
    this.colors = Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, new THREE.Color(t.color)]));
    this.on = false;
    this.acc = {};
    this.recipe = null;
    // the class copy (shared/net/LabMirror.js): the same streaks, made by the copy from where the teacher's sources
    // are, how strong they are and which absorber is in the holder (not each streak)
    shapeRecipe(this.lines, () => this.recipe, (copy) => {
      const twin = Object.assign(Object.create(Rays.prototype), { parts: [], acc: {}, lines: copy, colors: this.colors });
      copy.geometry.setAttribute('color', copy.geometry.getAttribute('color').clone());
      let em = [];
      let ab = 'none';
      return {
        set: (a) => {
          ab = ABS[a[0]] ?? 'none';
          em = [];
          for (let i = 1; i + 6 < a.length; i += 7) em.push({ p: new THREE.Vector3(a[i], a[i + 1], a[i + 2]), a: a[i + 3], b: a[i + 4], g: a[i + 5], holder: a[i + 6] > 0.5 });
        },
        tick: (dt) => twin.step(dt, em, ab),
      };
    });
  }

  update(dt) {
    this.lines.visible = this.on;
    if (!this.on) {
      this.parts.length = 0;
      return;
    }
    const b = this.bench;
    const em = b.emitters();
    this.recipe = [Math.max(0, ABS.indexOf(b.absorber)), ...em.flatMap((e) => [...e.p.toArray(), e.a, e.b, e.g, e.holder ? 1 : 0])];
    this.step(dt, em, b.absorber);
  }

  /** New streaks from the emitters, moving, stopped by the absorber `ab`; drawn into this.lines. */
  step(dt, emitters, ab) {
    // new streaks
    emitters.forEach((e, i) => {
      for (const k of ['a', 'b', 'g']) {
        if (!e[k]) continue;
        const key = `${i}${k}`;
        this.acc[key] = (this.acc[key] ?? 0) + Math.min(40, e[k] * VISIBLE[k]) * dt;
        while (this.acc[key] >= 1 && this.parts.length < MAX) {
          this.acc[key] -= 1;
          const d = new THREE.Vector3().randomDirection();
          if (e.holder && Math.random() < 0.5) d.set(1, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6).normalize(); // more towards the probe, to see the absorber work
          this.parts.push({ k, p: e.p.clone(), d, s: 0, holder: e.holder, stopAt: Infinity });
        }
        this.acc[key] = Math.min(this.acc[key], 2);
      }
    });
    // move them; absorbers stop them
    for (const q of this.parts) {
      if (q.holder && ab !== 'none' && q.d.x > 0 && q.stopAt === Infinity) {
        const t = (SLOT_X - q.p.x) / q.d.x;
        const hit = q.p.clone().addScaledVector(q.d, t);
        const through = Math.random() < ABSORBERS[ab].t[q.k];
        if (t > 0 && Math.abs(hit.y - HOLDER.y) < 0.03 && Math.abs(hit.z - HOLDER.z) < 0.03 && !through) q.stopAt = t;
        else q.stopAt = -1;
      }
      q.s += SPEED[q.k] * dt;
    }
    this.parts = this.parts.filter((q) => q.s - LEN[q.k] < Math.min(RANGE[q.k], q.stopAt > 0 ? q.stopAt : Infinity));
    const pos = this.lines.geometry.attributes.position;
    const col = this.lines.geometry.attributes.color;
    let n = 0;
    for (const q of this.parts) {
      const end = Math.min(q.s, RANGE[q.k], q.stopAt > 0 ? q.stopAt : Infinity);
      const start = Math.max(0, q.s - LEN[q.k]);
      if (start >= end) continue;
      pos.setXYZ(n * 2, q.p.x + q.d.x * start, q.p.y + q.d.y * start, q.p.z + q.d.z * start);
      pos.setXYZ(n * 2 + 1, q.p.x + q.d.x * end, q.p.y + q.d.y * end, q.p.z + q.d.z * end);
      const c = this.colors[q.k];
      col.setXYZ(n * 2, c.r, c.g, c.b);
      col.setXYZ(n * 2 + 1, c.r, c.g, c.b);
      n++;
    }
    this.lines.geometry.setDrawRange(0, n * 2);
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}
