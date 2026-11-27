import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { addContactShadows } from '../../../shared/util/contactShadows.js';
import { studioReflections } from '../../../shared/util/reflections.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { G, PREDICTIONS, ANSWERS, STATIONS, DROP_OBJECTS, SPRINGS, CHECKS, BOBS } from './data/kinematics.js';
import { Bench, RAMP_LEN } from './model/Bench.js';
import { Chart } from './model/Chart.js';
import { Tower } from './model/Tower.js';
import { Board, springColour } from './model/Board.js';
import { MODES, drawControls, drawInfo, drawCard } from './ui/panels.js';

// Kinematics Lab, from the original EngageVR lesson (a tall measuring pole, a glass balcony at 5, 10 and 15 m,
// a ball, and a chart of 20 samples with a datasheet), extended to the lesson plan's pendulums and springs, plus
// a ramp. One station on the bench at a time; the drop tower is a 1:20 model with a "watch it life-size" view
// of the full pole rising through the ceiling. Each run draws an original-style chart (displacement, velocity
// or acceleration against time, 20 samples) and adds a row to the datasheet, with the workings on request.
// The class board shows predictions, the class datasheet for one station, and the groups' key insights. The
// teacher (admin) picks the activity, level and station for everyone.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.2);
const BOARD_HEIGHT = 1.7;
const MASS_COLS = ['#ff9a3c', '#7ee2a8', '#7cc4ff'];
const OBJ_COLS = { tennis: '#d8f24a', bowling: '#7c8cff', feather: '#f4f0e8', parachute: '#ff6b6b' };

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.3) });
    this.state = {
      ...this.state,
      mode: 'predict',
      level: 'core',
      big: false, // (the class board starts hidden: switched on in Settings, or by the teacher: Teacher menu → Board)
      round: 0,
      revealed: false,
      vote: null,
      qty: 's',
      life: false,
      rows: [], // datasheet rows: { station, … }
      worked: [], // rows whose workings are shown
      checks: {}, // station → chosen answer
      insight: null,
      phys: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Kinematics Lab',
        text: 'Drops, swings, bounces and rolls: how do things move, and what changes their motion? First, a prediction: read the question on the class board and pick your answer on the right.',
      },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    studioReflections(this); // metal, glass and glossy surfaces
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.5, height: 0.22, name: 'card' });
    this.explainPanel.mesh.position.set(0.24, 0.52, -0.22);
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];

    this.bench = new Bench(this);

    addContactShadows(this, this.bench.group, -0.3); // soft shadows under things on the bench (bench top at y = -0.3)
    this.chart = new Chart(this, 0.42);
    this.chart.group.position.set(0.24, 0.22, -0.22);
    this.tower = new Tower(this);
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    this.state.mode = mode;
    if (quiet) return;
    const text = {
      predict: ['Predict', 'Read the question on the class board and pick your answer on the right. The key terms are under it.'],
      lab: ['The experiments', 'Pick a station on the left. Change one thing at a time, predict what will happen, then run it. Each run draws the chart and adds a row to your datasheet: press a row to see how to work out the answer.'],
      share: ['Share your findings', 'In your group, agree on your most important finding and pick it on the right. Then share it with the class.'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    const d = this.bench.s.drop;
    if (level === 'core' && DROP_OBJECTS[d.obj].advanced) this.bench.s.drop.obj = 'tennis';
    this.bench.resetStation();
    this.refresh();
  }

  setStation(id, quiet = false) {
    this.bench.setStation(id);
    if (id !== 'drop' && this.state.life) this.toggleLife();
    sound.click();
    if (quiet) return;
    const text = {
      drop: 'The balcony is at 5, 10 or 15 m, as in the original lab. Drop something and watch the chart: how does the height change with time? Try “Watch it life-size”.',
      pendulum: 'Change the length, the mass and the release angle, one at a time. Which of them changes how long a swing takes?',
      spring: 'Hang a mass, read the stretch on the ruler, then let it bounce. Can you find the stiffness of the mystery spring?',
      ramp: 'Change the angle and let the ball roll 0.7 m. How does the acceleration change as the ramp gets steeper?',
    }[id];
    this.explain({ kicker: 'STATION', title: STATIONS.find(([s]) => s === id)[1], text });
  }

  setting(key, value) {
    this.bench.set(key, value);
    sound.click();
  }

  setQty(q) {
    this.state.qty = q;
    sound.click();
  }

  run() {
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    const st = this.bench.station;
    if (st === 'spring') this.bench.s.spring.pull = 0.04;
    this.bench.start();
  }

  stopRun() {
    this.bench.resetStation();
    sound.click();
  }

  onStart(station) {
    sound.click();
    void station;
  }

  /** A run finished (or 10 swings / bounces were timed): add a row to the datasheet. */
  onFinished(station, data) {
    const row = { station, ...data };
    this.state.rows.push(row);
    sound.bond();
    if (station === 'drop') {
      sound.thud();
      this.explain({ kicker: 'LANDED', title: `${data.h} m in ${data.t.toFixed(2)} s`, text: `It hit the ground at ${Math.abs(data.v).toFixed(1)} m/s. ${DROP_OBJECTS[data.obj].vt < 5 ? 'Air resistance held it back to a slow, steady speed: look at the velocity chart.' : 'Press the row in the datasheet to work out g from your time.'}` });
    } else if (station === 'pendulum') {
      this.explain({ kicker: '10 SWINGS', title: `${data.t10.toFixed(2)} s: one swing takes ${(data.t10 / 10).toFixed(3)} s`, text: 'Timing 10 swings and dividing by 10 makes your reaction time matter ten times less. Now change one thing and time it again.' });
    } else if (station === 'spring') {
      this.explain({ kicker: '10 BOUNCES', title: `${data.t10.toFixed(2)} s: one bounce takes ${(data.t10 / 10).toFixed(3)} s`, text: `The spring stretched ${(data.stretch * 100).toFixed(1)} cm under ${data.m} g. Press the row in the datasheet to work out how stiff it is.` });
    } else {
      this.explain({ kicker: 'AT THE BOTTOM', title: `0.7 m in ${data.t.toFixed(2)} s`, text: 'Press the row in the datasheet to work out the acceleration. Then try a steeper ramp.' });
    }
  }

  toggleWorked(i) {
    const w = this.state.worked;
    const k = w.indexOf(i);
    if (k >= 0) w.splice(k, 1);
    else w.push(i);
    sound.click();
  }

  answerCheck(station, k) {
    if (this.state.checks[station] != null) return;
    this.state.checks[station] = k;
    sound[k === CHECKS[station].answer ? 'bond' : 'refuse']();
  }

  toggleLife() {
    this.state.life = !this.state.life;
    this.tower.setVisible(this.state.life);
    this.classroom?.setCeiling(!this.state.life); // the pole rises through the ceiling
    sound.click();
    if (this.state.life) {
      if (!this.presenting) {
        // on a screen, step back to see the whole pole
        this.camera.position.set(1.4, 2.6, 8.5);
        this.controls.target.set(-0.9, 5.5, -0.6);
        this.controls.update();
      }
      this.explain({ kicker: 'LIFE-SIZE', title: 'The Full Measuring Pole', text: this.presenting ? 'Look up: the pole rises 16 m through the ceiling, with the balcony at the height you chose. Drop it and watch it land beside you.' : 'Here is the full 16 m pole beside your bench. Drop it and watch the real fall. (“Reset view” brings you back to the bench.)' });
    } else if (!this.presenting) this.recenter();
  }

  // ───────────── plenary ─────────────

  chooseInsight(id) {
    this.state.insight = this.state.insight === id ? null : id;
    sound.click();
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
    this.explain({ kicker: 'THE ANSWER', title: mine == null ? ch.options[ch.answer] : mine === ch.answer ? 'You were right' : `It was: ${ch.options[ch.answer]}`, text: ch.why });
  }

  // ───────────── ask the physicist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.phys = { qid, answer: 'Thinking…' };
      askAI(`Student is in a kinematics lesson: dropping objects from a tower, pendulums, springs and a ramp, with displacement, velocity and acceleration graphs (activity: ${this.state.mode}).`)
        .then((a) => { this.state.phys = { qid, answer: a }; this.say(a); this.refresh(); })
        .catch((e) => { this.state.phys = { qid, answer: `Sorry, the AI physicist is unavailable (${e.message}).` }; this.refresh(); });
      return;
    }
    this.state.phys = { qid, answer: ANSWERS[qid] };
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
    return { mode: s.mode, level: s.level, big: s.big, round: s.round, rev: s.revealed, st: this.bench.station };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  /** A datasheet row as a point on the class chart: [station, x, y, colour key]. */
  point(r) {
    if (r.station === 'drop') return ['drop', r.h, r.t, r.obj];
    if (r.station === 'pendulum') return ['pendulum', r.L, r.t10 / 10, r.m];
    if (r.station === 'spring') return ['spring', r.m, r.t10 / 10, r.id];
    return ['ramp', r.deg, (2 * r.d) / (r.t * r.t), null];
  }

  boardView() {
    const d = this.demo;
    if (d.mode === 'predict') {
      const ch = this.challenge(d);
      const t = this.tally(ch);
      return { kind: 'predict', ch: { title: ch.title, q: ch.q, options: ch.options, answer: ch.answer, why: ch.why, revealed: ch.revealed, counts: ch.revealed ? t.counts : ch.options.map(() => 0), votes: t.votes } };
    }
    if (d.mode === 'share') {
      const counts = {};
      if (this.state.insight) counts[this.state.insight] = 1;
      for (const p of this.presence?.peers.values() ?? []) if (p.replica?.ins) counts[p.replica.ins] = (counts[p.replica.ins] ?? 0) + 1;
      return { kind: 'insights', counts };
    }
    const st = d.st ?? 'drop';
    const me = this.presence?.people.find((p) => p.you);
    const col = (pt) => (pt[0] === 'drop' ? OBJ_COLS[pt[3]] : pt[0] === 'pendulum' ? MASS_COLS[BOBS.indexOf(pt[3])] : pt[0] === 'spring' ? springColour(pt[3]) : null);
    const points = [];
    for (const r of this.state.rows) {
      const pt = this.point(r);
      if (pt[0] === st) points.push({ x: pt[1], y: pt[2], col: col(pt), color: me?.color ?? 0x5b9bff, me: true });
    }
    for (const p of this.presence?.peers.values() ?? []) for (const pt of p.replica?.r ?? []) if (pt[0] === st) points.push({ x: pt[1], y: pt[2], col: col(pt), color: p.color, me: false });
    return { kind: 'results', station: st, points, adv: d.level === 'advanced' };
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
      { heading: 'Station for everyone', buttons: STATIONS.map(([id, label]) => ({ id: `admin-st-${id}`, label, active: this.bench.station === id, onClick: () => this.setStation(id) })), cols: 2 },
    ];
    if (this.presence?.sameRoom) {
      const centred = !this.boardLocal || this.boardLocal.every((v) => v === 0);
      sections.push({
        heading: 'Class board',
        text: this.presence.roomToWorld ? (centred ? 'In the middle of the room.' : 'Where you put it.') : 'Put on the headset to place it in the room.',
        buttons: [
          { id: 'board-centre', label: 'Middle of Room', active: centred, disabled: !this.presence.roomToWorld, onClick: () => this.moveBoard(null) },
          { id: 'board-here', label: 'In Front of Me', disabled: !this.presence.roomToWorld, onClick: () => this.moveBoard('here') },
        ],
      });
    }
    const peers = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.n != null);
    sections.push({ heading: 'Class progress', text: `Datasheet rows: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.n}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
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
    if (d.st && d.st !== this.bench.station && d.mode === 'lab') {
      this.setStation(d.st);
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
      n: this.state.rows.length,
      r: this.state.rows.slice(-30).map((r) => this.point(r).map((x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x))),
      ins: this.state.insight,
    };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      v: null,
      n: null,
      r: [],
      ins: null,
      apply: (st) => {
        const fresh = JSON.stringify([st.v, st.n, st.ins]) !== JSON.stringify([r.v, r.n, r.ins]);
        r.v = st.v ?? null;
        r.n = st.n ?? 0;
        r.r = st.r ?? [];
        r.ins = st.ins ?? null;
        if (fresh) this.refresh();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    return this.state.mode === 'lab' ? this.bench.targets : [];
  }

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  floorY() {
    const y = this.lab.position.y;
    return y > 0.6 ? -y : -1.3;
  }

  /** What the chart's 20 samples cover, and the ranges each quantity can reach. */
  chartWindow() {
    const b = this.bench;
    const st = b.station;
    const s = b.s[st];
    if (st === 'drop') {
      const o = DROP_OBJECTS[s.obj];
      const vmax = Math.min(Math.sqrt(2 * G * s.h), o.vt);
      const tEnd = b.trace.length && !s.running && s.y <= 0 ? b.trace.at(-1).t : Math.max(Math.sqrt((2 * s.h) / G), o.vt < 5 ? s.h / o.vt + o.vt / G : 0);
      return { win: tEnd, bounds: { s: [0, s.h], v: [-vmax, 0], a: [-G, 0] } };
    }
    if (st === 'pendulum') {
      const T = 2 * Math.PI * Math.sqrt(s.L / G);
      const th = (s.deg * Math.PI) / 180;
      const amp = s.L * Math.sin(th);
      const vm = Math.sqrt(2 * G * s.L * (1 - Math.cos(th)));
      return { win: 2 * T, bounds: { s: [-amp, amp], v: [-vm, vm], a: [-G * Math.sin(th), G * Math.sin(th)] } };
    }
    if (st === 'spring') {
      const w = Math.sqrt(SPRINGS[s.id].k / (s.m / 1000));
      const A = Math.max(0.005, s.pull);
      return { win: (2 * 2 * Math.PI) / w, bounds: { s: [-A, A], v: [-A * w, A * w], a: [-A * w * w, A * w * w] } };
    }
    const a = (5 / 7) * G * Math.sin((s.deg * Math.PI) / 180);
    const t = Math.sqrt((2 * RAMP_LEN) / a);
    return { win: t, bounds: { s: [0, RAMP_LEN], v: [0, a * t], a: [0, a] } };
  }

  update(dt) {
    const now = performance.now();
    const real = Math.min(0.25, (now - (this.lastNow ?? now)) / 1000); // keeps real time even if frames are slow
    this.lastNow = now;
    const s = this.state;
    const d = this.demo;
    this.bench.update(real);
    this.tower.update(this.floorY(), this.bench.s.drop);
    const title = STATIONS.find(([id]) => id === this.bench.station)[1];
    const cw = this.chartWindow();
    this.chart.group.visible = s.mode === 'lab';
    if (this.chart.group.visible) this.chart.draw({ trace: this.bench.trace, win: cw.win, bounds: cw.bounds, qty: s.qty, title, done: !this.bench.s[this.bench.station].running });

    this.liveClock = (this.liveClock ?? 0) + dt;
    if (this.liveClock > 0.25) {
      this.liveClock = 0;
      this.refresh();
    }

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
  const endpoint = window.WEBXR_CLASSES_CONFIG?.physicistEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am doing.', context, audience: 'secondary school students; answer as a friendly physicist in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
