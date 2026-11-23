import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { studioReflections } from '../../../shared/util/reflections.js';
import { PAINTINGS, QUIZ } from './data/paintings.js';
import { Gallery } from './model/Gallery.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Art Gallery (seated): from the Inspired lesson plan "Seated Art Gallery". Twelve famous paintings come to the
// student's desk one at a time, on an easel, at their real size whenever it fits (the Mona Lisa really is that
// small); the large ones can also be seen at true size, standing behind the desk. Each painting has one or two
// glowing details to look closer at, its story, and a timeline with the world events around it. Guess the
// Painting: a tiny part slowly zooms out until someone recognises it. The teacher can show everyone a painting.

const GAME_S = 22; // seconds for a close-up to zoom all the way out

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.5, 1.35), camTarget: new THREE.Vector3(0, 1.25, 0) });
    this.state = {
      ...this.state,
      mode: 'gallery',
      painting: 'starry',
      trueSize: false,
      quiz: { i: 0, picked: null, score: 0 },
      game: { round: 0, id: null, options: [], answer: null, score: 0, played: 0, points: 0, t: 0, seen: [] },
      explain: {
        title: 'Welcome to the Art Gallery',
        text: 'Twelve famous paintings come to your desk, one at a time, at their real size whenever they fit. Pick one on the left, and look for the glowing rings: they mark details worth a closer look.',
      },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.62, height: 0.22, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.6, 0.12);
    this.explainPanel.mesh.rotation.x = 0.18;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];
    studioReflections(this); // gold frames and varnish catch the light
    this.gallery = new Gallery(this);
    this.gallery.show(this.state.painting);
    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  /** The painting on the easel: the teacher's while they show everyone, otherwise mine (or the game's). */
  get painting() {
    const id = this.teacherShow ?? (this.state.mode === 'guess' && this.state.game.id ? this.state.game.id : this.state.painting);
    return PAINTINGS.find((p) => p.id === id) ?? PAINTINGS[0];
  }

  setMode(mode) {
    this.state.mode = mode;
    this.state.trueSize = false;
    this.gallery.setTrueSize(false);
    if (mode === 'guess') {
      this.explain({ title: 'Guess the Painting', text: 'A tiny part of a painting appears on the easel and slowly zooms out. Pick its name on the right as soon as you recognise it.' });
      this.newRound();
    } else if (mode === 'quiz') {
      this.gallery.zoom = 1;
      this.explain({ title: 'Quiz', text: 'Eight questions about the paintings: what you saw, how they were made and when. Answer on the right.' });
    } else {
      this.gallery.zoom = 1;
      this.explain({ title: 'The Gallery', text: 'Pick a painting on the left. Look for the glowing rings on it, and read its story and its place in history on the right.' });
    }
    sound.click();
    this.refresh();
  }

  choose(id) {
    this.state.painting = id;
    this.state.trueSize = false;
    this.gallery.setTrueSize(false);
    this.state.explain = null;
    sound.click();
    this.refresh();
  }

  step(d) {
    const i = PAINTINGS.findIndex((p) => p.id === this.state.painting);
    this.choose(PAINTINGS[(i + d + PAINTINGS.length) % PAINTINGS.length].id);
  }

  toggleTrueSize() {
    this.state.trueSize = !this.state.trueSize;
    this.gallery.setTrueSize(this.state.trueSize);
    if (this.state.trueSize) {
      const p = this.painting;
      this.explain({ title: 'True Size', text: `${p.title} at its real size, ${p.w} × ${p.h} cm, stands behind your desk. Look up and around it.` });
    }
    sound.click();
    this.refresh();
  }

  onHotspot(p, i) {
    const h = p.hotspots[i];
    sound.tap();
    this.explain({ title: h.title, text: h.text });
  }

  // ───────────── guess the painting ─────────────

  newRound() {
    const g = this.state.game;
    if (g.round && g.answer == null) g.played++; // skipped
    // a painting not seen yet this game (then start again), and a close-up somewhere interesting in it
    const left = PAINTINGS.filter((p) => !g.seen.includes(p.id));
    const pick = (left.length ? left : PAINTINGS)[Math.floor(Math.random() * (left.length || PAINTINGS.length))];
    if (!left.length) g.seen = [];
    g.seen.push(pick.id);
    const others = PAINTINGS.filter((p) => p.id !== pick.id).sort(() => Math.random() - 0.5).slice(0, 3).map((p) => p.id);
    Object.assign(g, { round: g.round + 1, id: pick.id, options: [pick.id, ...others].sort(() => Math.random() - 0.5), answer: null, t: 0, points: 0 });
    const spot = pick.hotspots[Math.floor(Math.random() * pick.hotspots.length)];
    this.gallery.focus.set(spot.u, spot.v);
    this.gallery.zoom = 0.07;
    this.refresh();
  }

  guess(id) {
    const g = this.state.game;
    if (g.answer != null) return;
    g.answer = id;
    g.played++;
    if (id === g.id) {
      g.points = Math.max(1, Math.round(10 * (1 - g.t / GAME_S)));
      g.score += g.points;
      sound.correct();
    } else sound.wrong();
    this.gallery.zoom = 1;
    this.refresh();
  }

  // ───────────── quiz ─────────────

  answer(i) {
    const q = this.state.quiz;
    if (q.picked != null) return;
    q.picked = i;
    const right = i === QUIZ[q.i].answer;
    if (right) q.score++;
    sound[right ? 'correct' : 'wrong']();
    this.refresh();
  }

  nextQuestion() {
    const q = this.state.quiz;
    q.i++;
    q.picked = null;
    if (q.i >= QUIZ.length) this.explain({ title: `Quiz Done: ${q.score} of ${QUIZ.length}`, text: 'Which painting would you most like to see in a real gallery, and why?' });
    this.refresh();
  }

  restartQuiz() {
    this.state.quiz = { i: 0, picked: null, score: 0 };
    this.set({ explain: null });
    this.refresh();
  }

  // ───────────── the teacher shows everyone a painting ─────────────

  adminLessonButtons() {
    const p = this.painting;
    return [{
      heading: 'Show everyone',
      text: this.showAll ? `Everyone is looking at ${p.title}. Pick another painting to move them all to it.` : 'Bring every student to the painting on your easel, to look at it together.',
      buttons: [{ id: 'admin-showall', label: this.showAll ? 'Showing Everyone (Tap to Stop)' : `Show Everyone ${p.title}`, active: !!this.showAll, onClick: () => this.toggleShowAll() }],
    }];
  }

  toggleShowAll() {
    this.showAll = !this.showAll;
    if (this.showAll && this.state.mode !== 'gallery') this.setMode('gallery');
    sound.click();
    this.broadcastAdmin();
    this.refresh();
  }

  adminLessonState() {
    return { show: this.showAll ? this.state.painting : null };
  }

  onAdminLesson(l) {
    const id = l?.show && PAINTINGS.some((p) => p.id === l.show) ? l.show : null;
    if (id === (this.teacherShow ?? null)) return;
    const was = this.teacherShow;
    this.teacherShow = id;
    if (id && !was) this.explain({ title: 'Look Together', text: 'Your teacher is showing everyone this painting. Look for the glowing rings, and read its story on the right.' });
    this.refresh();
  }

  // ───────────── shared sessions ─────────────

  netState() {
    return { p: this.painting.id };
  }

  createReplica() {
    return { group: new THREE.Group(), apply() {} };
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    return this.gallery.targets;
  }

  refresh() {
    const p = this.painting;
    if (this.gallery.current?.id !== p.id || this.lastMode !== this.state.mode || this.lastZoom !== this.gallery.zoom) {
      this.lastMode = this.state.mode;
      this.lastZoom = this.gallery.zoom;
      this.gallery.show(p.id);
    }
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  update(dt) {
    const g = this.state.game;
    if (this.state.mode === 'guess' && g.round && g.answer == null && !this.teacherShow) {
      // the close-up zooms slowly out
      g.t = Math.min(GAME_S, g.t + dt);
      const k = g.t / GAME_S;
      this.gallery.zoom = 0.07 + (1 - 0.07) * k * k;
      this.gallery.applyZoom();
    }
    this.gallery.update(dt);
    this.gallery.desk.visible = !this.presenting; // in the headset, the student's real desk takes its place
    if (this.isAdmin) {
      const json = JSON.stringify(this.adminLessonState());
      if (json !== this.lastAdminJson) {
        this.lastAdminJson = json;
        this.broadcastAdmin();
      }
    }
  }
}

window.app = new App();
