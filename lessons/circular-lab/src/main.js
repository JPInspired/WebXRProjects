import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { addContactShadows } from '../../../shared/util/contactShadows.js';
import { studioReflections } from '../../../shared/util/reflections.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { PREDICTIONS, ANSWERS, CORE_HANGING, idealRps } from './data/circular.js';
import { Kit } from './model/Kit.js';
import { Plenary } from './model/Plenary.js';
import { Board } from './model/Board.js';
import { MODES, drawControls, drawInfo, drawCard } from './ui/panels.js';

// Circular Motion, rebuilt from the original EngageVR lesson (pick up a ball on a string, spin it, measure the
// rotations per second with a stopwatch, try the other weights: 50 to 250 g), using the standard school kit
// so the pull stays fixed: a string through a tube, the ball on top and a hanging weight below. Students spin
// it above their heads by swirling the tube (or with buttons), keep the clip in place, count turns against a
// stopwatch and check with a light gate. The class board shows predictions, then everyone's turns per second
// against mass and string length; the plenary cuts the string and takes away the force on a satellite and a
// car. The teacher (admin) picks the activity and level for everyone.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.2);
const BOARD_HEIGHT = 1.7;

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.5, 1.45) });
    this.state = {
      ...this.state,
      mode: 'predict',
      level: 'core',
      big: true,
      round: 0,
      revealed: false,
      vote: null,
      runs: [], // { m, L, M, n, t, f, gate, steady }
      done: [], // real-world examples tried: 'ball' | 'satellite' | 'car'
      phys: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Circular Motion Lab',
        text: 'A ball on a string, spun round above your head by a fixed pull. First, a prediction: read the question on the class board and pick your answer on the right.',
      },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    studioReflections(this); // metal, glass and glossy surfaces
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.6, height: 0.24, name: 'card' });
    this.explainPanel.mesh.position.set(-0.3, 0.24, -0.16);
    this.explainPanel.mesh.rotation.set(0.05, 0.3, 0);
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];

    this.kit = new Kit(this);

    addContactShadows(this, this.kit.group, -0.3); // soft shadows under things on the bench (bench top at y = -0.3)
    this.plenary = new Plenary(this);
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
      lab: ['The experiment', this.presenting
        ? 'Pick up the blue tube and swirl it in small circles above your head. Keep the red clip just below the tube (green light), then time 10 turns with the stopwatch. Change the ball and the string length and repeat.'
        : 'Drag the ball round in circles to spin it, or press Faster. Keep the red clip just below the tube (green light), then time 10 turns with the stopwatch. Change the ball and the string length and repeat.'],
      world: ['In the real world', 'Something always pulls towards the centre. Cut the string, switch off gravity for the satellite, or put ice on the road: which way does each one go?'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  applyMode() {
    const m = this.state.mode;
    this.plenary.setVisible(m === 'world');
    this.kit.watchGroup.visible = m !== 'world';
    for (const b of this.kit.rack) b.userData.hidden = m === 'world';
    if (m !== 'world' && this.kit.cut) this.kit.retie();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    if (level === 'core' && this.kit.M !== CORE_HANGING) this.kit.setHanging(CORE_HANGING);
    this.refresh();
  }

  // ───────────── the experiment ─────────────

  spin(what) {
    const k = this.kit;
    if (k.cut) return;
    if (what === 'faster') k.faster();
    else if (what === 'slower') k.slower();
    else if (what === 'steady') k.holdSteady();
    else k.stop();
    sound.click();
  }

  chooseBall(g) {
    if (this.kit.cut) this.kit.retie();
    this.kit.setBall(g);
    sound.snap();
    this.explain({ title: `${g} g ball tied on`, text: 'Spin it up and keep the clip in place, then time 10 turns. Is it faster or slower than before?' });
  }

  chooseLength(L) {
    this.kit.setLength(L);
    sound.click();
    this.explain({ title: `String length ${L.toFixed(1)} m`, text: 'The clip now marks a circle of this radius. Spin it up again and keep the clip just below the tube.' });
  }

  chooseHanging(M) {
    this.kit.setHanging(M);
    sound.click();
    this.explain({ title: `${M} g hanging: a pull of ${(this.kit.F).toFixed(2)} N`, text: 'A bigger pull is a bigger centripetal force. To keep the same circle, the ball must now go round faster.' });
  }

  toggleGate() {
    this.kit.gate.on = !this.kit.gate.on;
    sound.click();
  }

  toggleArrows() {
    if (this.state.mode === 'world') this.plenary.arrows = !this.plenary.arrows;
    else this.kit.arrows = !this.kit.arrows;
    if (this.state.mode === 'world') this.kit.arrows = this.plenary.arrows;
    sound.click();
  }

  pressStartStop() {
    const k = this.kit;
    const r = k.startStop();
    sound.beep();
    if (r === 'start') {
      if (this.state.mode !== 'lab') this.setMode('lab', true);
      return;
    }
    const res = k.result();
    if (!res || res.n < 3) {
      this.explain({ kicker: 'STOPWATCH', title: 'Count More Turns', text: 'Start the stopwatch, tap “Count a turn” each time the ball passes you, and stop it after 10 turns or more.' });
      return;
    }
    this.state.runs.push(res);
    const ideal = idealRps(res.m, res.L, res.M);
    const gateBit = res.gate ? ` The light gate read ${res.gate.toFixed(2)}: your timing was ${Math.abs(res.f - res.gate) / res.gate < 0.05 ? 'very close' : `${Math.round((Math.abs(res.f - res.gate) / res.gate) * 100)}% out`}.` : '';
    const steadyBit = res.steady < 0.7 ? ' The clip was not in place for much of it, so this result is less reliable.' : '';
    this.explain({ kicker: 'RESULT', title: `${res.f.toFixed(2)} turns per second`, text: `${res.n} turns in ${res.t.toFixed(2)} s with the ${res.m} g ball on ${res.L.toFixed(1)} m.${gateBit}${steadyBit}${this.state.level === 'advanced' ? ` Theory says ${ideal.toFixed(2)}.` : ''}` });
    sound.bond();
  }

  pressCount() {
    if (this.kit.countTurn()) sound.click();
  }

  pressReset() {
    this.kit.resetWatch();
    sound.click();
  }

  // ───────────── real world ─────────────

  markDone(id) {
    if (!this.state.done.includes(id)) this.state.done.push(id);
  }

  cutOrRetie() {
    const k = this.kit;
    if (k.cut) {
      k.retie();
      sound.click();
      return;
    }
    if (!k.cutString()) {
      this.explain({ kicker: 'NOT YET', title: 'Spin It First', text: 'Get the ball going round (press Faster, or swirl it), then cut the string.' });
      return;
    }
    this.markDone('ball');
    this.explain({ kicker: 'SNIP', title: 'Straight On, Along the Tangent', text: 'With no string pulling it towards the centre, nothing turns it any more: it carries straight on in the direction it was moving (the dashed line), falling as it goes. It does not fly straight outwards.' });
  }

  gravityOff() {
    if (!this.plenary.satellite.release()) return;
    fxBoom();
    this.markDone('satellite');
    this.explain({ kicker: 'NO GRAVITY', title: 'The Satellite Flies Off', text: 'Gravity was the only force pulling it towards Earth. Without it, the satellite carries straight on along the tangent, like the ball when the string is cut.' });
  }

  iceRoad() {
    if (!this.plenary.car.release()) return;
    this.plenary.ice.visible = true;
    fxBoom();
    this.markDone('car');
    this.explain({ kicker: 'ICE', title: 'The Car Slides Straight On', text: 'On ice the tyres cannot grip, so there is almost no friction pushing the car towards the centre of the bend. It carries straight on, along the tangent. That is why we slow down for bends in icy weather.' });
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
      askAI(`Student is in a physics lesson on circular motion: spinning a ball on a string through a tube with a hanging weight, timing turns per second for different masses and string lengths (activity: ${this.state.mode}).`)
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

  boardView() {
    const d = this.demo;
    if (d.mode === 'predict') {
      const ch = this.challenge(d);
      const t = this.tally(ch);
      return { kind: 'predict', ch: { title: ch.title, q: ch.q, options: ch.options, answer: ch.answer, why: ch.why, revealed: ch.revealed, counts: ch.revealed ? t.counts : ch.options.map(() => 0), votes: t.votes } };
    }
    if (d.mode === 'world') return { kind: 'world', done: this.state.done };
    const runs = this.state.runs.map((r) => ({ m: r.m, L: r.L, M: r.M, f: r.gate ?? r.f, me: true }));
    for (const p of this.presence?.peers.values() ?? []) for (const r of p.replica?.r ?? []) runs.push({ m: r[0], L: r[1], M: r[2], f: r[3], me: false });
    return { kind: 'results', runs, count: runs.length, adv: d.level === 'advanced' };
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
          { id: 'board-centre', label: 'Middle of Room', active: centred, disabled: !this.presence.roomToWorld, onClick: () => this.moveBoard(null) },
          { id: 'board-here', label: 'In Front of Me', disabled: !this.presence.roomToWorld, onClick: () => this.moveBoard('here') },
        ],
      });
    }
    const peers = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.n != null);
    sections.push({ heading: 'Class progress', text: `Results recorded: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.n}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
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
      r: this.state.runs.slice(-24).map((r) => [r.m, r.L, r.M, Math.round((r.gate ?? r.f) * 1000) / 1000]),
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
    const t = this.kit.targets.filter((o) => !(this.state.mode === 'world' && (o.userData.rack || o.userData.startStop || o.userData.count || o.userData.reset)));
    return [...t, ...this.plenary.targets];
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
    const real = Math.min(0.1, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    this.kit.update(real, this.floorY());
    this.plenary.update(real);
    for (const b of this.kit.rack) {
      if (b.userData.hidden == null) continue;
      b.visible = !b.userData.hidden && b.userData.sphere.userData.rack !== this.kit.m;
      b.userData.cup.visible = !b.userData.hidden;
    }

    this.liveClock = (this.liveClock ?? 0) + dt;
    if (this.liveClock > 0.2) {
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

function fxBoom() {
  sound.power();
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
