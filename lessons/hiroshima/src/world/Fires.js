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
    this.puffs = new Puffs(240, { fog: false });
    this.glow = new Puffs(40, { additive: true, fog: false });
    scene.add(this.puffs.mesh, this.glow.mesh);
    const r = mulberry(17);
    this.cap = Array.from({ length: 120 }, () => ({ th: r() * Math.PI * 2, ph: r() * Math.PI * 2, rr: 0.35 + r() * 0.35, s: 0.6 + r() * 0.5, top: r() < 0.3 }));
    this.stem = Array.from({ length: 70 }, () => ({ h: r(), th: r() * Math.PI * 2, rr: r(), s: 0.8 + r() * 0.6 }));
    this.skirt = Array.from({ length: 40 }, () => ({ th: r() * Math.PI * 2, rr: 0.5 + r() * 0.6, s: 0.7 + r() * 0.6 }));
    this.visible = false;
  }

  set visible(v) {
    this.puffs.mesh.visible = this.glow.mesh.visible = v;
  }

  update(age) {
    const P = this.puffs, G = this.glow;
    P.clear();
    G.clear();
    const Hc = 1600 + 10000 * (1 - Math.exp(-age / 16)); // the cap's height (m)
    const Rc = 500 + 2600 * (1 - Math.exp(-age / 20)); // its radius
    const hot = Math.max(0, 1 - age / 22); // the glow inside fades
    const roll = age * 0.35;
    const x0 = HYPO.x, z0 = HYPO.z;
    // the stem: narrow, brown, from the ground to under the cap
    for (const p of this.stem) {
      const y = p.h * (Hc - Rc * 0.35);
      const w = (250 + 350 * (1 - p.h)) * (0.4 + 0.6 * Math.min(1, age / 10));
      const a = p.th + roll * 0.6;
      const c = 0.45 + 0.15 * p.h;
      P.add(x0 + Math.cos(a) * w * p.rr, y, z0 + Math.sin(a) * w * p.rr, w * 2.3 * p.s, [c * 1.02, c * 0.92, c * 0.8], 0.4, a);
    }
    // the dust skirt round its foot
    for (const p of this.skirt) {
      const rad = (300 + Rc * 0.9) * p.rr;
      P.add(x0 + Math.cos(p.th) * rad, 150 * p.s, z0 + Math.sin(p.th) * rad, 700 * p.s + age * 14, [0.42, 0.37, 0.31], 0.32, p.th);
    }
    // the cap: a ring rolling outwards and upwards, with a dome on top
    for (const p of this.cap) {
      const ph = p.ph + roll;
      const rr = Rc * p.rr;
      let x, y, z;
      if (p.top) {
        x = x0 + Math.cos(p.th) * Rc * 0.55 * p.rr;
        z = z0 + Math.sin(p.th) * Rc * 0.55 * p.rr;
        y = Hc + Rc * 0.35 + Rc * 0.25 * Math.cos(p.th * 3) * p.rr;
      } else {
        const ring = Rc * 0.55 + rr * Math.cos(ph);
        x = x0 + Math.cos(p.th) * ring;
        z = z0 + Math.sin(p.th) * ring;
        y = Hc + rr * 0.7 * Math.sin(ph);
      }
      // lit from above, shadowed underneath (the cap's underside is brown with dust)
      const under = Math.max(0, (Hc - y) / (Rc * 0.7));
      const light = 0.8 + 0.12 * Math.sin(ph) + (p.top ? 0.12 : 0) - under * 0.35;
      const c = [light, light * (0.97 - under * 0.06), light * (0.93 - under * 0.12)];
      c[0] = c[0] * (1 - hot) + 1.0 * hot;
      c[1] = c[1] * (1 - hot) + 0.55 * hot;
      c[2] = c[2] * (1 - hot) + 0.35 * hot;
      P.add(x, y, z, Rc * 1.15 * p.s, c, 0.42, p.th + ph * 0.2);
    }
    // the fire glowing inside the cap while it is young
    if (hot > 0) for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      G.add(x0 + Math.cos(a) * Rc * 0.4, Hc + Math.sin(a * 2) * Rc * 0.15, z0 + Math.sin(a) * Rc * 0.4, Rc * 0.9, [1, 0.55, 0.25], 0.35 * hot, a);
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
