import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { METALS, METAL_IDS, ELECTROLYTES, ELECTROLYTE_IDS, METER_R, cellEMF } from '../data/voltaic.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeBeaker, reagentBottle, benchTop, metalMaterial, liquidMaterial } from '../../../../shared/lab/kit.js';

// The bench.
//   Core: four beakers. Drag two metal strips from the tray into a beaker (one on each side) and pour an
//   electrolyte from a bottle (drag the bottle over the beaker).
//   Advanced: two cells, each two beakers. Drag a metal strip into each beaker: the beaker fills with a
//   solution of that metal's own ions (copper sulfate is blue). Then lay a salt bridge across from its holder.
// The multimeter's leads go to the cell you choose (tap a beaker), black to the left strip and red to the
// right, or to the two ends of the chain when the cells are linked in series. Volts at Core; volts or
// milliamps (with the ammeter in the circuit) at Advanced.
// Running a cell down (time-lapse) wears away its negative strip, builds a coating on the positive strip and,
// for copper sulfate, fades the blue.

export const TOP = -0.3;
const BACK_Z = -0.1;
const TRAY = new THREE.Vector3(-0.42, TOP, 0.15);
const BOTTLES = new THREE.Vector3(-0.07, TOP, 0.15);
const BRIDGES = new THREE.Vector3(0.0, TOP, 0.13);
const METER = new THREE.Vector3(0.33, TOP, 0.15);
const STRIP = { w: 0.012, h: 0.11, d: 0.0025 };
const STRIP_DEPTH = 0.07; // how far it sits in the liquid
const SNAP = 0.06;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, envMapIntensity: 0.6, ...o });

/** An empty glass beaker from the lab kit (this lesson adds its own liquid). */
function glassBeaker(r, h) {
  const b = makeBeaker(r, h, 0xffffff, 0.1);
  b.userData.liquid.visible = false;
  return b;
}
const glass = new THREE.MeshStandardMaterial({ color: 0xd8eeff, transparent: true, opacity: 0.25, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false });

function canvasTex(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t, x: c.getContext('2d') };
}

function makeStrip(metal) {
  const g = new THREE.Group();
  const m = METALS[metal];
  const body = new THREE.Mesh(new RoundedBoxGeometry(STRIP.w, STRIP.h, STRIP.d, 1, 0.0008), metalMaterial(metal, m.color).clone()); // its own copy: it darkens as the cell runs down
  body.material.userData.base = body.material.color.getHex();
  const coat = new THREE.Mesh(new THREE.BoxGeometry(STRIP.w * 1.12, STRIP_DEPTH, STRIP.d * 2.2), mat(0xb8633a, { metalness: 0.4, roughness: 0.8 }));
  coat.position.y = -STRIP.h / 2 + STRIP_DEPTH / 2;
  coat.visible = false;
  const tag = makeLabel(m.sym, { height: 0.011, size: 40 });
  tag.position.y = STRIP.h / 2 + 0.012;
  g.add(body, coat, tag);
  g.userData = { body, coat, tag };
  return g;
}

/** A cable between two points, sagging a little. */
function cable(color) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat(color, { roughness: 0.6 }));
  mesh.userData.set = (a, b) => {
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.max(a.y, b.y) + 0.04 + a.distanceTo(b) * 0.08;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(mid.y), mid, b.clone().lerp(mid, 0.5).setY(mid.y), b]), 24, 0.0018, 6, false);
  };
  return mesh;
}

export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.level = 'core';
    this.series = false;
    this.mode = 'V'; // 'V' | 'A'
    this.selected = 0;
    this.tmp = new THREE.Vector3();

    const top = benchTop(0.92, 0.5, { color: 0x2a3140 });
    top.position.set(0, TOP, 0.02);
    this.group.add(top);

    // ── cell stations: core (4 single beakers) and advanced (2 pairs) ──
    this.coreCells = [-0.33, -0.11, 0.11, 0.33].map((x, i) => this.makeCoreCell(x, i));
    this.advCells = [-0.27, 0.27].map((x, i) => this.makeAdvCell(x, i));

    // ── metal tray ──
    const tray = new THREE.Mesh(new RoundedBoxGeometry(0.33, 0.008, 0.07, 2, 0.003), mat(0x4a5266, { roughness: 0.7 }));
    tray.position.set(TRAY.x + 0.13, TOP + 0.004, TRAY.z);
    this.group.add(tray);
    this.tray = tray;
    this.trayStrips = METAL_IDS.map((id, i) => {
      const s = makeStrip(id);
      s.rotation.x = -Math.PI / 2;
      s.position.set(TRAY.x + 0.005 + i * 0.05, TOP + 0.011, TRAY.z);
      s.userData.tag.rotation.x = Math.PI / 2 - 0.9;
      s.userData.tag.position.set(0, STRIP.h / 2 + 0.008, 0.012);
      s.userData.body.userData = { handler: this, tray: id };
      this.group.add(s);
      return s;
    });
    const tTag = makeLabel('Metal strips: drag one into a beaker', { height: 0.011, size: 34 });
    tTag.position.set(TRAY.x + 0.13, TOP + 0.03, TRAY.z + 0.05);
    this.group.add(tTag);
    this.trayTag = tTag;

    // ── electrolyte bottles (core) ──
    this.bottles = ELECTROLYTE_IDS.map((id, i) => {
      const e = ELECTROLYTES[id];
      const g = new THREE.Group();
      const bottle = reagentBottle({ r: 0.014, h: 0.06, liquid: e.color, cap: 0x2a6bd8, label: e.short });
      const tag = makeLabel(e.short, { height: 0.009, size: 34 });
      tag.position.y = 0.083;
      g.add(bottle, tag);
      const picks = [];
      bottle.traverse((m) => { if (m.isMesh) picks.push(m); });
      g.position.set(BOTTLES.x + i * 0.04, TOP, BOTTLES.z + (i % 2) * 0.03);
      g.userData.home = g.position.clone();
      for (const m of picks) m.userData = { handler: this, bottle: id };
      this.group.add(g);
      return { id, group: g, picks };
    });

    // ── salt bridges (advanced): a strip of filter paper soaked in potassium nitrate, bent into a U ──
    this.bridges = [0, 1].map((i) => {
      const g = new THREE.Group();
      const paper = mat(0xf3efe2, { roughness: 0.95 });
      const across = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.004, 0.014), paper);
      across.position.y = 0.06;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.06, 0.014), paper);
      legL.position.set(-0.053, 0.03, 0);
      const legR = legL.clone();
      legR.position.x = 0.053;
      g.add(across, legL, legR);
      for (const m of [across, legL, legR]) m.userData = { handler: this, bridge: i };
      g.userData.home = new THREE.Vector3(BRIDGES.x - 0.065 + i * 0.13, TOP + 0.004, BRIDGES.z - 0.03);
      this.group.add(g);
      return { group: g, picks: [across, legL, legR], on: null };
    });
    for (const b of this.bridges) this.placeBridge(b);
    this.bridgeTag = makeLabel('Salt bridges (KNO₃)', { height: 0.011, size: 34 });
    this.bridgeTag.position.set(BRIDGES.x, TOP + 0.03, BRIDGES.z + 0.04);
    this.group.add(this.bridgeTag);

    // ── multimeter ──
    this.meter = new THREE.Group();
    this.meter.position.copy(METER);
    const mbody = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.03, 0.15, 4, 0.01), mat(0xf2b230, { roughness: 0.75 })); // the rubber holster
    mbody.position.y = 0.015;
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.004, 0.13, 2, 0.003), mat(0x2b2f3a, { roughness: 0.5 }));
    panel.position.set(0, 0.0305, 0);
    this.meter.add(panel);
    for (const [sx, col] of [[-0.03, 0x15171c], [0, 0xd42a2a], [0.03, 0xd42a2a]]) {
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 16), mat(col, { roughness: 0.4 }));
      sock.position.set(sx, 0.033, 0.06);
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0045, 12), mat(0x050506));
      hole.position.copy(sock.position);
      this.meter.add(sock, hole);
    }
    this.screen = canvasTex(320, 150);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.047), new THREE.MeshBasicMaterial({ map: this.screen.t, toneMapped: false }));
    face.rotation.x = -Math.PI / 2 + 0.35;
    face.position.set(0, 0.04, -0.03);
    this.modeBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.019, 0.008, 32), mat(0x3a3f4a, { roughness: 0.45 })); // the dial
    const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.014), mat(0xf2f2f2));
    pointer.position.set(0, 0.0045, -0.008);
    this.modeBtn.add(pointer);
    this.modeBtn.position.set(0, 0.033, 0.035);
    this.modeBtn.userData = { handler: this, meterMode: true, tapOnly: true };
    const modeTag = makeLabel('V / mA', { height: 0.009, size: 32 });
    modeTag.position.set(0, 0.05, 0.06);
    this.modeTag = modeTag;
    this.meter.add(mbody, face, this.modeBtn, modeTag);
    this.group.add(this.meter);
    this.leadBlack = cable(0x1a1a1a);
    this.leadRed = cable(0xd42a2a);
    this.links = [0, 1, 2].map(() => cable(0x2a64d4));
    this.group.add(this.leadBlack, this.leadRed, ...this.links);

    this.setLevel('core');
    this.drawScreen();
  }

  // ───────────── building the stations ─────────────

  makeCoreCell(x, i) {
    const g = new THREE.Group();
    g.position.set(x, TOP, BACK_Z);
    const r = 0.042;
    const h = 0.09;
    const wall = glassBeaker(r, h);
    const base = new THREE.Group();
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.92, 0.065, 28), liquidMaterial(0xffffff, 0.55));
    liquid.position.y = 0.0335;
    liquid.visible = false;
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = h / 2;
    pick.userData = { handler: this, cell: i, tapOnly: false };
    const num = makeLabel(`Cell ${i + 1}`, { height: 0.012, size: 36 });
    num.position.set(0, -0.0, r + 0.02);
    num.position.y = 0.012;
    const sel = new THREE.Mesh(new THREE.RingGeometry(r + 0.004, r + 0.01, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    sel.position.y = 0.002;
    g.add(wall, base, liquid, pick, num, sel);
    this.group.add(g);
    // strip slots: left (black lead) and right (red lead)
    const slots = [-0.02, 0.02].map((dx) => new THREE.Vector3(x + dx, TOP + 0.075 - STRIP_DEPTH / 2 + STRIP.h / 2 - 0.035, BACK_Z));
    return { i, kind: 'core', group: g, liquid, pick, sel, num, slots, left: null, right: null, strips: [null, null], electrolyte: null, wear: 0, cuFade: 0, curve: [] };
  }

  makeAdvCell(x, i) {
    const g = new THREE.Group();
    g.position.set(x, TOP, BACK_Z);
    const beakers = [-0.075, 0.075].map((dx) => {
      const b = new THREE.Group();
      b.position.x = dx;
      const r = 0.038;
      const h = 0.085;
      const wall = glassBeaker(r, h);
      const base = new THREE.Group();
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.92, 0.06, 28), liquidMaterial(0xffffff, 0.6));
      liquid.position.y = 0.031;
      liquid.visible = false;
      const tag = makeLabel(' ', { height: 0.01, size: 32 });
      tag.position.set(0, 0.012, r + 0.02);
      b.add(wall, base, liquid);
      g.add(b);
      return { group: b, liquid, tag, x: x + dx };
    });
    const pick = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.08), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = 0.045;
    pick.userData = { handler: this, cell: i };
    const num = makeLabel(`Cell ${i + 1}`, { height: 0.012, size: 36 });
    num.position.set(0, 0.012, 0.062);
    const sel = new THREE.Mesh(new THREE.RingGeometry(0.125, 0.132, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    sel.scale.z = 0.45;
    sel.position.y = 0.002;
    g.add(pick, num, sel);
    for (const b of beakers) this.group.add(b.tag);
    this.group.add(g);
    const slots = beakers.map((b) => new THREE.Vector3(b.x, TOP + 0.075 - STRIP_DEPTH / 2 + STRIP.h / 2 - 0.035, BACK_Z));
    return { i, kind: 'adv', group: g, beakers, pick, sel, num, slots, left: null, right: null, strips: [null, null], bridge: false, wear: 0, cuFade: 0, curve: [] };
  }

  get cells() {
    return this.level === 'advanced' ? this.advCells : this.coreCells;
  }

  get cell() {
    return this.cells[this.selected] ?? this.cells[0];
  }

  setLevel(level) {
    this.level = level;
    for (const c of this.coreCells) c.group.visible = level === 'core';
    for (const c of this.advCells) {
      c.group.visible = level === 'advanced';
      for (const b of c.beakers) b.tag.visible = level === 'advanced' && !!b.tag.userData.text;
    }
    for (const c of [...this.coreCells, ...this.advCells]) for (const s of c.strips) if (s) s.visible = c.group.visible;
    for (const b of this.bottles) b.group.visible = level === 'core';
    for (const b of this.bridges) b.group.visible = level === 'advanced';
    this.bridgeTag.visible = level === 'advanced';
    this.modeBtn.visible = level === 'advanced';
    this.modeTag.visible = level === 'advanced';
    if (level === 'core') this.mode = 'V';
    this.selected = Math.min(this.selected, this.cells.length - 1);
    this.refreshAll();
  }

  /** The front of the bench (tray, bottles, bridges in their holder, the meter): hidden for the real batteries. */
  setFront(on) {
    this.front = on;
    for (const s of this.trayStrips) s.visible = on;
    this.tray.visible = on;
    this.trayTag.visible = on;
    for (const b of this.bottles) b.group.visible = on && this.level === 'core';
    for (const b of this.bridges) if (b.on == null) b.group.visible = on && this.level === 'advanced';
    this.bridgeTag.visible = on && this.level === 'advanced';
    this.meter.visible = on;
    this.leadBlack.visible = on;
    this.leadRed.visible = on;
    if (!on) for (const l of this.links) l.visible = false;
    else this.layoutWires();
  }

  // ───────────── changing a cell ─────────────

  setStrip(cell, side, metal) {
    const k = side === 'left' ? 0 : 1;
    if (cell.strips[k]) {
      cell.strips[k].removeFromParent();
      cell.strips[k] = null;
    }
    cell[side] = metal;
    cell.wear = 0;
    cell.cuFade = 0;
    cell.curve = [];
    if (metal) {
      const s = makeStrip(metal);
      s.position.copy(cell.slots[k]);
      s.userData.body.userData = { handler: this, placed: { cell: cell.i, side } };
      this.group.add(s);
      cell.strips[k] = s;
    }
    if (cell.kind === 'adv') this.fillHalfCell(cell, k);
    this.refreshCell(cell);
  }

  fillHalfCell(cell, k) {
    const b = cell.beakers[k];
    const metal = k === 0 ? cell.left : cell.right;
    b.liquid.visible = !!metal;
    if (metal) b.liquid.material.color.setHex(METALS[metal].solColor);
    const text = metal ? `${METALS[metal].solution}` : '';
    b.tag.userData.text = text;
    b.group.remove(b.tag);
    b.tag.removeFromParent();
    const fresh = makeLabel(text || ' ', { height: 0.009, size: 30 });
    fresh.position.set(b.x, TOP + 0.012, BACK_Z + 0.06);
    fresh.userData.text = text;
    fresh.visible = !!text && this.level === 'advanced';
    this.group.add(fresh);
    b.tag = fresh;
  }

  setElectrolyte(cell, id) {
    cell.electrolyte = id;
    cell.wear = 0;
    cell.cuFade = 0;
    cell.curve = [];
    cell.liquid.visible = !!id;
    if (id) cell.liquid.material.color.setHex(ELECTROLYTES[id].color);
    this.refreshCell(cell);
  }

  /** Lay a salt bridge across a cell (the given one, or any free one), or take it off. */
  setBridge(cell, on, index = null) {
    if (on) {
      const b = index != null ? this.bridges[index] : this.bridges.find((x) => x.on == null);
      if (!b) return;
      b.on = cell.i;
      cell.bridge = true;
      this.placeBridge(b);
    } else {
      const b = this.bridges.find((x) => x.on === cell.i);
      if (b) {
        b.on = null;
        this.placeBridge(b);
      }
      cell.bridge = false;
    }
    this.refreshCell(cell);
  }

  placeBridge(b) {
    if (b.on != null) {
      b.group.position.set(this.advCells[b.on].group.position.x, TOP + 0.045, BACK_Z);
      b.group.rotation.set(0, 0, 0);
    } else {
      b.group.position.copy(b.group.userData.home);
      b.group.rotation.set(-Math.PI / 2, 0, 0); // lying flat in its holder
    }
  }

  empty(cell) {
    this.setStrip(cell, 'left', null);
    this.setStrip(cell, 'right', null);
    if (cell.kind === 'core') this.setElectrolyte(cell, null);
    else this.setBridge(cell, false);
  }

  /** Fresh strips and solution (after running down). */
  renew(cell) {
    cell.wear = 0;
    cell.cuFade = 0;
    cell.curve = [];
    this.refreshCell(cell);
  }

  select(i) {
    this.selected = i;
    this.refreshAll();
  }

  refreshAll() {
    for (const c of this.cells) this.refreshCell(c);
    this.layoutWires();
  }

  refreshCell(cell) {
    cell.sel.visible = cell.i === this.selected && !this.series;
    // wear: the negative strip thins, the positive one gets a coating, copper sulfate fades
    const emf = cellEMF(cell, this.level, cell.wear);
    const negK = emf && emf.V < 0 ? 1 : 0; // index of the negative strip
    cell.strips.forEach((s, k) => {
      if (!s) return;
      const w = cell.wear;
      const neg = k === negK && emf;
      s.userData.body.scale.set(neg ? 1 - 0.55 * w : 1, 1, neg ? 1 - 0.5 * w : 1);
      s.userData.body.material.color.setHex(s.userData.body.material.userData.base).multiplyScalar(neg ? 1 - 0.35 * w : 1);
      const other = k === 0 ? cell.right : cell.left;
      const coatMetal = this.level === 'advanced' ? (k === 0 ? cell.left : cell.right) : null;
      s.userData.coat.visible = !neg && emf && w > 0.05 && this.level === 'advanced';
      if (s.userData.coat.visible) {
        s.userData.coat.material.color.setHex(METALS[coatMetal].color);
        s.userData.coat.scale.set(1, 1, 0.6 + w);
      }
      void other;
    });
    if (cell.kind === 'adv') {
      cell.beakers.forEach((b, k) => {
        const metal = k === 0 ? cell.left : cell.right;
        if (!metal) return;
        const c = new THREE.Color(METALS[metal].solColor);
        const pos = emf && (emf.V > 0 ? 1 : 0) === k;
        if (pos && metal === 'cu') c.lerp(new THREE.Color(0xeef3f8), Math.min(1, cell.wear * 1.1));
        b.liquid.material.color.copy(c);
      });
    }
    this.layoutWires();
  }

  // ───────────── the circuit ─────────────

  terminal(cell, k) {
    return cell.slots[k].clone().add(new THREE.Vector3(0, STRIP.h / 2 + 0.002, 0));
  }

  /** The cells in the circuit: the selected one, or (in series) every cell with both strips, in order. */
  chain() {
    if (!this.series) return [this.cell];
    return this.cells.filter((c) => c.left || c.right);
  }

  layoutWires() {
    const chain = this.chain();
    const meterBlack = this.meter.position.clone().add(new THREE.Vector3(-0.035, 0.03, -0.07));
    const meterRed = this.meter.position.clone().add(new THREE.Vector3(0.035, 0.03, -0.07));
    const first = chain[0];
    const last = chain.at(-1);
    this.leadBlack.userData.set(meterBlack, first ? this.terminal(first, 0) : meterBlack.clone().add(new THREE.Vector3(-0.05, 0, -0.05)));
    this.leadRed.userData.set(meterRed, last ? this.terminal(last, 1) : meterRed.clone().add(new THREE.Vector3(0.05, 0, -0.05)));
    this.links.forEach((l, i) => {
      const on = this.series && i < chain.length - 1;
      l.visible = on;
      if (on) l.userData.set(this.terminal(chain[i], 1), this.terminal(chain[i + 1], 0));
    });
  }

  /**
   * What the meter reads: { V, I (A), ok, why } for the chain. Voltmeter: the sum of the EMFs (a cell
   * connected the wrong way round subtracts). Ammeter: the current through the meter.
   */
  reading() {
    const chain = this.chain();
    if (!chain.length) return { ok: false, why: 'No cell yet: put two metal strips in a beaker.' };
    let V = 0;
    let R = 0;
    for (const c of chain) {
      const e = cellEMF(c, this.level, c.wear);
      if (!e) {
        const n = c.i + 1;
        if (!c.left || !c.right) return { ok: false, why: `Cell ${n} needs two metal strips.`, V: 0, I: 0 };
        return { ok: false, why: `Cell ${n} has no electrolyte yet: pour one in.`, V: 0, I: 0 };
      }
      if (e.open) return { ok: false, open: true, why: `Cell ${c.i + 1} has no salt bridge: the circuit isn't complete, so nothing flows.`, V: 0, I: 0 };
      V += e.V;
      R += e.R;
    }
    const Vm = V * (1e7 / (1e7 + R)); // the voltmeter draws (almost) nothing
    const I = V / (R + METER_R);
    return { ok: true, V: Vm, I, R, n: chain.length };
  }

  drawScreen() {
    const { x, c, t } = this.screen;
    x.fillStyle = '#a9b9a0';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#1d2a1d';
    x.textBaseline = 'middle';
    const r = this.reading();
    x.font = '700 22px system-ui, sans-serif';
    x.fillText(this.mode === 'V' ? 'DC VOLTS' : 'DC mA', 14, 22);
    if (this.series) x.fillText(`SERIES ×${r.n ?? 0}`, 190, 22);
    x.font = '700 72px ui-monospace, monospace';
    let text = '0.00';
    if (r.ok) text = this.mode === 'V' ? r.V.toFixed(2) : (r.I * 1000).toFixed(r.I * 1000 < 10 ? 2 : 1);
    x.textAlign = 'right';
    x.fillText(text, c.width - 18, 92);
    x.textAlign = 'left';
    t.needsUpdate = true;
  }

  // ───────────── grabbing ─────────────

  get targets() {
    const t = [];
    for (const s of this.trayStrips) t.push(s.userData.body);
    for (const c of this.cells) {
      t.push(c.pick);
      for (const s of c.strips) if (s) t.push(s.userData.body);
    }
    if (this.level === 'core') for (const b of this.bottles) t.push(...b.picks);
    else for (const b of this.bridges) t.push(...b.picks);
    if (this.level === 'advanced') t.push(this.modeBtn);
    return t;
  }

  describe(o) {
    const u = o.userData;
    if (u.tray) return `${METALS[u.tray].name} strip · drag it into a beaker`;
    if (u.placed) return `${METALS[this.cells[u.placed.cell][u.placed.side]].name} strip · drag it out to remove it`;
    if (u.bottle) return `${ELECTROLYTES[u.bottle].name} · drag it over a beaker to pour`;
    if (u.bridge != null) return this.bridges[u.bridge].on != null ? 'Salt bridge · drag it off to remove it' : 'Salt bridge · drag it across a pair of beakers';
    if (u.meterMode) return 'Switch between volts and milliamps';
    return `Cell ${u.cell + 1} · tap to measure it`;
  }

  tap(o) {
    const u = o.userData;
    if (u.meterMode) this.app.toggleMeterMode();
    else if (u.cell != null) this.app.selectCell(u.cell);
  }

  /** On a screen: distance across the screen at b's depth (m); in a headset: real distance. */
  dist(a, b) {
    if (this.app.presenting) return a.distanceTo(b);
    const cam = this.app.camera;
    const pa = a.clone().project(cam);
    const pb = b.clone().project(cam);
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.position.distanceTo(b);
    return (Math.hypot((pa.x - pb.x) * cam.aspect, pa.y - pb.y) * h) / 2;
  }

  world(v) {
    return this.group.localToWorld(v.clone());
  }

  /** The nearest free (or any) strip slot to a world point. */
  nearestSlot(w) {
    let best = null;
    for (const c of this.cells) {
      c.slots.forEach((s, k) => {
        const d = this.dist(w, this.world(s));
        if (d < SNAP && (!best || d < best.d)) best = { c, side: k === 0 ? 'left' : 'right', d };
      });
    }
    return best;
  }

  nearestCell(w, r = 0.08) {
    let best = null;
    for (const c of this.cells) {
      const d = this.dist(w, this.world(c.group.position.clone().add(new THREE.Vector3(0, 0.05, 0))));
      if (d < r && (!best || d < best.d)) best = { c, d };
    }
    return best;
  }

  follow(obj, world) {
    const off = obj.position.clone().sub(this.group.worldToLocal(world.clone()));
    return (w) => obj.position.copy(this.group.worldToLocal(w.clone())).add(off);
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.tapOnly || u.cell != null) return null;
    if (u.tray || u.placed) {
      let metal = u.tray;
      if (u.placed) {
        const c = this.cells[u.placed.cell];
        metal = c[u.placed.side];
        this.setStrip(c, u.placed.side, null);
      }
      const s = makeStrip(metal);
      s.position.copy(this.group.worldToLocal(world.clone()));
      this.group.add(s);
      const move = this.follow(s, world);
      return {
        move,
        release: () => {
          const w = s.getWorldPosition(new THREE.Vector3());
          s.removeFromParent();
          const slot = this.nearestSlot(w);
          if (slot) {
            this.setStrip(slot.c, slot.side, metal);
            this.app.onStrip(slot.c, slot.side, metal);
          }
          this.app.refresh();
        },
      };
    }
    if (u.bottle) {
      const b = this.bottles.find((x) => x.id === u.bottle);
      const move = this.follow(b.group, world);
      return {
        move: (w) => {
          move(w);
          b.group.rotation.z = this.nearestCell(b.group.getWorldPosition(new THREE.Vector3()), 0.1) ? 1.9 : 0;
        },
        release: () => {
          const hit = this.nearestCell(b.group.getWorldPosition(new THREE.Vector3()), 0.1);
          b.group.position.copy(b.group.userData.home);
          b.group.rotation.z = 0;
          if (hit) {
            this.setElectrolyte(hit.c, b.id);
            this.app.onPoured(hit.c, b.id);
          }
        },
      };
    }
    if (u.bridge != null) {
      const br = this.bridges[u.bridge];
      if (br.on != null) this.setBridge(this.advCells[br.on], false);
      br.group.rotation.set(0, 0, 0);
      const move = this.follow(br.group, world);
      return {
        move,
        release: () => {
          const hit = this.nearestCell(br.group.getWorldPosition(new THREE.Vector3()), 0.12);
          if (hit && !hit.c.bridge) {
            this.setBridge(hit.c, true, u.bridge);
            this.app.onBridge(hit.c);
          } else this.placeBridge(br);
        },
      };
    }
    return null;
  }

  // ───────────── every frame ─────────────

  update(dt) {
    this.redraw = (this.redraw ?? 0) + dt;
    if (this.redraw > 0.15) {
      this.redraw = 0;
      this.drawScreen();
    }
  }
}
