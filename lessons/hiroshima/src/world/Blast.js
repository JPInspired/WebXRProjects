import * as THREE from 'three';
import { HYPO } from './layout.js';
import { LOOKS } from './Atmosphere.js';
import { Puffs } from './Puffs.js';
import { MushroomCloud } from './Fires.js';
import { BLAST_CAPTIONS } from '../data/text.js';

// 8:15, from wherever you are standing (timings in seconds from pressing Play 8:15):
//   0     the bomber's engines high above, its trail across the sky
//   7     the explosion 600 m above Shima Hospital: a flash, the fireball, every surface lit and scorched
//   7+    the blast wave spreads out from below it at a few hundred metres a second: houses fall, trees are
//         stripped, the hall's dome is torn away; it reaches you with a boom and a wall of dust
//   9–19  darkness: dust and smoke; fires start in the wreckage
//   19    (hidden by the dust) the city becomes the ruins of the afternoon
//   24    you see it again from the hills several kilometres away: the cloud rising and spreading over the city
//   60    back where you were, in the afternoon (the After the Bomb moment)
// Nothing in it shows people. Bright flash: soft (⚙) keeps the flash and the boom gentler.

export const T = { DET: 7, SWITCH: 19, FADE1: 23.5, HILL: 24.5, FADE2: 59, END: 60 };
const WAVE = 260; // the blast wave's speed here (m/s): slower than the real one at first, so you can see it come
const HILL = new THREE.Vector3(2610, 140, -3250); // the viewpoint in the hills to the north-east
const DUST = { fog: new THREE.Color(0.4, 0.33, 0.27), sky: new THREE.Color(0.28, 0.22, 0.18) };
const FLASH = { top: 0xfff7e6, horizon: 0xffffff, fog: 0xfff2d8, fogDensity: 0.0006, sun: LOOKS.before.sun, sunColor: 0xffe6b0, sunPower: 6, hemiSky: 0xffffff, hemiGround: 0xfff0d0, hemiPower: 6, ground: 2.6, waterDeep: 0xfff0d0, waterSky: 0xffffff, sunDisc: 0 };
const HILL_LOOK = { ...LOOKS.before, horizon: 0xb7a58e, fog: 0xb9aa98, fogDensity: 0.00005, hemiPower: 1.4 };

export class Blast {
  constructor(app) {
    this.app = app;
    this.running = false;
    this.t = 0;
    const scene = app.scene;
    // a sphere round your head for the flash and the fades
    this.veil = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    this.veil.renderOrder = 1000;
    this.veil.visible = false;
    scene.add(this.veil);
    // the fireball
    this.fireball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, fog: false }));
    this.fireball.visible = false;
    scene.add(this.fireball);
    // the blast wave's dust, and the bomber's trail
    this.dust = new Puffs(320);
    this.trail = new Puffs(70, { fog: false });
    scene.add(this.dust.mesh, this.trail.mesh);
    this.cloud = new MushroomCloud(scene);
    this.cloud.visible = false;
    // the hill you watch from: a grassy rise with a few pines
    this.hill = new THREE.Group();
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(520, 150, 520).translate(HILL.x, HILL.y - 150, HILL.z), new THREE.MeshLambertMaterial({ color: 0x66784a }));
    this.hill.add(mound);
    const pine = new THREE.MeshLambertMaterial({ color: 0x2f4a2a });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4, r = 14 + (i % 3) * 9;
      if (Math.cos(a - 2.4) > 0.6) continue; // keep the view to the city clear
      const tr = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 8).translate(0, 4.5 + 1.5, 0), pine);
      tr.position.set(HILL.x + Math.cos(a) * r, HILL.y - 1, HILL.z + Math.sin(a) * r);
      this.hill.add(tr);
    }
    this.hill.visible = false;
    scene.add(this.hill);
    this.dustLocal = Array.from({ length: 70 }, () => ({ a: Math.random() * Math.PI * 2, r: 4 + Math.random() * 45, y: Math.random() * 16, s: 6 + Math.random() * 14, spin: (Math.random() - 0.5) * 0.3 }));
    this.dustRing = Array.from({ length: 180 }, () => ({ a: Math.random() * Math.PI * 2, y: 2 + Math.random() * 40, s: 18 + Math.random() * 34, lag: Math.random() * 40 }));
  }

  /** Start 8:15 (offset: seconds already gone, for someone joining part-way through). */
  start(offset = 0) {
    const app = this.app;
    this.stop(false);
    app.showEra('before', { blast: true });
    this.e = app.city.eras.before;
    this.prepare(this.e);
    this.home = app.viewerFeet();
    this.t = 0;
    this.caption = -1;
    this.flags = {};
    this.running = true;
    this.soft = !app.state.flash;
    this.veil.visible = true;
    this.dust.clear();
    this.dust.commit();
    if (offset > 0) {
      // catch up quietly
      this.silent = true;
      while (this.t < offset && this.running) this.update(0.1);
      this.silent = false;
    }
  }

  /** Stop part-way (another moment was chosen). `restore`: put the morning's city back as it was. */
  stop(restore = true) {
    if (!this.running && !this.flags) return;
    const onHill = this.flags?.hill && !this.flags?.back; // (stopped while watching from the hills: come back down)
    this.running = false;
    this.veil.visible = false;
    this.fireball.visible = false;
    this.cloud.visible = false;
    this.hill.visible = false;
    this.dust.clear();
    this.dust.commit();
    this.trail.clear();
    this.trail.commit();
    this.app.atmos.flashLight.intensity = 0;
    if (restore && this.e) this.reset(this.e);
    this.flags = null;
    if (onHill && this.home) this.app.moveViewer(this.home, null);
  }

  // ───────────── the morning's city: remember it, and put it back ─────────────

  prepare(e) {
    this.sets = [...e.houses, ...(e.treeMeshes ?? [])].filter((s) => s.list.length);
    for (const s of this.sets) {
      if (!s.order) {
        s.order = s.list.map((_, i) => i).sort((a, b) => (s.list[a].dist ?? 0) - (s.list[b].dist ?? 0));
        s.base = s.list.map((it) => new THREE.Color(it.c ?? 0xffffff));
      }
    }
    this.reset(e);
  }

  reset(e) {
    for (const s of this.sets ?? []) {
      s.head = 0;
      s.active = [];
      s.list.forEach((it, i) => {
        this.place(s, i, 0);
        if (s.mesh.instanceColor) s.mesh.setColorAt(i, s.base[i]);
      });
      s.mesh.instanceMatrix.needsUpdate = true;
      if (s.mesh.instanceColor) s.mesh.instanceColor.needsUpdate = true;
    }
    if (e.hall) e.hall.visible = true;
    if (e.hallRuin) e.hallRuin.visible = false;
  }

  /** One house (or tree) part-way through falling: p 0 = standing, 1 = down. */
  place(s, i, p) {
    const it = s.list[i];
    const dx = it.x - HYPO.x, dz = it.z - HYPO.z;
    const d = Math.hypot(dx, dz) || 1;
    const k = p * p * (3 - 2 * p);
    const lean = s.concrete ? 0.04 * Math.sin(p * Math.PI) : s.crown ? 0 : s.tree ? 0.45 : 1.25;
    const axis = _a.set(dz / d, 0, -dx / d);
    _q.setFromAxisAngle(axis, lean * k);
    _q2.setFromAxisAngle(_up, it.ry ?? 0);
    if (it.tilt) _q2.multiply(_q3.setFromEuler(_e.set(it.tilt[0], 0, it.tilt[1])));
    _q.multiply(_q2);
    const y = it.y ?? 0;
    _p.set(0, y, 0).applyAxisAngle(axis, lean * k);
    const sink = s.concrete || s.tree || s.crown ? 0 : k * 1.2;
    _p.add(_v.set(it.x, -sink, it.z));
    const squash = s.concrete ? 1 : s.crown ? 1 - k : s.tree ? 1 : 1 - 0.55 * k;
    _s.set(it.sx * (s.crown ? 1 - k : 1), it.sy * squash, it.sz * (s.crown ? 1 - k : 1));
    s.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }

  // ───────────── every frame ─────────────

  update(dt) {
    if (!this.running) return;
    const app = this.app;
    const t = (this.t += dt);
    const f = this.flags;
    const atmos = app.atmos;
    this.veil.position.copy(app.viewerHead());

    // captions
    let c = -1;
    BLAST_CAPTIONS.forEach((cap, i) => { if (t >= cap.t) c = i; });
    if (c !== this.caption) {
      this.caption = c;
      if (!this.silent && c >= 0) app.blastCaption(BLAST_CAPTIONS[c]);
    }

    // 0–7: the bomber high above, its trail
    if (t < T.DET + 1) {
      if (!f.drone && !this.silent) { f.drone = true; app.audio.drone(T.DET + 1); }
      this.trail.clear();
      const head = -2600 + t * 700;
      for (let i = 0; i < 60; i++) {
        const x = head - i * 45;
        if (x < -2600) break;
        this.trail.add(HYPO.x + x, 7500, HYPO.z - 1800 + x * 0.25, 60 + i * 2.5, [1, 1, 1], Math.max(0, 0.45 - i * 0.006) * (t < T.DET ? 1 : 1 - (t - T.DET)), i);
      }
      this.trail.commit();
    } else if (!f.trailGone) {
      f.trailGone = true;
      this.trail.clear();
      this.trail.commit();
    }

    if (t < T.DET) return;
    const s = t - T.DET; // seconds since the explosion
    const viewer = this.home;
    const vd = Math.hypot(viewer[0] - HYPO.x, viewer[2] - HYPO.z);
    const R = s * WAVE; // the blast wave's reach along the ground
    const arrived = R >= vd;

    // the flash: white everywhere, fading; the fireball above Shima Hospital
    if (!f.flash) {
      f.flash = true;
      this.fireball.visible = true;
      if (!this.silent) app.interaction?.pulseAll(0.4, 120);
    }
    const flashK = Math.max(0, 1 - s / (this.soft ? 1.4 : 2.6));
    this.veil.material.color.set(0xffffff);
    this.veil.material.opacity = (this.soft ? 0.45 : 0.96) * flashK * flashK;
    atmos.flashLight.position.set(HYPO.x, HYPO.height + s * 30, HYPO.z);
    atmos.flashLight.intensity = 40 * Math.exp(-s / 0.9) * (this.soft ? 0.5 : 1);
    const fbR = 150 * (1 - Math.exp(-s / 0.3)) + s * 4;
    this.fireball.position.set(HYPO.x, HYPO.height + s * 35, HYPO.z);
    this.fireball.scale.setScalar(fbR);
    const fc = this.fireball.material.color;
    if (s < 0.4) fc.setRGB(1, 1, 1);
    else if (s < 2) fc.setRGB(1, 0.95 - (s - 0.4) * 0.25, 0.8 - (s - 0.4) * 0.45);
    else fc.setRGB(Math.max(0.45, 1 - (s - 2) * 0.08), Math.max(0.12, 0.55 - (s - 2) * 0.06), Math.max(0.05, 0.08));
    this.fireball.material.opacity = s < 6 ? 1 : Math.max(0, 1 - (s - 6) / 3);
    if (s > 9.5) this.fireball.visible = false;

    // the heat: everything near scorched dark in the first moments
    const scorch = Math.min(1, s / 1.6);
    if (!f.scorched && this.e) {
      for (const set of this.sets) {
        if (!set.mesh.instanceColor) continue;
        set.list.forEach((it, i) => {
          const k = scorch * Math.max(0, 1 - (it.dist ?? 0) / 2200) * (set.crown ? 0.9 : set.concrete ? 0.55 : 0.75);
          _c.copy(set.base[i]).lerp(_char, k);
          set.mesh.setColorAt(i, _c);
        });
        set.mesh.instanceColor.needsUpdate = true;
      }
      if (scorch >= 1) f.scorched = true;
    }

    // the blast wave: houses fall, trees are stripped, as it passes each one
    const span = 0.7 * WAVE; // each takes about 0.7 s to go down
    for (const set of this.sets) {
      while (set.head < set.order.length && (set.list[set.order[set.head]].dist ?? 0) <= R) set.active.push(set.order[set.head++]);
      if (!set.active.length) continue;
      const keep = [];
      for (const i of set.active) {
        const p = Math.min(1, (R - (set.list[i].dist ?? 0)) / span);
        this.place(set, i, p);
        if (p < 1) keep.push(i);
      }
      set.active = keep;
      set.mesh.instanceMatrix.needsUpdate = true;
    }
    // the hall: its dome torn away
    const hd = Math.hypot(5 - HYPO.x, 4 - HYPO.z);
    if (!f.hall && R >= hd && this.e) {
      f.hall = true;
      this.e.hall.visible = false;
      this.e.hallRuin.visible = true;
    }

    // the dust: a wall rolling outwards, then all round you once it has passed
    this.dust.clear();
    if (s < 16) {
      for (const p of this.dustRing) {
        const r = Math.max(0, R - p.lag);
        if (r < 5 || r > 1700) continue;
        const fade = Math.min(1, (1700 - r) / 600);
        this.dust.add(HYPO.x + Math.cos(p.a) * r, p.y * (1 + r / 400), HYPO.z + Math.sin(p.a) * r, p.s * (1 + r / 500), [0.52, 0.45, 0.37], 0.55 * fade, p.a);
      }
    }
    if (arrived) {
      if (!f.boom) {
        f.boom = true;
        this.arrivedAt = s;
        if (!this.silent) {
          app.audio.blast(this.soft);
          app.interaction?.pulseAll(1, 700);
        }
      }
      const since = s - this.arrivedAt;
      const k = Math.min(1, since / 1.2);
      for (const p of this.dustLocal) {
        const a = p.a + since * p.spin;
        this.dust.add(viewer[0] + Math.cos(a) * p.r, 1 + p.y + since * 0.3, viewer[2] + Math.sin(a) * p.r, p.s, [0.5, 0.43, 0.35], 0.32 * k * Math.max(0, 1 - Math.max(0, t - T.SWITCH) / 5), a);
      }
    }
    this.dust.commit();
    this.dust.fog(atmos.now.fog, atmos.now.fogDensity);

    // the light and the air: the flash, then dust and darkness once the wave has passed you, then smoky ruins
    if (t < T.HILL) {
      const before = { ...LOOKS.before };
      atmos.mix(before, FLASH, flashK);
      if (arrived) {
        const k = Math.min(1, (s - this.arrivedAt) / 1.5);
        const thin = Math.max(0, Math.min(1, (t - 15) / 8)); // the dust settles a little, the smoke stays
        const dense = 0.02 - 0.012 * thin;
        atmos.now.fog.lerp(DUST.fog, k);
        atmos.now.fogDensity = THREE.MathUtils.lerp(atmos.now.fogDensity, dense, k);
        atmos.now.top.lerp(DUST.sky, k);
        atmos.now.horizon.lerp(DUST.fog, k);
        atmos.now.hemiSky.lerp(new THREE.Color(0xb08a6a), k);
        atmos.now.hemiPower = THREE.MathUtils.lerp(atmos.now.hemiPower, 0.8, k);
        atmos.now.sunPower = THREE.MathUtils.lerp(atmos.now.sunPower, 0.5, k);
        atmos.now.sunDisc *= 1 - k;
        atmos.now.ground = THREE.MathUtils.lerp(atmos.now.ground, 0.55, k);
      }
      atmos.apply();
    }

    // fires start in the wreckage
    const fires = app.fires;
    if (!f.fires && s > 4) {
      f.fires = true;
      const spots = [];
      for (const set of this.e.houses) {
        if (set.roof || set.concrete) continue;
        for (const it of set.list) if (Math.hypot(it.x - viewer[0], it.z - viewer[2]) < 260 && Math.random() < 0.09) spots.push({ x: it.x, z: it.z, size: 1.4 + Math.random() * 1.4 });
      }
      fires.setSpots(spots);
      fires.visible = true;
    }
    if (f.fires && t < T.HILL) fires.level = Math.min(1, (s - 4) / 8);

    // under the dust, the city becomes the afternoon's ruins
    if (!f.switched && t >= T.SWITCH) {
      f.switched = true;
      app.showEra('after', { blast: true, keepLook: true });
    }

    // to the hills: fade to dark, move, fade back in
    if (t >= T.FADE1 && t < T.HILL) {
      this.veil.material.color.set(0x000000);
      this.veil.material.opacity = (t - T.FADE1) / (T.HILL - T.FADE1);
    }
    if (!f.hill && t >= T.HILL) {
      f.hill = true;
      this.hill.visible = true;
      this.cloud.visible = true;
      fires.visible = false;
      app.moveViewer([HILL.x, HILL.y, HILL.z], [HYPO.x, 2600, HYPO.z]);
      atmos.mix(HILL_LOOK, HILL_LOOK, 0);
      atmos.apply();
      if (!this.silent) {
        app.audio.ambience('hill');
        app.audio.rumble(T.FADE2 - T.HILL);
      }
    }
    if (t >= T.HILL && t < T.FADE2) {
      this.veil.material.color.set(0x000000);
      this.veil.material.opacity = Math.max(0, 1 - (t - T.HILL) / 1.2);
      this.cloud.update(8 + (t - T.HILL) * 1.4);
    }
    if (t >= T.FADE2 && t < T.END) {
      this.veil.material.color.set(0x000000);
      this.veil.material.opacity = (t - T.FADE2) / (T.END - T.FADE2);
    }
    if (t >= T.END) {
      // back where you were, that afternoon
      f.back = true;
      this.stop(false);
      app.moveViewer(this.home, null);
      app.blastFinished();
    }
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _a = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();
const _char = new THREE.Color(0.09, 0.075, 0.065);
