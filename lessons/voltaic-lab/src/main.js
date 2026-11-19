import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { addContactShadows } from '../../../shared/util/contactShadows.js';
import { studioReflections } from '../../../shared/util/reflections.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { PREDICTIONS, ANSWERS, METALS, ELECTROLYTES, BATTERIES, cellEMF } from './data/voltaic.js';
import { Bench } from './model/Bench.js';
import { Particles } from './model/Particles.js';
import { Batteries } from './model/Batteries.js';
import { Board } from './model/Board.js';
import { MODES, drawControls, drawInfo, drawCard } from './ui/panels.js';

// Voltaic Lab, from the original EngageVR lesson plan: test different combinations of chemicals in a voltaic
// cell and measure the power. Core: simple cells (two metal strips in one beaker of electrolyte), up to four,
// which can be linked in series. Advanced: two-beaker cells joined by a salt bridge, with standard electrode
// potentials and an ammeter. A zoomed-in particle view shows the oxidation, the electrons and the reduction; a
// time-lapse runs a cell down; the plenary opens up real batteries. The class board shows predictions, every
// recorded reading (biggest first) and the real batteries compared. The teacher (admin) picks the activity
// and level for everyone.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.2);
const BOARD_HEIGHT = 1.7;
const LOAD = 100; // Ω, what the cell is imagined to power while it runs down
const RUN_HOURS = 24;
const RUN_SECONDS = 10;

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.3) });
    this.state = {
      ...this.state,
      mode: 'predict',
      level: 'core',
      big: true,
      round: 0,
      revealed: false,
      vote: null,
      runs: [], // { label, V, I, n }
      particles: false,
      run: null, // { hours }
      curve: null, // [[hours, V]…] for the last run-down
      battery: null,
      chem: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Voltaic Lab',
        text: 'Metal strips, electrolytes and a multimeter: you are going to make electricity from chemistry. First, a prediction: read the question on the class board and pick your answer on the right.',
      },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    studioReflections(this); // metal strips, glass and liquids
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.62, height: 0.24, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.47, -0.2);
    this.explainPanel.mesh.rotation.x = 0.1;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];

    this.bench = new Bench(this);

    addContactShadows(this, this.bench.group, -0.3); // soft shadows under things on the bench (bench top at y = -0.3)
    this.particles = new Particles(this);
    this.batteries = new Batteries(this);
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
    this.applyMode();
  }

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    this.state.mode = mode;
    this.applyMode();
    if (quiet) return;
    const text = {
      predict: ['Predict', 'Read the question on the class board and pick your answer on the right. Then it is revealed.'],
      lab: ['The experiment', this.state.level === 'advanced'
        ? 'Drag a metal strip into each beaker of a cell: each fills with a solution of its own ions. Then lay a salt bridge across. Tap the cell to measure it, and record each reading.'
        : 'Drag two different metal strips into a beaker, then drag a bottle over it to pour in an electrolyte. Tap the cell to measure it, and record each reading. Which combination gives the most voltage?'],
      batteries: ['Real batteries', 'An alkaline AA, a lithium-ion cell and a car battery, cut open. Tap each one: what is negative, what is positive, and what is the electrolyte?'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  applyMode() {
    const m = this.state.mode;
    this.batteries.setVisible(m === 'batteries');
    this.bench.setFront(m !== 'batteries');
    this.particles.setVisible(m === 'lab' && this.state.particles);
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.state.run = null;
    this.state.curve = null;
    this.bench.setLevel(level);
    this.applyMode();
    this.refresh();
  }

  // ───────────── the experiment ─────────────

  selectCell(i) {
    const b = this.bench;
    if (b.series) b.series = false;
    b.select(i);
    sound.click();
    if (this.state.mode !== 'lab') this.setMode('lab', true);
  }

  toggleSeries() {
    const b = this.bench;
    b.series = !b.series;
    b.refreshAll();
    sound.click();
    if (b.series) this.explain({ kicker: 'IN SERIES', title: 'Cells linked + to −', text: 'The meter now reads across the whole chain. Their voltages add up, but a cell connected the wrong way round takes its voltage away instead.' });
  }

  quickStrip(side, metal) {
    const b = this.bench;
    const c = b.cell;
    b.setStrip(c, side, c[side] === metal ? null : metal);
    if (c[side]) this.onStrip(c, side, metal);
  }

  quickElectrolyte(id) {
    const c = this.bench.cell;
    this.bench.setElectrolyte(c, id);
    this.onPoured(c, id);
  }

  quickBridge() {
    const c = this.bench.cell;
    if (c.bridge) {
      this.bench.setBridge(c, false);
      sound.click();
    } else {
      this.bench.setBridge(c, true);
      if (c.bridge) this.onBridge(c);
    }
  }

  emptyCell() {
    this.bench.empty(this.bench.cell);
    this.state.curve = null;
    sound.click();
  }

  onStrip(c, side, metal) {
    sound.snap();
    if (this.bench.selected !== c.i && !this.bench.series) this.bench.select(c.i);
    const other = side === 'left' ? c.right : c.left;
    const adv = this.state.level === 'advanced';
    let text = adv ? `The beaker fills with ${METALS[metal].solution}, a solution of ${METALS[metal].ion} ions.` : 'Now the other strip, and an electrolyte.';
    if (other && other === metal) text = 'Both strips are the same metal. What do you think the meter will read?';
    else if (other) text = adv ? (c.bridge ? 'Read the meter.' : 'Now lay a salt bridge across the two beakers.') : c.electrolyte ? 'Read the meter.' : 'Now pour in an electrolyte.';
    this.explain({ kicker: 'METAL STRIP', title: `${METALS[metal].name} (${METALS[metal].react})`, text });
  }

  onPoured(c, id) {
    sound.click();
    if (this.bench.selected !== c.i && !this.bench.series) this.bench.select(c.i);
    this.explain({ kicker: 'ELECTROLYTE', title: ELECTROLYTES[id].name, text: ELECTROLYTES[id].why });
  }

  onBridge(c) {
    sound.snap();
    this.explain({ kicker: 'SALT BRIDGE', title: 'The circuit is complete', text: 'Ions can now move between the two beakers through the soaked paper, keeping each side neutral, so the electrons can keep flowing round the wire.' });
    void c;
  }

  toggleMeterMode() {
    if (this.state.level !== 'advanced') return;
    this.bench.mode = this.bench.mode === 'V' ? 'A' : 'V';
    sound.click();
    if (this.bench.mode === 'A') this.explain({ kicker: 'AMMETER', title: 'Measuring the current', text: 'Now the meter is in the circuit and current flows through it. The voltage pushes, but the resistance inside the cell (the solutions and the salt bridge) limits how much current flows.' });
  }

  toggleParticles() {
    this.state.particles = !this.state.particles;
    this.applyMode();
    sound.click();
  }

  chainLabel() {
    const chain = this.bench.chain();
    return chain.map((c) => this.cellLabel(c)).join('  +  ') || 'No cell yet';
  }

  cellLabel(c) {
    const sym = (m) => (m ? METALS[m].sym : '?');
    if (this.state.level === 'advanced') return `${sym(c.left)} | ${c.left ? METALS[c.left].solution : '?'} ${c.bridge ? '‖' : '(no bridge)'} ${c.right ? METALS[c.right].solution : '?'} | ${sym(c.right)}`;
    return `${sym(c.left)} | ${sym(c.right)} in ${c.electrolyte ? ELECTROLYTES[c.electrolyte].name.toLowerCase() : '?'}`;
  }

  record() {
    const r = this.bench.reading();
    if (!r.ok) return;
    const n = this.bench.chain().length;
    const row = { label: `${n > 1 ? `×${n}: ` : ''}${this.chainLabel()}`, V: r.V, I: this.state.level === 'advanced' ? r.I : null, n };
    this.state.runs.push(row);
    sound.bond();
    const best = Math.max(...this.state.runs.map((x) => x.V));
    this.explain({ kicker: 'RECORDED', title: `${r.V.toFixed(2)} V`, text: r.V >= best && this.state.runs.length > 1 ? 'Your best so far! Is it the metals, the electrolyte, or linking cells that made the difference?' : 'Try another combination: change one thing at a time so the test is fair.' });
  }

  /** Time-lapse: the cells being measured power a small load for 24 hours. */
  runDown() {
    const chain = this.bench.chain();
    const r = this.bench.reading();
    if (!r.ok) {
      this.explain({ kicker: 'NOT YET', title: 'Make a working cell first', text: r.why });
      return;
    }
    for (const c of chain) c.wear = 0;
    this.state.run = { hours: 0, chain };
    this.state.curve = [[0, r.V]];
    sound.power();
    this.explain({ kicker: 'TIME-LAPSE', title: '24 hours powering a small clock', text: 'Watch the negative strip wear away as its atoms become ions, and the other strip gain a coating. The voltage drops as the reacting chemicals run out.' });
  }

  stepRunDown(dt) {
    const run = this.state.run;
    if (!run) return;
    const dh = (dt * RUN_HOURS) / RUN_SECONDS;
    let V = 0;
    let R = 0;
    for (const c of run.chain) {
      const e = cellEMF(c, this.state.level, c.wear);
      if (!e || e.open) {
        this.state.run = null;
        return;
      }
      V += e.V;
      R += e.R;
    }
    const I = Math.abs(V) / (R + LOAD);
    for (const c of run.chain) {
      const cap = this.state.level === 'advanced' ? 0.12 : 0.15; // Ah
      c.wear = Math.min(1, c.wear + (I * dh) / cap);
      this.bench.refreshCell(c);
    }
    run.hours += dh;
    const r = this.bench.reading();
    if (r.ok) this.state.curve.push([Math.min(RUN_HOURS, run.hours), r.V]);
    if (run.hours >= RUN_HOURS) {
      this.state.run = null;
      sound.beep();
      const v0 = this.state.curve[0][1];
      this.explain({ kicker: 'AFTER 24 HOURS', title: `${v0.toFixed(2)} V → ${r.V.toFixed(2)} V`, text: Math.abs(r.V) < Math.abs(v0) * 0.7 ? 'The negative strip has worn away and the cell is going flat: the chemicals that react are being used up.' : 'Hardly changed: so little current flowed (high resistance inside the cell) that the chemicals have barely been used. Try a cell that gives more current.' });
    }
  }

  // ───────────── real batteries ─────────────

  aboutBattery(id) {
    this.state.battery = id;
    const b = BATTERIES.find((x) => x.id === id);
    sound.click();
    this.explain({ kicker: 'REAL BATTERIES', title: `${b.name}: ${b.volts}`, text: b.note });
  }

  // ───────────── predictions ─────────────

  predictions() {
    return PREDICTIONS;
  }

  challenge(d = this.demo) {
    const round = d.round ?? 0;
    const p = PREDICTIONS[round] ?? PREDICTIONS[0];
    return { ...p, id: `p${round}`, title: `Prediction ${round + 1} of ${PREDICTIONS.length}: ${p.name.toLowerCase()}`, revealed: !!d.rev };
  }

  myVote(ch) {
    return ch && this.state.vote?.id === ch.id ? this.state.vote.a : null;
  }

  vote(a) {
    const ch = this.challenge();
    if (ch.revealed) return;
    this.state.vote = { id: ch.id, a };
    sound.click();
  }

  tally(ch) {
    const counts = ch.options.map(() => 0);
    const mine = this.myVote(ch);
    if (mine != null) counts[mine]++;
    for (const p of this.presence?.peers.values() ?? []) {
      const v = p.replica?.v;
      if (v && v[0] === ch.id && counts[v[1]] != null) counts[v[1]]++;
    }
    return { counts, votes: counts.reduce((a, b) => a + b, 0) };
  }

  setRound(i) {
    this.state.round = i;
    this.state.revealed = false;
    sound.click();
  }

  reveal() {
    this.state.revealed = !this.state.revealed;
  }

  onRevealed(ch) {
    const mine = this.myVote(ch);
    sound[mine === ch.answer ? 'bond' : 'beep']();
    this.explain({ kicker: 'THE ANSWER', title: mine == null ? ch.options[ch.answer] : mine === ch.answer ? 'You were right!' : `It was: ${ch.options[ch.answer]}`, text: ch.why });
  }

  // ───────────── ask the chemist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.chem = { qid, answer: 'Thinking…' };
      askAI(`Student is in a chemistry lesson on voltaic cells: metal strips in electrolytes (or two half-cells and a salt bridge), measuring voltage (activity: ${this.state.mode}).`)
        .then((a) => { this.state.chem = { qid, answer: a }; this.say(a); this.refresh(); })
        .catch((e) => { this.state.chem = { qid, answer: `Sorry, the AI chemist is unavailable (${e.message}).` }; this.refresh(); });
      return;
    }
    this.state.chem = { qid, answer: ANSWERS[qid] };
    this.say(ANSWERS[qid]);
  }

  // ───────────── the class board ─────────────

  get controlsBoard() {
    return !this.presence || this.isAdmin;
  }

  toggleBoard() {
    this.state.big = !this.state.big;
  }

  myDemo() {
    const s = this.state;
    return { mode: s.mode, level: s.level, big: s.big, round: s.round, rev: s.revealed };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  boardView() {
    const d = this.demo;
    if (d.mode === 'predict') {
      const ch = this.challenge(d);
      const t = this.tally(ch);
      return { kind: 'predict', ch: { title: ch.title, q: ch.q, options: ch.options, answer: ch.answer, why: ch.why, revealed: ch.revealed, counts: ch.revealed ? t.counts : ch.options.map(() => 0), votes: t.votes } };
    }
    if (d.mode === 'batteries') return { kind: 'batteries' };
    const me = this.presence?.people.find((p) => p.you);
    const rows = this.state.runs.map((r) => ({ label: r.label, V: r.V, I: r.I, color: me?.color ?? 0x5b9bff, me: true }));
    for (const p of this.presence?.peers.values() ?? []) for (const r of p.replica?.r ?? []) rows.push({ label: r[0], V: r[1], I: r[2], color: p.color, me: false });
    rows.sort((a, b) => b.V - a.V);
    return { kind: 'results', rows, adv: d.level === 'advanced' };
  }

  placeBoard() {
    const pr = this.presence;
    if (pr?.sameRoom && pr.roomToWorld) {
      const [x, z, yaw] = this.boardLocal ?? [0, 0, 0];
      const local = new THREE.Matrix4().compose(new THREE.Vector3(x, BOARD_HEIGHT, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
      pr.roomToWorld.clone().multiply(local).decompose(this.boardStage.position, this.boardStage.quaternion, new THREE.Vector3());
      return;
    }
    this.lab.updateMatrixWorld();
    this.boardStage.position.copy(BOARD_IN_LAB).applyMatrix4(this.lab.matrixWorld);
    this.boardStage.quaternion.copy(this.lab.quaternion);
  }

  moveBoard(where) {
    const pr = this.presence;
    if (!pr?.worldToRoom) return;
    if (!where) this.boardLocal = [0, 0, 0];
    else {
      const cam = this.viewCamera();
      const dir = cam.getWorldDirection(new THREE.Vector3()).transformDirection(pr.worldToRoom);
      dir.y = 0;
      dir.normalize();
      const p = cam.getWorldPosition(new THREE.Vector3()).applyMatrix4(pr.worldToRoom).addScaledVector(dir, 2);
      this.boardLocal = [p.x, p.z, Math.atan2(-dir.x, -dir.z)].map((v) => Math.round(v * 100) / 100);
    }
    this.broadcastAdmin();
    this.refresh();
  }

  // ───────────── admin (the teacher) ─────────────

  adminLessonButtons() {
    const s = this.state;
    const sections = [
      { heading: 'Activity for everyone', buttons: MODES.map(([id, label]) => ({ id: `admin-mode-${id}`, label, active: s.mode === id, onClick: () => this.setMode(id) })), cols: 3 },
      { heading: 'Level for everyone', buttons: [['core', 'Core'], ['advanced', 'Advanced']].map(([id, label]) => ({ id: `admin-level-${id}`, label, active: s.level === id, onClick: () => this.setLevel(id) })) },
    ];
    if (this.presence?.sameRoom) {
      const centred = !this.boardLocal || this.boardLocal.every((v) => v === 0);
      sections.push({
        heading: 'Class board',
        text: this.presence.roomToWorld ? (centred ? 'In the middle of the room.' : 'Where you put it.') : 'Put on the headset to place it in the room.',
        buttons: [
          { id: 'board-centre', label: 'Middle of room', active: centred, disabled: !this.presence.roomToWorld, onClick: () => this.moveBoard(null) },
          { id: 'board-here', label: 'In front of me', disabled: !this.presence.roomToWorld, onClick: () => this.moveBoard('here') },
        ],
      });
    }
    const peers = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.n != null);
    sections.push({ heading: 'Class progress', text: `Readings recorded: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.n}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
    return sections;
  }

  adminLessonState() {
    return { demo: this.myDemo(), board: this.boardLocal ?? [0, 0, 0] };
  }

  onAdminLesson(l) {
    if (!l?.demo) return;
    const d = l.demo;
    this.adminDemo = d;
    let changed = false;
    if (d.level && d.level !== this.state.level) {
      this.setLevel(d.level);
      changed = true;
    }
    if (d.mode && MODES.some(([id]) => id === d.mode) && d.mode !== this.state.mode) {
      this.setMode(d.mode);
      changed = true;
    }
    if (l.board && JSON.stringify(l.board) !== JSON.stringify(this.boardLocal ?? [0, 0, 0])) this.boardLocal = l.board;
    if (changed) this.refresh();
  }

  // ───────────── shared sessions ─────────────

  netState() {
    const v = this.state.vote;
    return {
      v: v ? [v.id, v.a] : null,
      n: this.state.runs.length,
      r: this.state.runs.slice(-12).map((r) => [r.label, Math.round(r.V * 1000) / 1000, r.I == null ? null : Math.round(r.I * 1e6) / 1e6]),
    };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      v: null,
      n: null,
      r: [],
      apply: (st) => {
        const fresh = JSON.stringify([st.v, st.n]) !== JSON.stringify([r.v, r.n]);
        r.v = st.v ?? null;
        r.n = st.n ?? 0;
        r.r = st.r ?? [];
        if (fresh) this.refresh();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    const m = this.state.mode;
    return [...(m === 'batteries' ? [] : this.bench.targets), ...this.batteries.targets];
  }

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  update(dt) {
    const now = performance.now();
    const real = Math.min(0.1, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    this.stepRunDown(real);
    this.bench.update(real);
    this.particles.update(real);

    this.liveClock = (this.liveClock ?? 0) + dt;
    if (this.liveClock > 0.25) {
      this.liveClock = 0;
      this.refresh();
    }

    const d = this.demo;
    this.boardStage.visible = d.big !== false;
    if (this.boardStage.visible) {
      this.placeBoard();
      this.board.draw(this.boardView());
    }

    const ch = d.mode === 'predict' ? this.challenge(d) : null;
    const key = ch ? `${ch.id}|${ch.revealed}` : '';
    if (key !== this.revealKey) {
      const was = this.revealKey;
      this.revealKey = key;
      if (ch?.revealed && was === `${ch.id}|false`) this.onRevealed(ch);
      else if (was != null) this.refresh();
    }

    if (this.isAdmin) {
      const json = JSON.stringify(this.adminLessonState());
      if (json !== this.lastAdminJson) {
        this.lastAdminJson = json;
        this.broadcastAdmin();
      }
    }
  }
}

async function askAI(context) {
  const endpoint = window.WEBXR_CLASSES_CONFIG?.chemistEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am doing.', context, audience: 'secondary school chemistry students; answer as a friendly chemist in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
