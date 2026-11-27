import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { METALS } from '../data/lithium.js';
import { pop, fizz, bang } from './sounds.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { benchTop, bunsenBurner, metalMaterial, glassMaterial, liquidMaterial, bubbleTexture } from '../../../../shared/lab/kit.js';
import { shapeRecipe } from '../../../../shared/net/LabMirror.js';

// The bench, as in the original lesson: five metal cubes (lithium, and four mystery metals B–E), a Bunsen
// burner, and a tank of water — plus a safety screen that slides across in front of the tank.
//
// Water test: drop a cube in the tank. It floats or sinks (by density), fizzes, darts about, melts into a
// ball, may set its hydrogen alight, and finally disappears — faster and more violently down the group. The
// most reactive end with an explosion; without the screen across, a much bigger one, and a safety warning.
// Flame test: hold a cube over the Bunsen flame and the flame takes on the metal's colour.

export const TOP = -0.3;
const TRAY = new THREE.Vector3(-0.32, TOP, 0.15);
const BURNER = new THREE.Vector3(-0.12, TOP, -0.04);
const FLAME_Y = TOP + 0.13;
const TANK = new THREE.Vector3(0.2, TOP, -0.02);
const TANK_W = 0.24;
const TANK_D = 0.14;
const TANK_H = 0.09;
const WATER_Y = TOP + 0.07;
const CUBE = 0.014;
const SLOTS = ['A', 'B', 'C', 'D', 'E'];

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, envMapIntensity: 0.6, ...o });
const cubeGeo = () => new RoundedBoxGeometry(CUBE, CUBE, CUBE, 2, CUBE * 0.12); // a cut cube of soft metal
/** A flame shape (turned): a wide soft outer flame, or a small inner cone. Origin at its base. */
const flameShape = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24);

/** Particles (hydrogen bubbles, sparks) for a Points geometry of n points. */
function makeSparks(n) {
  return { pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n), n, acc: 0 };
}

function spawnSpark(f, p, v, life) {
  for (let i = 0; i < f.n; i++) {
    if (f.life[i] > 0) continue;
    f.life[i] = life;
    f.pos.set([p.x, p.y, p.z], i * 3);
    f.vel.set([v.x, v.y, v.z], i * 3);
    return;
  }
}

/** Hydrogen bubbling up round a reacting metal at pos, `rate` a second. */
function fizzSparks(f, pos, rate, dt) {
  f.acc += dt * rate;
  while (f.acc >= 1) {
    f.acc--;
    spawnSpark(f, new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.012, pos.y, pos.z + (Math.random() - 0.5) * 0.012), new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.05 + Math.random() * 0.05, (Math.random() - 0.5) * 0.02), 0.5);
  }
}

/** An explosion's sparks flying up and out from at, for a bang of size big. */
function burstSparks(f, at, big) {
  for (let i = 0; i < 25 * big; i++) {
    const d = new THREE.Vector3().randomDirection();
    d.y = Math.abs(d.y);
    spawnSpark(f, at, d.multiplyScalar(0.15 + Math.random() * 0.25 * big), 0.7);
  }
}

/** The particles move, slow as they rise, and fade. */
function stepSparks(f, geo, dt) {
  for (let i = 0; i < f.n; i++) {
    if (f.life[i] <= 0) {
      f.pos[i * 3 + 1] = -100;
      continue;
    }
    f.life[i] -= dt;
    for (let a = 0; a < 3; a++) f.pos[i * 3 + a] += f.vel[i * 3 + a] * dt;
    f.vel[i * 3 + 1] -= (f.vel[i * 3 + 1] > 0.3 ? 0.6 : 0) * dt;
  }
  geo.attributes.position.needsUpdate = true;
}
export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    const top = benchTop(0.92, 0.4, { color: 0x2a3140 });
    top.position.set(0, TOP, 0.06);
    this.group.add(top);

    // the tray of metal cubes (stored under oil, in little dishes)
    this.cubes = SLOTS.map((slot, i) => {
      const home = new THREE.Vector3(TRAY.x + (i - 2) * 0.055, TOP + 0.004 + CUBE / 2, TRAY.z);
      // a glass dish with a little oil in it (these metals are kept under oil, away from air and water)
      const dish = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.019, 0], [0.021, 0.001], [0.021, 0.009], [0.0198, 0.009], [0.0198, 0.0015], [0, 0.0015]].map(([r, y]) => new THREE.Vector2(r, y)), 32), glassMaterial());
      dish.position.set(home.x, TOP, home.z);
      const oil = new THREE.Mesh(new THREE.CylinderGeometry(0.0196, 0.0196, 0.004, 28), liquidMaterial(0xf2d77a, 0.45));
      oil.position.set(home.x, TOP + 0.0035, home.z);
      this.group.add(oil);
      const tag = makeLabel(slot === 'A' ? 'A · Lithium' : `${slot} · ?`, { height: 0.012, size: 36 });
      tag.position.set(home.x, TOP + 0.04, home.z + 0.02);
      this.group.add(dish, tag);
      const mesh = new THREE.Mesh(cubeGeo(), metalMaterial('li'));
      mesh.position.copy(home);
      const cube = { slot, mesh, home, where: 'tray', test: null };
      mesh.userData = { handler: this, cube };
      this.group.add(mesh);
      return cube;
    });

    // Bunsen burner: base, barrel, and a flame whose colour changes
    const burner = bunsenBurner({ barrel: 0.084 });
    burner.position.set(BURNER.x, TOP, BURNER.z);
    burner.userData.setFlame(false);
    this.group.add(burner);
    const flameBase = TOP + burner.userData.barrelTop;
    // glowing (additive) flames: a soft outer flame whose colour changes, and a bright blue inner cone
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0x4f8bff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.flame = new THREE.Mesh(flameShape([[0.0072, 0], [0.0092, 0.006], [0.0099, 0.014], [0.0096, 0.024], [0.0085, 0.034], [0.0068, 0.044], [0.0045, 0.052], [0.0022, 0.058], [0, 0.062]]), this.flameMat);
    this.flame.position.set(BURNER.x, flameBase, BURNER.z);
    this.innerFlame = new THREE.Mesh(flameShape([[0.0062, 0], [0.006, 0.005], [0.0052, 0.011], [0.0038, 0.017], [0.002, 0.022], [0, 0.026]]), new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.innerFlame.position.set(BURNER.x, flameBase, BURNER.z);
    const bTag = makeLabel('Bunsen burner', { height: 0.012, size: 36 });
    bTag.position.set(BURNER.x, TOP + 0.19, BURNER.z);
    this.group.add(this.flame, this.innerFlame, bTag);
    this.flameAt = new THREE.Vector3(BURNER.x, FLAME_Y + 0.02, BURNER.z);
    this.flameColour = null;

    // the tank of water
    const glass = new THREE.Mesh(new RoundedBoxGeometry(TANK_W, TANK_H, TANK_D, 3, 0.006), glassMaterial());
    glass.position.set(TANK.x, TOP + TANK_H / 2, TANK.z);
    glass.renderOrder = 3;
    this.water = new THREE.Mesh(new RoundedBoxGeometry(TANK_W - 0.006, WATER_Y - TOP, TANK_D - 0.006, 2, 0.004), liquidMaterial(0x5aa8e6, 0.26)); // a big body of water: kept clear
    this.water.position.set(TANK.x, (WATER_Y + TOP) / 2, TANK.z);
    const wTag = makeLabel('Water', { height: 0.012, size: 36 });
    wTag.position.set(TANK.x, TOP + TANK_H + 0.025, TANK.z - TANK_D / 2);
    this.group.add(this.water, glass, wTag);

    // the safety screen: a clear panel on a stand that slides across in front of the tank
    this.screen = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.006), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false }));
    pane.position.y = 0.09;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.012, 0.03), mat(0x3d4766, { metalness: 0.5, roughness: 0.4 }));
    frame.position.y = 0.006;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.165, 0.01), mat(0x9aa0aa, { metalness: 0.8, roughness: 0.3 }));
      post.position.set(sx * 0.133, 0.09, 0);
      this.screen.add(post);
    }
    const sTag = makeLabel('Safety screen', { height: 0.012, size: 36 });
    sTag.position.y = 0.185;
    this.screen.add(pane, frame, sTag);
    for (const m of [pane, frame]) m.userData = { handler: this, screen: true, tapOnly: true };
    this.screenPicks = [pane, frame];
    this.screenAway = new THREE.Vector3(TANK.x + 0.3, TOP, TANK.z + 0.11);
    this.screenAcross = new THREE.Vector3(TANK.x, TOP, TANK.z + TANK_D / 2 + 0.03);
    this.screen.position.copy(this.screenAway);
    this.screenOn = false;
    this.group.add(this.screen);

    // effects: bubbles, a hydrogen flame on the water, an explosion flash
    const n = 260;
    this.fx = makeSparks(n);
    this.fizzAt = null; // [x, y, z, rate] while a metal reacts
    this.burst = [0, 0, 0, 0, 0]; // [count, x, y, z, big]: the latest explosion
    this.particles = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.fx.pos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.0065, map: bubbleTexture(), transparent: true, opacity: 0.95, depthWrite: false }));
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
    // the class copy (shared/net/LabMirror.js): the same bubbles and sparks, made by the copy from where and how
    // hard the teacher's metal reacts, and each explosion (not each particle)
    shapeRecipe(this.particles, () => [...(this.fizzAt ?? [0, 0, 0, 0]), ...this.burst], (copy) => {
      const fx = makeSparks(n);
      copy.geometry.setAttribute('position', new THREE.BufferAttribute(fx.pos, 3));
      let fizz = null;
      let bursts = null;
      return {
        set: (a) => {
          fizz = a[3] > 0 ? new THREE.Vector3(a[0], a[1], a[2]) : null;
          fizz && (fizz.rate = a[3]);
          if (bursts !== null && a[4] !== bursts) burstSparks(fx, new THREE.Vector3(a[5], a[6], a[7]), a[8]);
          bursts = a[4];
        },
        tick: (dt) => {
          if (fizz) fizzSparks(fx, fizz, fizz.rate, dt);
          stepSparks(fx, copy.geometry, dt);
        },
      };
    });
    this.h2Flame = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.035, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb343, transparent: true, opacity: 0.8, depthWrite: false }));
    this.h2Flame.visible = false;
    this.group.add(this.h2Flame);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0, depthWrite: false }));
    this.flash.visible = false;
    this.group.add(this.flash);
    this.reaction = null; // the water test in progress
  }

  get targets() {
    const t = [...this.screenPicks];
    for (const c of this.cubes) if (c.where !== 'water') t.push(c.mesh);
    return t;
  }

  near(p, target, r) {
    if (this.app.presenting) return p.distanceTo(target) < r;
    const cam = this.app.camera;
    const a = this.group.localToWorld(p.clone()).project(cam);
    const b = this.group.localToWorld(target.clone()).project(cam);
    return Math.hypot((a.x - b.x) * cam.aspect, a.y - b.y) < r * 2.2;
  }

  overTank(p) {
    if (this.app.presenting) return Math.abs(p.x - TANK.x) < TANK_W / 2 && Math.abs(p.z - TANK.z) < TANK_D / 2 && p.y > TOP && p.y < TOP + 0.25;
    return this.near(p, new THREE.Vector3(TANK.x, WATER_Y, TANK.z), 0.08);
  }

  describe(o) {
    const u = o.userData;
    if (u.screen) return this.screenOn ? 'Safety screen (across) · tap to move it away' : 'Safety screen · tap to pull it across the tank';
    if (u.cube) return `${u.cube.slot === 'A' ? 'Lithium' : `Mystery metal ${u.cube.slot}`} · drop it in the water, or hold it over the flame`;
    return '';
  }

  tap(o) {
    if (o.userData.screen) this.app.toggleScreen();
  }

  setScreen(on) {
    this.screenOn = on;
    this.screen.position.copy(on ? this.screenAcross : this.screenAway);
  }

  grab(o, mode, world) {
    const c = o.userData.cube;
    if (!c || c.where === 'water' || this.reaction) {
      if (c && this.reaction) this.app.waitForReaction();
      return null;
    }
    const off = c.mesh.position.clone().sub(this.group.worldToLocal(world.clone()));
    c.where = 'held';
    let heat = 0;
    let last = performance.now();
    return {
      move: (w) => {
        c.mesh.position.copy(this.group.worldToLocal(w.clone())).add(off);
        c.mesh.position.y = Math.max(TOP + CUBE / 2, c.mesh.position.y);
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (this.near(c.mesh.position, this.flameAt, 0.035)) {
          heat += dt;
          this.setFlame(this.app.metalOf(c.slot));
          if (heat > 0.8) this.app.onFlameTest(c.slot);
        } else {
          heat = 0;
          this.setFlame(null);
        }
      },
      release: () => {
        this.setFlame(null);
        if (this.overTank(c.mesh.position)) this.drop(c);
        else {
          c.where = 'tray';
          c.mesh.position.copy(c.home);
        }
      },
    };
  }

  /** The Bunsen flame: blue on its own, the metal's colour while a cube is held in it. */
  setFlame(id) {
    if (id === this.flameColour) return;
    this.flameColour = id;
    this.flameMat.color.set(id ? METALS[id].flame : 0x4f8bff);
    this.flameMat.opacity = id ? 0.92 : 0.75;
    this.flame.scale.setScalar(id ? 1.35 : 1);
  }

  /** Hold a cube in the flame without the mouse (for buttons and tests). */
  flameTest(slot) {
    this.setFlame(this.app.metalOf(slot));
    this.app.onFlameTest(slot);
    clearTimeout(this.flameTimer);
    this.flameTimer = setTimeout(() => this.setFlame(null), 2500);
  }

  /** Drop a cube into the water: the reaction is set up from the metal's properties. */
  drop(c) {
    const id = this.app.metalOf(c.slot);
    const m = METALS[id];
    const sinks = m.density > 1;
    c.where = 'water';
    const x = THREE.MathUtils.clamp(c.mesh.position.x, TANK.x - TANK_W / 2 + 0.03, TANK.x + TANK_W / 2 - 0.03);
    const z = THREE.MathUtils.clamp(c.mesh.position.z, TANK.z - TANK_D / 2 + 0.03, TANK.z + TANK_D / 2 - 0.03);
    c.mesh.position.set(x, WATER_Y + 0.002, z);
    const noise = 1 + (Math.random() - 0.5) * 0.12;
    this.reaction = {
      c, id, m, sinks, t: 0,
      dur: m.reactSeconds * noise,
      shielded: this.screenOn,
      vx: (Math.random() - 0.5) * 0.04 * (1 + m.violence),
      vz: (Math.random() - 0.5) * 0.04 * (1 + m.violence),
      ball: false,
    };
    fizz(m.violence);
    this.app.onDropped(c.slot, sinks);
  }

  spawn(p, v, life) {
    spawnSpark(this.fx, p, v, life);
  }

  update(dt) {
    const ft = performance.now() / 1000;
    this.flame.scale.y = (this.flameColour ? 1.35 : 1) * (1 + 0.06 * Math.sin(ft * 23) + 0.04 * Math.sin(ft * 37 + 1));
    this.innerFlame.scale.y = 1 + 0.04 * Math.sin(ft * 31);
    const r = this.reaction;
    if (r) {
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const pos = r.c.mesh.position;
      // floating metals skate about on the surface; sinking ones settle to the bottom first
      if (r.sinks) pos.y = Math.max(TOP + 0.008, pos.y - dt * 0.35);
      else {
        pos.x += r.vx * dt;
        pos.z += r.vz * dt;
        if (Math.abs(pos.x - TANK.x) > TANK_W / 2 - 0.02) r.vx *= -1;
        if (Math.abs(pos.z - TANK.z) > TANK_D / 2 - 0.02) r.vz *= -1;
        r.vx += (Math.random() - 0.5) * 0.05 * r.m.violence * dt * 10;
        r.vz += (Math.random() - 0.5) * 0.05 * r.m.violence * dt * 10;
      }
      // melting metals turn into a silvery ball
      if (r.m.melts && !r.ball && r.t > Math.min(0.4, r.dur * 0.2)) {
        r.ball = true;
        r.c.mesh.geometry.dispose();
        r.c.mesh.geometry = new THREE.SphereGeometry(CUBE * 0.55, 16, 12);
      }
      r.c.mesh.scale.setScalar(Math.max(0.05, 1 - k * 0.95));
      // bubbles of hydrogen
      const rate = 20 + 50 * r.m.violence;
      this.fizzAt = [pos.x, pos.y, pos.z, rate];
      fizzSparks(this.fx, pos, rate, dt);
      // the hydrogen catches fire for the more reactive metals
      this.h2Flame.visible = r.m.violence >= 1 && !r.sinks && (r.m.violence >= 2 || k > 0.5);
      if (this.h2Flame.visible) {
        this.h2Flame.material.color.set(r.m.violence >= 2 ? r.m.flame : 0xffa040);
        this.h2Flame.position.set(pos.x, WATER_Y + 0.02, pos.z);
        this.h2Flame.scale.setScalar(0.8 + Math.random() * 0.5);
      }
      if (r.t >= r.dur) this.finish(r);
    }
    if (!this.reaction) this.fizzAt = null;
    // particles
    stepSparks(this.fx, this.particles.geometry, dt);
    // explosion flash fades
    if (this.flash.visible) {
      this.flashT += dt;
      const k = this.flashT / 0.6;
      this.flash.material.opacity = Math.max(0, 0.85 * (1 - k));
      this.flash.scale.setScalar(this.flashSize * (0.4 + k));
      if (k >= 1) this.flash.visible = false;
    }
  }

  finish(r) {
    this.reaction = null;
    this.h2Flame.visible = false;
    const pos = r.c.mesh.position.clone();
    if (r.m.violence >= 2) {
      const unshielded = !r.shielded;
      const big = r.m.violence * (unshielded ? 2 : 1);
      this.flash.visible = true;
      this.flashT = 0;
      this.flashSize = 0.025 * big;
      this.flash.material.color.set(r.m.flame).lerp(new THREE.Color(0xffffff), 0.5);
      this.flash.position.copy(pos).setY(Math.max(pos.y, WATER_Y));
      burstSparks(this.fx, this.flash.position, big);
      this.burst = [this.burst[0] + 1, ...this.flash.position.toArray(), big];
      bang(big);
    } else pop();
    // the cube is used up; a fresh piece comes from the oil jar
    r.c.mesh.geometry.dispose();
    r.c.mesh.geometry = cubeGeo();
    r.c.mesh.scale.setScalar(1);
    r.c.mesh.position.copy(r.c.home);
    r.c.where = 'tray';
    this.app.onReacted(r.c.slot, { seconds: Math.round(r.t * 10) / 10, sinks: r.sinks, shielded: r.shielded, violence: r.m.violence });
  }

  /** Drop a slot's cube into the water without the mouse (for buttons and tests). */
  quickDrop(slot) {
    const c = this.cubes.find((x) => x.slot === slot);
    if (this.reaction || c.where === 'water') return false;
    c.mesh.position.set(TANK.x, WATER_Y, TANK.z);
    this.drop(c);
    return true;
  }
}
