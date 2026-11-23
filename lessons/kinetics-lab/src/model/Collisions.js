import * as THREE from 'three';
import { CanvasPanel, THEME } from '../../../../shared/ui/CanvasPanel.js';
import { FACTORS } from '../data/kinetics.js';
import { sound } from '../../../../shared/util/sound.js';

// Collision theory (see what the textbook only describes): a magnified bubble of the reaction, following the
// factor the class is investigating. Particles of acid (or of hydrogen peroxide, for the catalyst) move about
// and hit the solid at the bottom. A hit only reacts if it has enough energy (the activation energy): those
// flash yellow and a bubble of gas rises. The card counts all hits and successful hits each second.
//  • Temperature: the particles move faster, so they hit more often AND more hits have enough energy.
//  • Surface area: the same amount of marble as one lump, chips or powder: more surface, more hits.
//  • Concentration: more acid particles in the same space: more hits.
//  • Catalyst: grains of catalyst give the reaction an easier route (lower activation energy): far more of the
//    same hits succeed.
// The teacher can show everyone their bubble (Teacher menu › Collisions).

const AT = new THREE.Vector3(-0.36, 0.12, -0.12); // the bubble, in lab space
const R = 0.16; // m
const MAXP = 260;
const FLOOR = -0.62; // the solid's top surface (unit space)

// how each setting looks inside the bubble
/**
 * Pieces of the same total amount of solid: one lump in the middle, or smaller pieces scattered through the
 * lower half of the bubble. Smaller pieces expose more surface, so more particles hit them.
 */
function pieces(k, size) {
  if (k === 1) return [{ x: 0, y: FLOOR + 0.05, z: 0, w: size, h: size * 0.55, d: size }];
  const out = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < k; i++) {
    const x = (rnd() * 2 - 1) * 0.55, z = (rnd() * 2 - 1) * 0.55, y = FLOOR + 0.05 + rnd() * 0.55;
    out.push({ x, y, z, w: size, h: size, d: size });
  }
  return out;
}

// how each setting looks inside the bubble. frac: the share of hits with enough energy to react.
function setup(factor, opt) {
  const s = { n: 110, speed: 0.34, frac: 0.15, blocks: pieces(1, 0.45), colour: 0xff5a5a, solid: 0xeeece6, label: 'acid particles (H⁺)' };
  if (factor === 'temperature') {
    const T = Number(opt);
    s.speed = 0.26 * (1 + (T - 20) / 20); // faster when hotter (exaggerated so it can be seen)
    s.frac = 0.08 * 2 ** ((T - 20) / 10); // and more hits have enough energy: roughly double every 10 °C
    s.solid = 0xd4d8de; // magnesium ribbon
    s.blocks = [{ x: 0, y: FLOOR + 0.06, z: 0, w: 0.95, h: 0.07, d: 0.4 }];
  } else if (factor === 'surface') {
    // the same total volume: 1 lump, 27 chips or 343 grains (each a third, then a seventh, of the size)
    const k = { lump: 1, chips: 27, powder: 125 }[opt] ?? 1;
    s.blocks = pieces(k, 0.45 / Math.cbrt(k));
  } else if (factor === 'concentration') {
    s.n = Math.round(60 * Number(opt));
    s.blocks = [{ x: 0, y: FLOOR + 0.06, z: 0, w: 0.95, h: 0.08, d: 0.45 }]; // (a flat slab of marble chips: the same for every concentration)
  } else if (factor === 'catalyst') {
    s.colour = 0x6fb6ff;
    s.label = 'hydrogen peroxide particles';
    s.frac = { none: 0, cuo: 0.15, mno2: 0.6 }[opt] ?? 0;
    s.solid = { none: null, cuo: 0x2b2b2b, mno2: 0x3a3330 }[opt] ?? null;
    s.blocks = s.solid ? pieces(30, 0.12) : [];
  }
  return s;
}

export class Collisions {
  constructor(app) {
    this.app = app;
    this.on = false;
    this.group = new THREE.Group();
    this.group.position.copy(AT);
    this.group.visible = false;
    app.lab.add(this.group);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.12, roughness: 0.05, side: THREE.BackSide, depthWrite: false }));
    const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.005, 40, 24), new THREE.MeshBasicMaterial({ color: 0x9ec9ff, transparent: true, opacity: 0.18, wireframe: true, depthWrite: false }));
    glass.raycast = rim.raycast = () => {};
    this.group.add(glass, rim);
    this.inner = new THREE.Group(); // unit space
    this.inner.scale.setScalar(R);
    this.group.add(this.inner);
    // particles
    this.ball = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), MAXP);
    this.ball.raycast = () => {};
    this.inner.add(this.ball);
    this.p = Array.from({ length: MAXP }, () => ({ pos: new THREE.Vector3(), v: new THREE.Vector3(), flash: 0 }));
    // the solid (blocks) and gas bubbles
    this.solidMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.7 });
    this.blocks = new THREE.Group();
    this.inner.add(this.blocks);
    this.bubbles = [];
    this.bubbleGeo = new THREE.SphereGeometry(1, 12, 8);
    this.bubbleMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.05 });
    this.hits = []; // times of recent hits [t, ok]
    this.card = new CanvasPanel({ width: 0.4, height: 0.42, name: 'collisions-card', fit: 0.15 });
    this.card.mesh.position.set(AT.x + 0.33, AT.y + 0.02, AT.z + 0.02);
    this.card.mesh.rotation.y = 0.12;
    this.card.mesh.visible = false;
    app.lab.add(this.card.mesh);
    app.panels.push(this.card);
    this.card.setBuilder((ui) => this.drawCard(ui));
    this.factor = null;
    this.opt = null;
  }

  /** Whose settings: mine, or the teacher's while they show everyone. */
  get source() {
    if (this.app.teacherCollisions) return this.app.teacherCollisions;
    const factor = this.app.state.factor;
    const opts = FACTORS[factor].options;
    // (a choice from another factor, e.g. 40 °C after switching to Catalyst: start from that factor's first option)
    return { factor, opt: opts.some(([id]) => id === this.opt) ? this.opt : opts[0][0] };
  }

  setOn(on) {
    this.on = on;
    this.group.visible = on;
    this.card.mesh.visible = on;
    this.card.redraw();
  }

  choose(opt) {
    this.opt = opt;
    sound.click();
    this.card.redraw();
  }

  /** Build the scene for a factor and option. */
  build(factor, opt) {
    this.factor = factor;
    this.shownOpt = opt;
    this.s = setup(factor, opt);
    this.blocks.clear();
    this.solidMat.color.setHex(this.s.solid ?? 0xffffff);
    for (const b of this.s.blocks) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), this.solidMat);
      m.position.set(b.x, b.y, b.z);
      m.rotation.set(b.y * 7, b.x * 9, b.z * 5); // (pieces lie every which way)
      if (b.w === b.d && b.w === b.h) m.rotation.set(b.y * 7, b.x * 9, b.z * 5);
      else m.rotation.set(0, 0, 0);
      m.raycast = () => {};
      this.blocks.add(m);
    }
    this.ball.material.color.setHex(this.s.colour);
    for (let i = 0; i < MAXP; i++) {
      const q = this.p[i];
      do q.pos.set(Math.random() * 2 - 1, Math.random() * 1.4 - 0.55, Math.random() * 2 - 1);
      while (q.pos.length() > 0.85);
      q.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).setLength(this.s.speed);
      q.flash = 0;
    }
    this.hits = [];
    this.total = { all: 0, ok: 0 }; // (running totals since this setting was shown)
  }

  /** Is this point inside the solid? Returns the block it hit, or null. */
  inSolid(p) {
    for (const b of this.s.blocks) {
      if (Math.abs(p.x - b.x) < b.w / 2 + 0.02 && Math.abs(p.y - b.y) < b.h / 2 + 0.02 && Math.abs(p.z - b.z) < b.d / 2 + 0.02) return b;
    }
    return null;
  }

  update(dt) {
    if (!this.on) return;
    const src = this.source;
    if (src.factor !== this.factor || src.opt !== this.shownOpt) this.build(src.factor, src.opt);
    const s = this.s;
    const now = performance.now() / 1000;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const base = new THREE.Color(s.colour);
    const flashCol = new THREE.Color(0xffe066);
    dt = Math.min(dt, 0.05);
    for (let i = 0; i < MAXP; i++) {
      const q = this.p[i];
      if (i >= s.n) { m.makeScale(0, 0, 0); this.ball.setMatrixAt(i, m); continue; }
      // a slightly random path, at the speed of this temperature
      q.v.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(s.speed * 2 * dt)).setLength(s.speed * (0.6 + 0.8 * ((i * 0.618) % 1)));
      const prev = q.pos.clone();
      q.pos.addScaledVector(q.v, dt);
      if (q.pos.length() > 0.9) { q.pos.setLength(0.9); q.v.reflect(q.pos.clone().normalize()); }
      q.cool = Math.max(0, (q.cool ?? 0) - dt);
      // a hit on the solid: bounce; react if it had enough energy (faster particles, lower activation energy)
      const b = this.inSolid(q.pos);
      if (b) {
        q.pos.copy(prev);
        q.v.copy(prev).sub(new THREE.Vector3(b.x, b.y, b.z)).setLength(s.speed); // bounce away
      }
      if (b && !q.cool) {
        q.cool = 0.5; // (one hit, not a buzz of hits while it is touching)
        const ok = Math.random() < s.frac; // enough energy to react?
        this.hits.push([now, ok]);
        this.total.all++;
        if (ok) this.total.ok++;
        if (ok) {
          q.flash = 1;
          this.addBubble(q.pos);
        }
      }
      q.flash = Math.max(0, q.flash - dt * 2.5);
      c.copy(base).lerp(flashCol, q.flash);
      this.ball.setColorAt(i, c);
      m.makeScale(1 + q.flash, 1 + q.flash, 1 + q.flash).setPosition(q.pos);
      this.ball.setMatrixAt(i, m);
    }
    this.ball.instanceMatrix.needsUpdate = true;
    if (this.ball.instanceColor) this.ball.instanceColor.needsUpdate = true;
    // gas bubbles rise and leave
    for (const g of [...this.bubbles]) {
      g.position.y += dt * 0.35;
      g.scale.multiplyScalar(1 + dt * 0.4);
      if (g.position.y > 0.8) { this.inner.remove(g); this.bubbles.splice(this.bubbles.indexOf(g), 1); }
    }
    this.hits = this.hits.filter(([t]) => now - t < 3);
    this.clock = (this.clock ?? 0) + dt;
    if (this.clock > 0.5) { this.clock = 0; this.card.redraw(); }
  }

  addBubble(at) {
    if (this.bubbles.length > 40) return;
    const g = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
    g.position.copy(at).add(new THREE.Vector3(0, 0.04, 0));
    g.scale.setScalar(0.025);
    g.raycast = () => {};
    this.inner.add(g);
    this.bubbles.push(g);
  }

  drawCard(ui) {
    const src = this.source;
    const f = FACTORS[src.factor];
    const theirs = !!this.app.teacherCollisions;
    ui.y = 22;
    ui.text(theirs ? 'YOUR TEACHER’S REACTION' : 'COLLISIONS · ×10 MILLION', { size: 22, weight: 700, color: THEME.accent });
    const label = f.options.find(([id]) => id === src.opt)?.[1] ?? '';
    ui.text(`${f.name}: ${label}`, { size: 28, weight: 700 });
    const all = this.hits.length / 3, good = this.hits.filter(([, ok]) => ok).length / 3;
    ui.kv('Hits a second', all.toFixed(1), { size: 22 });
    ui.kv('Hits that react', good.toFixed(1), { size: 22, color: '#ffe066' });
    const why = {
      temperature: 'Hotter: the particles move faster, so they hit more often, and more hits have enough energy to react.',
      surface: 'Smaller pieces: more surface for the acid to hit, so more hits each second.',
      concentration: 'More concentrated: more acid particles in the same space, so more hits each second.',
      catalyst: src.opt === 'none' ? 'No catalyst: nothing for the peroxide to react on, so it breaks down only very slowly by itself.' : 'A catalyst gives an easier route: hits with less energy can react (a lower activation energy).',
    }[src.factor];
    ui.text(`Only hits with enough energy react (the yellow flashes). ${why}`, { size: 19, color: THEME.dim });
    if (theirs) return;
    ui.gap(4);
    ui.buttons(f.options.map(([id, l]) => ({ id: `col-${id}`, label: l, active: src.opt === id, onClick: () => this.choose(id) })), { cols: f.options.length > 3 ? 3 : f.options.length, height: 46, size: 18, gap: 8 });
  }
}
