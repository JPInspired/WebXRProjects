import * as THREE from 'three';
import { Puffs } from './Puffs.js';
import { HYPO } from './layout.js';

// Fires burning in the ruins (flames that flicker, smoke that rises and drifts), and the mushroom cloud seen from
// the hills. Both are made of puffs (see Puffs.js), so they cost one or two draw calls each.

const SMOKE_PER_FIRE = 9;

export class Fires {
  constructor(scene) {
    this.smoke = new Puffs(60 * SMOKE_PER_FIRE);
    this.flames = new Puffs(60 * 3, { additive: true });
    scene.add(this.smoke.mesh, this.flames.mesh);
    this.spots = [];
    this.parts = [];
    this.t = 0;
    this.level = 0; // 0..1: how strongly they burn (the blast lights them gradually)
  }

  /** Where the fires are: [{ x, z, size }]. */
  setSpots(spots) {
    this.spots = spots.slice(0, 60);
    this.parts = [];
    for (const s of this.spots) {
      for (let k = 0; k < SMOKE_PER_FIRE; k++) this.parts.push({ s, age: Math.random() * 14, life: 11 + Math.random() * 6, dx: (Math.random() - 0.5) * 2, dz: (Math.random() - 0.5) * 2, turn: Math.random() * 6 });
    }
  }

  update(dt, fog) {
    this.t += dt;
    const sm = this.smoke, fl = this.flames;
    sm.clear();
    fl.clear();
    if (this.level > 0.01) {
      const wind = new THREE.Vector2(0.9, 0.4);
      for (const p of this.parts) {
        p.age += dt;
        if (p.age > p.life) p.age = 0;
        const k = p.age / p.life;
        const rise = 4 + p.s.size * 3;
        const x = p.s.x + p.dx + wind.x * p.age * 1.6;
        const z = p.s.z + p.dz + wind.y * p.age * 1.6;
        const y = 1 + p.age * rise;
        const size = (2 + p.s.size * 3) * (0.6 + k * 2.4);
        const g = 0.12 + k * 0.18;
        sm.add(x, y, z, size, [g, g * 0.92, g * 0.85], (1 - k) * 0.5 * this.level * Math.min(1, p.age * 2), p.turn + p.age * 0.2);
      }
      for (const s of this.spots) {
        for (let k = 0; k < 3; k++) {
          const f = 0.75 + 0.25 * Math.sin(this.t * (9 + k * 3) + s.x);
          const h = (0.6 + k * 0.5) * s.size;
          fl.add(s.x + (k - 1) * 0.5 * s.size, h, s.z + Math.sin(k + s.z) * 0.4, s.size * (1.8 - k * 0.3) * f * this.level, [1.0, 0.45 + k * 0.12, 0.12], 0.55 * this.level, k);
        }
      }
    }
    sm.commit();
    fl.commit();
    if (fog) {
      sm.fog(fog.color, fog.density);
      fl.fog(fog.color, fog.density * 0.5);
    }
  }

  set visible(v) {
    this.smoke.mesh.visible = this.flames.mesh.visible = v;
  }
}

/**
 * The mushroom cloud over the hypocentre, at an age in seconds (it rises and spreads quickly, then slowly): a
 * rolling cap, the stem beneath it and the dust skirt at its foot. Seen from kilometres away.
 */
export class MushroomCloud {
  constructor(scene) {
    this.puffs = new Puffs(260, { fog: false });
    this.glow = new Puffs(40, { additive: true, fog: false });
    scene.add(this.puffs.mesh, this.glow.mesh);
    const r = mulberry(17);
    this.cap = Array.from({ length: 120 }, () => ({ th: r() * Math.PI * 2, ph: r() * Math.PI * 2, rr: Math.sqrt(r()), s: 0.6 + r() * 0.45, top: r() < 0.28 }));
    this.stem = Array.from({ length: 70 }, () => ({ h: r(), th: r() * Math.PI * 2, rr: r(), s: 0.8 + r() * 0.6 }));
    this.skirt = Array.from({ length: 40 }, () => ({ th: r() * Math.PI * 2, rr: 0.5 + r() * 0.6, s: 0.7 + r() * 0.6 }));
    // the fire under the cap: uneven tongues and pockets of glow, bunched in places and missing in others (not a
    // neat ring), each flickering at its own pace, some deep red, some orange, a few yellow-white where it is hottest
    this.flames = [];
    let th = r() * Math.PI * 2;
    while (this.flames.length < 36) {
      th += 0.05 + r() * r() * 0.9; // mostly close together, now and then a gap
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n && this.flames.length < 36; k++) {
        this.flames.push({ th: th + (r() - 0.5) * 0.25, rr: 0.18 + r() * 0.62, dy: (r() - 0.6) * 0.32, s: 0.25 + r() * r() * 0.75, heat: r(), f: 2 + r() * 5, ph: r() * 6, drift: (r() - 0.5) * 0.4 });
      }
    }
    this.visible = false;
  }

  set visible(v) {
    this.puffs.mesh.visible = this.glow.mesh.visible = v;
  }

  update(age) {
    // The classic mushroom: a slim column rising into a wide, rolling cap (a doughnut turning over on itself, a
    // dome on top), a ring of cloud round the stem, a dust skirt at its foot. Fire glows under the cap at first.
    const P = this.puffs, G = this.glow;
    P.clear();
    G.clear();
    const Hc = 1500 + 6200 * (1 - Math.exp(-age / 15)); // the cap's height (m)
    const Rc = 700 + 2300 * (1 - Math.exp(-age / 18)); // its radius
    const hot = Math.max(0, 1 - age / 40);
    const roll = age * 0.45;
    const x0 = HYPO.x, z0 = HYPO.z;
    const fire = (k, c) => [c[0] * (1 - k) + 1.0 * k, c[1] * (1 - k) + 0.5 * k, c[2] * (1 - k) + 0.2 * k];
    // the stem: slim, brown below, paler and wider where it feeds the cap
    for (const p of this.stem) {
      const y = p.h * (Hc - Rc * 0.2);
      const w = (180 + 260 * p.h ** 3 + 120 * (1 - p.h)) * (0.5 + 0.5 * Math.min(1, age / 8));
      const a = p.th + roll * 0.8;
      const c = 0.42 + 0.3 * p.h;
      P.add(x0 + Math.cos(a) * w * p.rr * 0.7, y, z0 + Math.sin(a) * w * p.rr * 0.7, w * 2.0 * p.s, fire(hot * 0.5 * p.h, [c * 1.05, c * 0.93, c * 0.8]), 0.5, a);
    }
    // the collar: a thin white ring of condensed cloud round the stem
    const yc = Hc * 0.72;
    for (let i = 0; i < 18; i++) {
      const t = (i / 18) * Math.PI * 2 + roll * 0.2;
      P.add(x0 + Math.cos(t) * Rc * (0.42 + 0.08 * Math.sin(t * 3)), yc + Rc * 0.06 * Math.cos(t * 5), z0 + Math.sin(t) * Rc * (0.42 + 0.08 * Math.sin(t * 3)), Rc * 0.7, [0.92, 0.92, 0.9], 0.14 * Math.min(1, age / 12), t);
    }
    // the dust skirt
    for (const p of this.skirt) {
      const rad = (400 + Rc * 1.1) * p.rr;
      P.add(x0 + Math.cos(p.th) * rad, 160 * p.s, z0 + Math.sin(p.th) * rad, 800 * p.s + age * 14, [0.45, 0.39, 0.32], 0.3, p.th);
    }
    // the cap: the rolling doughnut, then the dome over it
    for (const p of this.cap) {
      let x, y, z, light;
      if (p.top) {
        const r = Rc * 0.62 * p.rr;
        x = x0 + Math.cos(p.th) * r;
        z = z0 + Math.sin(p.th) * r;
        y = Hc + Rc * 0.45 + Rc * 0.18 * (1 - p.rr);
        light = 1.0;
      } else {
        const ph = p.ph + roll;
        const ring = Rc * 0.62 + Rc * 0.36 * Math.cos(ph);
        x = x0 + Math.cos(p.th) * ring;
        z = z0 + Math.sin(p.th) * ring;
        y = Hc + Rc * 0.36 * Math.sin(ph);
        light = 0.72 + 0.28 * Math.max(0, Math.sin(ph)); // sunlit on top, shadowed underneath
      }
      const under = Math.max(0, Math.min(1, (Hc - y) / (Rc * 0.36)));
      const c = fire(hot * (0.35 + 0.65 * under), [light, light * (0.96 - under * 0.08), light * (0.9 - under * 0.15)]);
      P.add(x, y, z, Rc * 0.75 * p.s, c, 0.5, p.th);
    }
    // the fire glowing in the underside of the cap while it is young: irregular, flickering, turning with the roll
    if (hot > 0) for (const f of this.flames) {
      const t = f.th + roll * (0.35 + f.drift);
      const flick = 0.6 + 0.4 * Math.sin(age * f.f + f.ph) * Math.sin(age * f.f * 0.37 + f.ph * 2);
      const rad = Rc * (f.rr + 0.06 * Math.sin(age * 0.7 + f.ph));
      const heat = Math.min(1, f.heat * (0.6 + 0.6 * hot));
      const col = heat > 0.92 ? [1, 0.74, 0.42] : heat > 0.45 ? [1, 0.45 + heat * 0.15, 0.12] : [0.85, 0.22 + heat * 0.3, 0.07];
      G.add(x0 + Math.cos(t) * rad, Hc - Rc * (0.12 - f.dy), z0 + Math.sin(t) * rad, Rc * f.s * (0.85 + 0.3 * flick), col, 0.42 * hot * flick, t * 3 + f.ph);
    }
    P.commit();
    G.commit();
    return { Hc, Rc };
  }
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
