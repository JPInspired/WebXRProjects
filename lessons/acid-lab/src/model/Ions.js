import * as THREE from 'three';
import { CanvasPanel, THEME } from '../../../../shared/ui/CanvasPanel.js';
import { SUBSTANCES } from '../data/acid.js';
import { sound } from '../../../../shared/util/sound.js';

// Inside a solution (see what the textbook only describes): a magnified bubble of solution with its ions as
// dots. Red: hydrogen ions (H⁺, what makes it acidic). Blue: hydroxide ions (OH⁻, what makes it alkaline).
//  • The pH scale is about how many there are: at pH 7 one of each, and every step down is TEN TIMES more
//    hydrogen ions (pH 6: 10, pH 5: 100, pH 4: 1,000, pH 3: 10,000). Every step up is ten times more hydroxide.
//    Below pH 3 (or above 11) there are too many to draw: the bubble is packed, and the card says how many.
//  • Add a drop of alkali: blue ions pour in, each pairs with a red one and both disappear (H⁺ + OH⁻ → H₂O:
//    neutralisation), and the pH goes up one step. Add a drop of acid: the other way round.
//  • The mystery beakers are never shown (that would give their answers away): this is its own pH dial, with
//    everyday solutions to pick from.
// The teacher can show everyone their own dial (Teacher menu › Inside a solution).

const MAX = 20000; // most dots of one kind drawn
const AT = new THREE.Vector3(-0.36, 0.1, -0.12); // the bubble, in lab space (above the left of the bench)
const R = 0.16; // m
const PRESETS = [['lemon', 'Lemon Juice'], ['water', 'Pure Water'], ['soap', 'Soapy Water'], ['bleach', 'Bleach']];
const MOVE_S = 1.6; // how long a change takes to happen

const count = (ph) => Math.round(10 ** (7 - ph));

/** Round dots that jiggle on the graphics card (cheap enough for tens of thousands on a headset). */
function dots(color) {
  const pos = new Float32Array(MAX * 3);
  const seed = new Float32Array(MAX);
  const v = new THREE.Vector3();
  for (let i = 0; i < MAX; i++) {
    do v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    while (v.lengthSq() > 0.92);
    pos.set([v.x, v.y, v.z], i * 3);
    seed[i] = Math.random() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  g.setDrawRange(0, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(color) }, size: { value: 0.05 }, scale: { value: 600 } },
    vertexShader: `
      attribute float seed; uniform float time; uniform float size; uniform float scale;
      void main() {
        vec3 p = position + 0.035 * vec3(sin(time * 1.7 + seed), sin(time * 1.3 + seed * 1.7), sin(time * 1.1 + seed * 2.3));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * scale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        gl_FragColor = vec4(mix(color * 1.25, color * 0.7, d * 2.0), 1.0);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.raycast = () => {};
  return pts;
}

export class Ions {
  constructor(app) {
    this.app = app;
    this.on = false;
    this.ph = 7;
    this.shown = { h: count(7), oh: count(14 - 7) }; // what is drawn now (eases towards the target)
    this.group = new THREE.Group();
    this.group.position.copy(AT);
    this.group.visible = false;
    app.lab.add(this.group);
    // the bubble of solution
    const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.12, roughness: 0.05, side: THREE.BackSide, depthWrite: false }));
    const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.005, 40, 24), new THREE.MeshBasicMaterial({ color: 0x9ec9ff, transparent: true, opacity: 0.18, wireframe: true, depthWrite: false }));
    glass.raycast = rim.raycast = () => {};
    this.group.add(glass, rim);
    this.h = dots(0xff4d4d);
    this.oh = dots(0x4d8dff);
    for (const p of [this.h, this.oh]) { p.scale.setScalar(R); this.group.add(p); }
    // a burst of the other kind pouring in when a drop is added, and white flashes where pairs meet
    this.pour = dots(0xffffff);
    this.pour.scale.setScalar(R);
    this.group.add(this.pour);
    this.t = MOVE_S;
    // the card beside it: what you are looking at, and the pH dial
    this.card = new CanvasPanel({ width: 0.4, height: 0.42, name: 'ions-card', fit: 0.15 });
    this.card.mesh.position.set(AT.x + 0.33, AT.y + 0.02, AT.z + 0.02);
    this.card.mesh.rotation.y = 0.12;
    this.card.mesh.visible = false;
    app.lab.add(this.card.mesh);
    app.panels.push(this.card);
    this.card.setBuilder((ui) => this.drawCard(ui));
    this.apply(true);
  }

  /** Whose dial: mine, or the teacher's while they show everyone. */
  get source() {
    return this.app.teacherIons ?? this;
  }

  setOn(on) {
    this.on = on;
    this.group.visible = on;
    this.card.mesh.visible = on;
    this.card.redraw();
  }

  /** Change the pH (0 to 14); drop: 'alkali' | 'acid' | null (how it happened, for the animation). */
  setPH(ph, drop = null) {
    this.ph = Math.max(0, Math.min(14, Math.round(ph * 10) / 10));
    this.drop = drop;
    this.t = 0;
    if (drop) sound.bond();
    this.card.redraw();
  }

  apply(now = false) {
    const ph = this.source.ph;
    this.target = { h: count(ph), oh: count(14 - ph) };
    if (now) this.shown = { ...this.target };
  }

  update(dt) {
    if (!this.on) return;
    const src = this.source;
    if (src !== this && (src.ph !== this.lastPh)) { this.drop = src.drop; this.t = 0; }
    this.lastPh = src.ph;
    this.apply();
    const time = performance.now() / 1000;
    for (const p of [this.h, this.oh, this.pour]) p.material.uniforms.time.value = time;
    // ease the counts towards the new pH (on a log scale, so every step of ten takes the same time)
    this.t = Math.min(MOVE_S, this.t + dt);
    const k = Math.min(1, dt * 3);
    for (const key of ['h', 'oh']) {
      const a = Math.log10(this.shown[key] + 1), b = Math.log10(this.target[key] + 1);
      this.shown[key] = Math.abs(b - a) < 0.01 ? this.target[key] : 10 ** (a + (b - a) * k) - 1;
    }
    this.h.geometry.setDrawRange(0, Math.min(MAX, Math.round(this.shown.h)));
    this.oh.geometry.setDrawRange(0, Math.min(MAX, Math.round(this.shown.oh)));
    // dot size: one ion is a clear dot; ten thousand stay small enough to see as a crowd. Sized by the screen's
    // (or headset's) real pixel height, so they look the same everywhere.
    const px = (this.app.renderer.xr.isPresenting ? 1800 : this.app.renderer.domElement.height) * 0.5;
    for (const [p, n] of [[this.h, this.shown.h], [this.oh, this.shown.oh], [this.pour, 400]]) {
      p.material.uniforms.size.value = 0.05 / Math.max(1, Math.cbrt(Math.min(MAX, n) / 6));
      p.material.uniforms.scale.value = px;
    }
    // a drop going in: a short burst of the added ions pouring in from the top, flashing white as they pair up
    const u = this.t / MOVE_S;
    const pour = this.drop && u < 1 ? Math.round(400 * Math.sin(u * Math.PI)) : 0;
    this.pour.geometry.setDrawRange(0, pour);
    this.pour.material.uniforms.color.value.set(u < 0.35 ? (this.drop === 'alkali' ? 0x4d8dff : 0xff4d4d) : 0xffffff);
    this.clock = (this.clock ?? 0) + dt;
    if (this.clock > 0.4) { this.clock = 0; this.card.redraw(); }
  }

  drawCard(ui) {
    const src = this.source;
    const ph = src.ph;
    const theirs = src !== this;
    ui.y = 22;
    ui.text(theirs ? 'YOUR TEACHER’S SOLUTION' : 'INSIDE A SOLUTION', { size: 22, weight: 700, color: THEME.accent });
    const h = count(ph), oh = count(14 - ph);
    const fmt = (n) => (n >= 1e6 ? `${Math.round(n / 1e6).toLocaleString('en-GB')} million` : n < 1 ? 'fewer than 1 in this bubble' : Math.round(n).toLocaleString('en-GB'));
    ui.text(`pH ${Number.isInteger(ph) ? ph : ph.toFixed(1)}: ${ph < 7 ? 'acidic' : ph > 7 ? 'alkaline' : 'neutral'}`, { size: 30, weight: 700 });
    const ctx = ui.ctx;
    const dot = (c, label) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(ui.pad + 10, ui.y + 14, 10, 0, Math.PI * 2);
      ctx.fill();
      ui.text(label, { size: 21, x: ui.pad + 30, width: ui.contentWidth - 30 });
    };
    dot('#ff4d4d', `Hydrogen ions (H⁺): ${fmt(h)}${h > MAX ? ' (too many to draw: packed)' : ''}`);
    dot('#4d8dff', `Hydroxide ions (OH⁻): ${fmt(oh)}${oh > MAX ? ' (too many to draw: packed)' : ''}`);
    ui.text(ph === 7 ? 'In pure water only about 1 molecule in 550 million splits into ions. Each step down the pH scale is ten times more hydrogen ions.' : ph < 7 ? `Each step down the scale is ten times more hydrogen ions: pH ${Math.ceil(ph) - 1 < 0 ? 0 : Math.ceil(ph) - 1} would have ten times as many as this.` : 'Each step up the scale is ten times more hydroxide ions.', { size: 19, color: THEME.dim });
    if (theirs) return;
    ui.gap(4);
    ui.stepper('pH', Number.isInteger(ph) ? ph : ph.toFixed(1), { id: 'ions-ph', onMinus: () => this.setPH(Math.ceil(ph) - 1), onPlus: () => this.setPH(Math.floor(ph) + 1), size: 26 });
    ui.buttons(PRESETS.map(([id, label]) => ({ id: `ions-${id}`, label: `${label} (${SUBSTANCES[id].ph})`, active: SUBSTANCES[id].ph === ph, onClick: () => this.setPH(SUBSTANCES[id].ph) })), { cols: 2, height: 46, size: 18, gap: 8 });
    ui.buttons([
      { id: 'ions-acid', label: 'Add a Drop of Acid', disabled: ph <= 0, onClick: () => this.setPH(Math.ceil(ph) - 1, 'acid') },
      { id: 'ions-alkali', label: 'Add a Drop of Alkali', disabled: ph >= 14, onClick: () => this.setPH(Math.floor(ph) + 1, 'alkali') },
    ], { cols: 2, height: 50, size: 19, gap: 8 });
    if (this.drop && this.t < MOVE_S) ui.text(this.drop === 'alkali' ? 'Hydroxide ions pair up with hydrogen ions: H⁺ + OH⁻ → H₂O (neutralisation).' : 'More hydrogen ions: the solution gets more acidic.', { size: 19, color: '#7ee2a8' });
  }
}
