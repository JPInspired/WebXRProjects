import * as THREE from 'three';
import { CanvasPanel, THEME } from '../../../../shared/ui/CanvasPanel.js';
import { CONCENTRATIONS, POTATO_C } from '../data/osmosis.js';
import { sound } from '../../../../shared/util/sound.js';

// Osmosis, magnified (see what the textbook only describes): a patch of the potato's surface. A cell membrane
// runs down the middle: the potato cell on the left, the soaking solution on the right.
//  • Water molecules (small, blue) pass through the membrane's tiny pores, both ways, all the time.
//  • Salt (on the right) and the cell's own sugars (on the left) are too big: they bounce off.
//  • The side with more water (the more dilute side) sends more water across than it gets back: that net flow
//    is osmosis. The card counts water crossing each way every second, and which way it goes overall.
//  • Pure water: net flow into the potato (it gains mass). Strong salt: out (it loses mass). At about
//    0.32 mol/dm³ (the potato's own concentration) the flow balances: where the class graph crosses zero.
// The numbers of each kind are kept steady, as the real solutions are far too big to change noticeably.
// The teacher can show everyone their bubble (Teacher menu › Osmosis).

const AT = new THREE.Vector3(-0.36, 0.12, -0.12); // the bubble, in lab space
const R = 0.16; // m
const WATER_MAX = 130;
const SOLUTE_MAX = 70;
const RW = 0.032, RS = 0.06; // particle sizes (unit space)

/** How many of each kind on each side for a solution of C mol/dm³ (left: the potato cell). */
function counts(C) {
  const water = (c) => Math.round(WATER_MAX * (1 - 0.55 * c)); // more solute, less room for water
  return { wL: water(POTATO_C), wR: water(C), sL: Math.round(POTATO_C * SOLUTE_MAX), sR: Math.round(C * SOLUTE_MAX) };
}

export class Membrane {
  constructor(app) {
    this.app = app;
    this.on = false;
    this.c = 0;
    this.group = new THREE.Group();
    this.group.position.copy(AT);
    this.group.visible = false;
    app.lab.add(this.group);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.12, roughness: 0.05, side: THREE.BackSide, depthWrite: false }));
    const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.005, 40, 24), new THREE.MeshBasicMaterial({ color: 0x9ec9ff, transparent: true, opacity: 0.18, wireframe: true, depthWrite: false }));
    glass.raycast = rim.raycast = () => {};
    this.group.add(glass, rim);
    this.inner = new THREE.Group();
    this.inner.scale.setScalar(R);
    this.group.add(this.inner);
    // the membrane: a thin see-through sheet with a pattern of pores, and a faint tint on the cell's side
    const pores = document.createElement('canvas');
    pores.width = pores.height = 128;
    const g = pores.getContext('2d');
    g.fillStyle = 'rgba(240, 200, 120, 0.55)';
    g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'destination-out';
    for (let y = 8; y < 128; y += 22) for (let x = (y / 22) % 2 ? 8 : 19; x < 128; x += 22) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
    const tex = new THREE.CanvasTexture(pores);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    const sheet = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    sheet.rotation.y = Math.PI / 2;
    sheet.raycast = () => {};
    this.inner.add(sheet);
    // particles: water (blue), the cell's sugars (yellow, left) and salt (purple, right)
    const mk = (r, colour, n) => {
      const m = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35 }), n);
      m.raycast = () => {};
      this.inner.add(m);
      return m;
    };
    this.waterMesh = mk(RW, 0x4da3ff, WATER_MAX * 2);
    this.sugarMesh = mk(RS, 0xf2c84b, SOLUTE_MAX);
    this.saltMesh = mk(RS, 0xb07cff, SOLUTE_MAX);
    this.water = [];
    this.sugar = [];
    this.salt = [];
    this.crossed = []; // [time, +1 into the cell | −1 out]
    this.card = new CanvasPanel({ width: 0.4, height: 0.42, name: 'membrane-card', fit: 0.15 });
    this.card.mesh.position.set(AT.x + 0.33, AT.y + 0.02, AT.z + 0.02);
    this.card.mesh.rotation.y = 0.12;
    this.card.mesh.visible = false;
    app.lab.add(this.card.mesh);
    app.panels.push(this.card);
    this.card.setBuilder((ui) => this.drawCard(ui));
  }

  /** Whose solution: mine, or the teacher's while they show everyone. */
  get source() {
    return this.app.teacherMembrane ?? { c: this.c };
  }

  setOn(on) {
    this.on = on;
    this.group.visible = on;
    this.card.mesh.visible = on;
    this.card.redraw();
  }

  choose(c) {
    this.c = c;
    sound.click();
    this.card.redraw();
  }

  /** A particle on one side (left: x < 0, the cell), somewhere in the bubble. */
  spawn(side) {
    const p = new THREE.Vector3();
    do p.set((0.08 + Math.random() * 0.8) * side, Math.random() * 1.7 - 0.85, Math.random() * 1.7 - 0.85);
    while (p.length() > 0.85);
    return { pos: p, v: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).setLength(0.35) };
  }

  build(c) {
    this.shownC = c;
    const n = counts(c);
    this.water = [...Array.from({ length: n.wL }, () => this.spawn(-1)), ...Array.from({ length: n.wR }, () => this.spawn(1))];
    this.sugar = Array.from({ length: n.sL }, () => this.spawn(-1));
    this.salt = Array.from({ length: n.sR }, () => this.spawn(1));
    this.target = n;
    this.crossed = [];
    this.total = { into: 0, out: 0 };
  }

  move(q, dt, speed, passes) {
    q.v.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(speed * 3 * dt)).setLength(speed);
    const before = q.pos.x;
    q.pos.addScaledVector(q.v, dt);
    if (q.pos.length() > 0.88) { q.pos.setLength(0.88); q.v.reflect(q.pos.clone().normalize()); }
    if (Math.sign(before) !== Math.sign(q.pos.x) && before !== 0) {
      if (!passes || Math.random() > 0.55) { q.pos.x = before; q.v.x = -q.v.x; return 0; } // bounced off (too big, or missed a pore)
      return q.pos.x < 0 ? 1 : -1; // water through a pore: +1 into the cell, −1 out
    }
    return 0;
  }

  update(dt) {
    if (!this.on) return;
    const c = this.source.c;
    if (c !== this.shownC) this.build(c);
    dt = Math.min(dt, 0.05);
    const now = performance.now() / 1000;
    for (const q of this.water) {
      const d = this.move(q, dt, 0.4, true);
      if (d) { this.crossed.push([now, d]); if (d > 0) this.total.into++; else this.total.out++; }
    }
    for (const q of [...this.sugar, ...this.salt]) this.move(q, dt, 0.18, false);
    // keep each side's water steady (the real solutions are far too big to change): a molecule that crossed
    // reappears on the side it left, away from the membrane
    const left = this.water.filter((q) => q.pos.x < 0);
    const right = this.water.filter((q) => q.pos.x >= 0);
    const fix = (from, side) => { const q = from[Math.floor(Math.random() * from.length)]; if (q) Object.assign(q, this.spawn(side)); };
    if (left.length > this.target.wL + 2) fix(left.filter((q) => q.pos.x > -0.25), 1);
    if (right.length > this.target.wR + 2) fix(right.filter((q) => q.pos.x < 0.25), -1);
    // draw
    const m = new THREE.Matrix4();
    const draw = (mesh, list, max) => {
      for (let i = 0; i < max; i++) {
        if (i < list.length) m.makeTranslation(list[i].pos.x, list[i].pos.y, list[i].pos.z);
        else m.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    draw(this.waterMesh, this.water, WATER_MAX * 2);
    draw(this.sugarMesh, this.sugar, SOLUTE_MAX);
    draw(this.saltMesh, this.salt, SOLUTE_MAX);
    this.crossed = this.crossed.filter(([t]) => now - t < 4);
    this.clock = (this.clock ?? 0) + dt;
    if (this.clock > 0.5) { this.clock = 0; this.card.redraw(); }
  }

  drawCard(ui) {
    const c = this.source.c;
    const theirs = !!this.app.teacherMembrane;
    ui.y = 22;
    ui.text(theirs ? 'YOUR TEACHER’S POTATO' : 'THE POTATO’S MEMBRANE · ×10 MILLION', { size: 22, weight: 700, color: THEME.accent });
    ui.text(c === 0 ? 'In pure water' : `In ${c} mol/dm³ salt`, { size: 28, weight: 700 });
    const into = this.crossed.filter(([, d]) => d > 0).length / 4, out = this.crossed.filter(([, d]) => d < 0).length / 4;
    ui.kv('Water into the cell', `${into.toFixed(1)} a second`, { size: 21 });
    ui.kv('Water out of the cell', `${out.toFixed(1)} a second`, { size: 21 });
    const net = c < POTATO_C - 0.05 ? 'into the potato: it gains mass' : c > POTATO_C + 0.05 ? 'out of the potato: it loses mass' : 'about balanced: no change in mass';
    ui.text(`Overall: ${net}`, { size: 22, weight: 700, color: c < POTATO_C - 0.05 ? '#7ee2a8' : c > POTATO_C + 0.05 ? '#ff9a8a' : '#ffd166' });
    ui.text('Water (blue) passes through the membrane both ways; salt (purple) and the cell’s sugars (yellow) are too big. More water crosses from the side that has more of it.', { size: 18, color: THEME.dim });
    if (theirs) return;
    ui.gap(4);
    ui.buttons(CONCENTRATIONS.map((v) => ({ id: `mem-${v}`, label: v === 0 ? 'Pure Water' : `${v} M`, active: c === v, onClick: () => this.choose(v) })), { cols: 3, height: 46, size: 18, gap: 8 });
  }
}
