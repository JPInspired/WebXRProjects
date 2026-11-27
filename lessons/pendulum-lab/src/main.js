import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { addContactShadows } from '../../../shared/util/contactShadows.js';
import { studioReflections } from '../../../shared/util/reflections.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { PREDICTIONS, ANSWERS, LENGTHS, BOBS, AIR, PLANETS, periodSmall } from './data/pendulum.js';
import { Rig } from './model/Rig.js';
import { Energy } from './model/Energy.js';
import { World } from './model/World.js';
import { Board } from './model/Board.js';
import { MODES, drawControls, drawInfo, drawCard, drawSettings, drawAsk, drawDiscuss } from './ui/panels.js';

// Pendulum Lab, rebuilt from the original EngageVR lesson (a big protractor with the pendulum in front of it:
// grab the weight, move it to an angle, let go and watch, change the length with the up / down buttons), plus
// a giant pendulum from the ceiling. Students time swings with a stopwatch and compare with a light gate, plot
// period against length, explore energy and momentum loss with different bobs and air, and finish with real-
// world pendulums: a clock to regulate, a swing and a pirate ship to push, a metronome, and other planets.
// The class board shows predictions, everyone's results, how fast the swings die away, and the clock challenge.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.2);
const BOARD_HEIGHT = 1.7;

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.55, 1.45) });
    this.state = {
      ...this.state,
      mode: 'predict',
      level: 'core',
      big: false, // (the class board starts hidden: switched on in Settings, or by the teacher: Teacher menu → Board)
      round: 0,
      revealed: false,
      vote: null,
      gateShown: false,
      sub: { measure: 'setup', energy: 'bob' }, // the step tab open in each activity
      runs: [], // { L, n, t, T, gate, g, where }
      energyRows: [], // { bob, air, airName, swings }
      world: 'clock',
      planet: 'earth',
      clockBest: null, // { err, L }
      phys: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Pendulum Lab',
        text: 'What decides how long a pendulum takes to swing? First, a prediction: read the question on the class board and pick your answer on the right.',
      },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    studioReflections(this); // metal, glass and glossy surfaces
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.5, height: 0.22, name: 'card' });
    this.explainPanel.mesh.position.set(-0.55, 0.64, -0.25);
    this.explainPanel.mesh.rotation.y = 0.35;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];

    this.rig = new Rig(this);

    addContactShadows(this, this.rig.group, -0.3); // soft shadows under things on the bench (bench top at y = -0.3)
    this.energy = new Energy(this);
    this.energy.mesh.position.set(0.55, 0.64, -0.25);
    this.world = new World(this);
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);
    this.halved = false;

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
      predict: ['Predict', 'Read the question on the class board and pick your answer on the right. What might change how a pendulum swings?'],
      measure: ['Measure the period', this.presenting
        ? 'Grab the bob, pull it out to an angle and let go. Time 10 swings with the stopwatch, then change the length with the arrows and repeat. Try the giant pendulum hanging from the ceiling too.'
        : 'Drag the bob out to an angle and let go (or press “Let go”). Time 10 swings with the stopwatch, then change the length and repeat. Try the giant pendulum too.'],
      energy: ['Energy and momentum', 'Watch the energy bars as it swings, and how quickly the swings die away. Change the bob and the air, and compare.'],
      world: ['Pendulums in the real world', 'A clock to regulate, a swing and a pirate ship to push, a metronome, and a trip to other planets.'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  applyMode() {
    const s = this.state;
    const m = s.mode;
    const r = this.rig;
    const worldModel = m === 'world' && s.world !== 'planets';
    r.benchGroup.visible = !worldModel;
    r.giantGroup.visible = m === 'measure' && r.target === 'giant';
    r.watchGroup.visible = m === 'measure';
    this.energy.mesh.visible = m === 'energy';
    this.world.show(worldModel ? s.world : null);
    r.bench.g = m === 'world' && s.world === 'planets' ? PLANETS[s.planet].g : 9.81;
    if (m !== 'energy' && (r.bench.bob !== 'steel' || r.bench.air !== 1)) {
      r.setBob('steel');
      r.bench.air = 1;
    }
    if (m !== 'measure' && r.target === 'giant') r.target = 'bench';
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.refresh();
  }

  // ───────────── menus: step tabs and pop-ups ─────────────

  setSub(mode, id) {
    this.state.sub[mode] = id;
    sound.click();
    this.refresh();
  }

  settingsSections(ui) {
    drawSettings(ui, this);
  }

  openAsk() {
    if (this.popupOpen === 'Ask the physicist') return this.closePopup();
    this.openPopup('Ask the Physicist', (ui) => drawAsk(ui, this), { height: 0.72 });
  }

  openDiscuss() {
    if (this.popupOpen === 'Discuss') return this.closePopup();
    this.openPopup('Discuss', (ui) => drawDiscuss(ui), { height: 0.5 });
  }

  // ───────────── measuring ─────────────

  setTarget(id) {
    this.rig.target = id;
    this.rig.resetWatch();
    this.applyMode();
    sound.click();
    if (id === 'giant') this.explain({ kicker: 'GIANT PENDULUM', title: 'Hanging from the Ceiling', text: this.presenting ? 'Look behind your bench: a 2 m pendulum hangs from the ceiling. Grab its bob, pull it out and let go, or use “Let go”. Does the pattern still hold?' : 'Behind your bench, a 2 m pendulum hangs from the ceiling. Does the pattern still hold for long pendulums?' });
  }

  setLength(L) {
    const p = this.rig.active;
    p.stop();
    p.L = L;
    this.rig.resetWatch();
    sound.click();
  }

  stepLength(d) {
    const p = this.rig.bench;
    const i = LENGTHS.findIndex((x) => Math.abs(x - p.L) < 1e-6);
    const next = LENGTHS[Math.max(0, Math.min(LENGTHS.length - 1, (i < 0 ? 3 : i) + d))];
    if (this.rig.target !== 'bench') this.rig.target = 'bench';
    this.setLength(next);
  }

  setAngle(d) {
    this.rig.deg = d;
    sound.click();
  }

  release() {
    const p = this.rig.active;
    p.release(this.rig.deg);
    this.onReleased(p);
  }

  stopSwing() {
    this.rig.active.stop();
    sound.click();
  }

  onReleased(p) {
    sound.click();
    this.halved = false;
    void p;
  }

  pressStartStop() {
    const r = this.rig;
    const what = r.startStop();
    sound.beep();
    if (what === 'start') return;
    const w = r.watch;
    if (w.n < 3) {
      this.explain({ kicker: 'STOPWATCH', title: 'Count More Swings', text: 'Start the stopwatch as you let go, tap “Count a swing” each time it comes back to where you let go, and stop after 10.' });
      return;
    }
    const p = r.active;
    const T = w.t / w.n;
    const gate = r.gateMean();
    this.state.runs.push({ L: p.L, n: w.n, t: w.t, T, gate, g: p.g, where: r.target });
    sound.bond();
    const theory = periodSmall(p.L, p.g);
    this.explain({ kicker: 'RESULT', title: `${w.n} swings in ${w.t.toFixed(2)} s: T = ${T.toFixed(3)} s`, text: `${gate ? `The light gate measured ${gate.toFixed(3)} s: you were ${Math.abs(T - gate) / gate < 0.02 ? 'very close' : `${(Math.abs(T - gate) / gate * 100).toFixed(0)}% out (reaction time!)`}. ` : ''}${this.state.level === 'advanced' ? `Theory: 2π√(L/g) = ${theory.toFixed(3)} s. ` : ''}Now change the length and time it again.` });
    this.state.gateShown = true;
  }

  pressCount() {
    if (this.rig.countSwing()) sound.click();
  }

  pressReset() {
    this.rig.resetWatch();
    sound.click();
  }

  toggleGate() {
    this.state.gateShown = !this.state.gateShown;
    sound.click();
  }

  // ───────────── energy ─────────────

  setBob(id) {
    this.rig.setBob(id);
    this.halved = false;
    sound.click();
    this.explain({ kicker: 'NEW BOB', title: BOBS[id].name, text: `${(BOBS[id].m * 1000).toFixed(BOBS[id].m < 0.01 ? 1 : 0)} g. Let it go from the same angle as before: does it keep swinging as long? Does each swing take as long?` });
  }

  setAir(f) {
    this.rig.bench.air = f;
    this.halved = false;
    sound.click();
  }

  checkHalved() {
    const p = this.rig.bench;
    if (this.halved || !p.running || p.peaks.length < 3) return;
    const a0 = p.peaks[0][1];
    const idx = p.peaks.findIndex(([, a]) => a <= a0 / 2);
    const swings = Math.floor((p.peaks.length - 1) / 2);
    if (idx > 0 || swings >= 200) {
      this.halved = true;
      const n = idx > 0 ? Math.round(idx / 2) : 200;
      const airName = AIR.find(([, , f]) => f === p.air)[1];
      this.state.energyRows.push({ bob: BOBS[p.bob].name, air: AIR.find(([, , f]) => f === p.air)[0], airName, swings: n });
      sound.bond();
      this.explain({ kicker: 'HALF THE SWING', title: `${BOBS[p.bob].name}: halved after ${n} swing${n === 1 ? '' : 's'}`, text: `${p.bob === 'foam' || p.bob === 'sail' ? 'It lost its energy to the air very quickly: light or draggy bobs are slowed most.' : 'A heavy, smooth bob keeps its energy for many swings.'} Did each swing take a different time? Compare the period with the steel bob.` });
    }
  }

  // ───────────── real world ─────────────

  setWorld(id) {
    this.state.world = id;
    this.applyMode();
    sound.click();
    const text = {
      clock: ['Pendulum clock', 'This clock is running slow. Adjust its pendulum until it keeps time with the real clock beside it.'],
      swing: ['Swing and pirate ship', 'Push it: when does each push make it go higher? Try the pirate ship too: a much longer pendulum.'],
      metronome: ['Metronome', 'Slide the weight to change the beat. Higher up the arm: faster or slower?'],
      planets: ['Other planets', 'Take the bench pendulum to the Moon, Mars or Jupiter, let it go and time it.'],
    }[id];
    this.explain({ kicker: 'REAL WORLD', title: text[0], text: text[1] });
  }

  adjustClock(d) {
    this.world.adjustClock(d);
    sound.click();
    const err = this.world.clockError;
    const best = this.state.clockBest;
    if (!best || Math.abs(err) < Math.abs(best.err)) this.state.clockBest = { err, L: this.world.clockPend.L };
  }

  setRide(r) {
    this.world.setRide(r);
    sound.click();
  }

  pushSwing() {
    const helped = this.world.push();
    sound[helped ? 'click' : 'refuse']();
  }

  setBpm(b) {
    this.world.setBpm(b);
    sound.click();
  }

  metronomeTick() {
    if (this.state.mode === 'world' && this.state.world === 'metronome') sound.click();
  }

  setPlanet(id) {
    this.state.planet = id;
    this.rig.bench.stop();
    this.applyMode();
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
      askAI(`Student is in a physics lesson on pendulums: timing swings for different lengths, energy and momentum loss, and real-world pendulums (activity: ${this.state.mode}).`)
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
    return { mode: s.mode, level: s.level, big: s.big, round: s.round, rev: s.revealed };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  everyone() {
    const me = this.presence?.people.find((p) => p.you);
    const out = [{ name: me?.name ?? 'You', color: me?.color ?? 0x5b9bff, me: true, st: this.netState() }];
    for (const p of this.presence?.peers.values() ?? []) if (p.replica?.st) out.push({ name: p.name, color: p.color, me: false, st: p.replica.st });
    return out;
  }

  boardView() {
    const d = this.demo;
    if (d.mode === 'predict') {
      const ch = this.challenge(d);
      const t = this.tally(ch);
      return { kind: 'predict', ch: { title: ch.title, q: ch.q, options: ch.options, answer: ch.answer, why: ch.why, revealed: ch.revealed, counts: ch.revealed ? t.counts : ch.options.map(() => 0), votes: t.votes } };
    }
    const all = this.everyone();
    if (d.mode === 'energy') {
      const rows = [];
      for (const p of all) for (const r of p.st.e ?? []) rows.push({ bob: r[0], air: r[1], airName: r[2], swings: r[3] });
      // one row per bob and air: the class average
      const byKey = {};
      for (const r of rows) (byKey[`${r.bob}|${r.airName}`] ??= { ...r, list: [] }).list.push(r.swings);
      const merged = Object.values(byKey).map((r) => ({ ...r, swings: Math.round(r.list.reduce((a, b) => a + b, 0) / r.list.length) })).sort((a, b) => b.swings - a.swings);
      return { kind: 'energy', rows: merged };
    }
    if (d.mode === 'world') {
      const clocks = all.filter((p) => p.st.c).map((p) => ({ name: p.name, color: p.color, me: p.me, err: p.st.c[0], L: p.st.c[1] })).sort((a, b) => Math.abs(a.err) - Math.abs(b.err));
      const planets = Object.values(PLANETS).map((p) => ({ name: p.name, g: p.g, T: periodSmall(1, p.g) }));
      return { kind: 'world', clocks, planets };
    }
    const points = [];
    for (const p of all) for (const r of p.st.r ?? []) points.push({ L: r[0], T: r[1], color: p.color, me: p.me });
    return { kind: 'results', points, adv: d.level === 'advanced' };
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
      { heading: 'Activity for everyone', buttons: MODES.map(([id, label]) => ({ id: `admin-mode-${id}`, label, active: s.mode === id, onClick: () => this.setMode(id) })), cols: 2 },
      { heading: 'Level for everyone', buttons: [['core', 'Core'], ['advanced', 'Advanced']].map(([id, label]) => ({ id: `admin-level-${id}`, label, active: s.level === id, onClick: () => this.setLevel(id) })) },
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
    const peers = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.st);
    sections.push({ heading: 'Class progress', text: `Results recorded: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.st.r?.length ?? 0}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
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
    const s = this.state;
    const v = s.vote;
    return {
      v: v ? [v.id, v.a] : null,
      r: s.runs.filter((x) => x.g === 9.81).slice(-24).map((x) => [x.L, Math.round(x.T * 1000) / 1000]),
      e: s.energyRows.slice(-12).map((x) => [x.bob, x.air, x.airName, x.swings]),
      c: s.clockBest ? [Math.round(s.clockBest.err), s.clockBest.L] : null,
    };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      st: null,
      v: null,
      apply: (st) => {
        const before = JSON.stringify(r.st);
        r.st = st;
        r.v = st.v ?? null;
        if (JSON.stringify(st) !== before) this.refresh();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    const m = this.state.mode;
    if (m === 'world' && this.state.world !== 'planets') return [];
    return this.rig.targets.filter((o) => m === 'measure' || !(o.userData.startStop || o.userData.count || o.userData.reset));
  }

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  floorY() {
    const y = this.lab.position.y;
    return y > 0.6 ? -y : -1.3;
  }

  update(dt) {
    const now = performance.now();
    const real = Math.min(0.25, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    const s = this.state;
    this.rig.update(real, this.floorY());
    if (s.mode === 'energy') {
      this.energy.draw(this.rig.bench);
      this.checkHalved();
    }
    if (s.mode === 'world') this.world.update(real);

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
  const endpoint = window.WEBXR_CLASSES_CONFIG?.physicistEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am doing.', context, audience: 'secondary school physics students; answer as a friendly physicist in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
