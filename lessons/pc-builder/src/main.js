import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { studioReflections } from '../../../shared/util/reflections.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { CASES } from './data/parts.js';
import { emptyBuild } from './data/rules.js';
import { PCBuild } from './model/PCBuild.js';
import { PartsTray } from './model/PartsTray.js';
import { PARTS, CATEGORIES } from './data/parts.js';
import { caseMesh, partMesh, ghostOf, radiatorMesh } from './model/parts3d.js';
import { makeLabel } from '../../../shared/ui/labels.js';
import { bootScript, TourFX } from './model/boot.js';
import { drawControls, drawInfo, drawCard } from './ui/panels.js';
import * as T from './ui/explain.js';

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.15, 0), camPos: new THREE.Vector3(0, 1.28, 1.12) });
    this.state = {
      ...this.state,
      build: emptyBuild('mid'),
      trayCat: 'board',
      labels: false,
      power: 'off', // off | booting | on | failed
      booted: false, // has this exact build started successfully?
      screen: { lines: [], note: null, desktop: false },
      tourStep: null,
      tech: { qid: null, answer: null },
      explain: {
        title: 'Build Your Own Computer',
        text: 'Start with a motherboard: pick it up from the tray and bring it into the case — when the preview turns green, let go. Then add the CPU, cooler, RAM, storage, graphics card and power supply. Press Power to test it.',
      },
    };
    // What the admin has chosen for everyone (shared sessions): a fixed case or free choice, and
    // counters for one-off commands ("turn every PC off", "empty every case").
    this.pcAdmin = { case: null, off: 0, reset: 0 };
    this.initLesson();
    this.start();
  }

  initLesson() {
    // A taller card than other lessons: it also acts as the computer's monitor.
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.3, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.47, -0.08);
    this.explainPanel.mesh.rotation.x = 0.2;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];
    this.controlPanel.mesh.position.y = 0.02;
    this.infoPanel.mesh.position.y = 0.02;

    // A work lamp so you can see inside the case.
    const lamp = new THREE.PointLight(0xffffff, 1.6, 1.6, 1.2);
    lamp.position.set(0.1, 0.25, 0.45);
    this.lab.add(lamp);
    // soft studio reflections, so metal parts (heatsinks, brackets, the heat spreaders) look like metal
    studioReflections(this);

    this.pc = new PCBuild(this);
    this.lab.add(this.pc.group);
    this.tray = new PartsTray(this.pc);
    this.lab.add(this.tray.group);
    this.tour = new TourFX(this);
    this.pc.rebuild();

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  // ───────────── actions (from panels and the 3D scene) ─────────────

  set(patch) {
    super.set(patch);
    if ('trayCat' in patch) this.state.tech = { qid: null, answer: null };
  }

  explain(e) {
    this.state.tech = { qid: null, answer: null };
    super.explain(e);
  }

  setCase(id) {
    if (id === this.state.build.case) return;
    if (this.isAdmin && this.pcAdmin.case) {
      this.pcAdmin.case = id; // the admin's case is everyone's case
      this.broadcastAdmin();
    }
    this.powerOff();
    const dropped = this.pc.changeCase(id);
    this.state.booted = false;
    this.explain(T.caseChanged(id, CASES[id], dropped));
  }

  emptyCase() {
    this.powerOff();
    this.state.build = emptyBuild(this.state.build.case);
    this.state.booted = false;
    this.pc.rebuild();
    this.explain({ title: 'Empty Case', text: 'All parts are back in the tray. Start with the motherboard.' });
  }

  toggleLabels() {
    this.state.labels = !this.state.labels;
    this.pc.drawLabels();
  }

  ask(qid) {
    this.state.tech = { qid, answer: T.ANSWERS[qid] };
    this.say(T.ANSWERS[qid]);
  }

  /**
   * The class copy of a bench (shared/net/LabMirror.js): the case, the parts, their labels and outlines, the tray
   * and the tour's flows are made afresh as the build changes (each tagged with userData.mirror where it is made).
   * This makes one of a type, for a copy whose own lab does not have it. Only known part and case names are used.
   */
  mirrorMake(type) {
    const [kind, a, b, ...rest] = String(type).split(':');
    const part = PARTS[a] ? a : null;
    const flow = { power: 0xffd166, data: 0x4cc9ff, image: 0x7ee2a8, heat: 0xff6b4a };
    if (kind === 'case' && CASES[a]) return caseMesh(a);
    if ((kind === 'part' || kind === 'tray' || kind === 'held') && part) {
      const m = partMesh(part);
      if (kind === 'part') return m;
      const g = new THREE.Group(); // (the part inside a holder: its own place and size come with the copy)
      g.add(m);
      return g;
    }
    if (kind === 'rad' && CASES[a] && rest.length === 3) return radiatorMesh(CASES[a], new THREE.Vector3(...rest.map(Number)), Number(b) || 240);
    if ((kind === 'marker' || kind === 'ghost') && part) {
      const g = ghostOf(part, b === '1');
      if (kind === 'marker') g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.opacity = 0.12; } });
      return g;
    }
    if (kind === 'label' && part) {
      const tag = makeLabel(`${CATEGORIES[PARTS[part].cat].name}\n${PARTS[part].short}`, { height: 0.034, size: 40 });
      tag.material.depthTest = false;
      tag.renderOrder = 6;
      return tag;
    }
    if (kind === 'traylabel' && part) return makeLabel(PARTS[part].short, { height: 0.022, size: 40 });
    if (kind === 'shelf') return new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.01, 0.13), this.tray.shelfMat);
    if (kind === 'dot' && flow[a]) return new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: flow[a], toneMapped: false }));
    if (kind === 'flowline' && flow[a]) return new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: flow[a], transparent: true, opacity: 0.35 }));
    if (kind === 'glow') return new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending }));
    return null;
  }

  grabTargets() {
    return [...this.pc.grabTargets, ...this.tray.grabTargets];
  }

  // ───────────── admin ─────────────

  /** The lesson's part of the Admin menu. */
  adminLessonButtons() {
    const a = this.pcAdmin;
    const armed = this.emptyArmed && performance.now() - this.emptyArmed < 3000;
    return [
      {
        heading: 'Case for everyone',
        buttons: [
          { id: 'admin-case-free', label: 'Free Choice', active: !a.case, onClick: () => this.adminCase(null) },
          ...Object.entries(CASES).map(([id, c]) => ({ id: `admin-case-${id}`, label: c.short, active: a.case === id, onClick: () => this.adminCase(id) })),
        ],
        cols: 2,
      },
      {
        heading: 'Every computer',
        buttons: [
          { id: 'admin-off', label: 'Turn All Off', onClick: () => this.adminAll('off') },
          { id: 'admin-empty', label: armed ? 'Sure? Press Again' : 'Empty All Cases', active: armed, onClick: () => this.adminAll('reset') },
        ],
      },
    ];
  }

  /** Admin: everyone uses this case (null: everyone chooses their own). */
  adminCase(id) {
    this.pcAdmin.case = id;
    if (id) this.setCase(id);
    this.broadcastAdmin();
    this.refresh();
  }

  /** Admin: switch off / empty everyone's computer (emptying needs a second press). */
  adminAll(what) {
    if (what === 'reset') {
      const armed = this.emptyArmed && performance.now() - this.emptyArmed < 3000;
      if (!armed) {
        this.emptyArmed = performance.now();
        setTimeout(() => this.refresh(), 3100);
        return;
      }
      this.emptyArmed = 0;
      this.emptyCase();
    } else {
      this.powerOff();
      this.explain({ title: 'Every Computer Is Off', text: 'You switched off everyone’s computer.' });
    }
    this.pcAdmin[what]++;
    this.broadcastAdmin();
    this.refresh();
  }

  adminLessonState() {
    return { ...this.pcAdmin };
  }

  /** Students: follow the admin's case, and their "turn off" / "empty" commands. */
  onAdminLesson(l) {
    if (!l) return;
    const seen = this.seenAdmin;
    this.seenAdmin = { off: l.off, reset: l.reset };
    let changed = false;
    if ((l.case ?? null) !== this.pcAdmin.case) {
      this.pcAdmin.case = l.case ?? null;
      changed = true;
    }
    if (l.case && CASES[l.case] && l.case !== this.state.build.case) this.setCase(l.case);
    // one-off commands: only ones given after I joined (the first message just says where the counters are)
    if (seen && l.reset !== seen.reset) {
      this.emptyCase();
      this.explain({ title: 'Start Again', text: `${this.adminName} emptied every case. All the parts are back in the tray — start with the motherboard.` });
      changed = true;
    } else if (seen && l.off !== seen.off && this.state.power !== 'off') {
      this.powerOff();
      this.explain({ title: 'Computer Off', text: `${this.adminName} switched every computer off.` });
      changed = true;
    }
    if (changed) this.refresh();
  }

  // ───────────── shared sessions ─────────────

  netState() {
    return { build: this.state.build, on: this.powered ? 1 : 0 };
  }

  /** A colleague's PC: the same model, driven by the build they share. */
  createReplica() {
    const view = { state: { build: emptyBuild('mid'), labels: false } };
    const pc = new PCBuild(view);
    pc.rebuild();
    let key = '';
    let on = false;
    return {
      group: pc.group,
      apply(s) {
        on = !!s.on;
        const k = JSON.stringify(s.build);
        if (k === key) return;
        key = k;
        view.state.build = JSON.parse(k);
        pc.rebuild();
      },
      update: (dt) => pc.animate(dt, on),
    };
  }

  // ───────────── power ─────────────

  togglePower() {
    if (this.state.power === 'off') this.powerOn();
    else this.powerOff();
    this.refresh();
  }

  powerOn() {
    if (this.state.power !== 'off') return;
    this.endTour();
    const script = bootScript(this.state.build);
    this.state.power = 'booting';
    this.state.screen = { lines: [], note: null, desktop: false };
    sound.power();
    // the fans spin up as soon as there is power (even if it then fails to start)
    (this.fans ??= sound.loop('hum')).set(0.7);
    let i = 0;
    const next = () => {
      if (this.state.power !== 'booting') return;
      const step = script[i++];
      if (!step) return;
      this.state.screen.lines.push(step);
      if (step.desktop) this.state.screen.desktop = true;
      if (step.explain) {
        this.state.screen.note = step.explain;
        this.say(`${step.explain.title}. ${step.explain.text}`);
      }
      if (step.text.startsWith('BEEP')) [0, 350, 700].forEach((t) => setTimeout(sound.beep, t));
      else if (step.kind === 'bad') sound.refuse();
      if (step.stop) {
        this.state.power = 'failed';
        this.interaction.pulseAll(0.8, 200);
      } else if (step.done) {
        this.state.power = 'on';
        this.state.booted = true;
        this.celebrate();
        if (!this.state.screen.note) this.state.screen.note = { title: 'It Works', text: 'Every part is doing its job. Press “How it works” to watch power, data and heat flow between them.' };
      } else {
        this.bootTimer = setTimeout(next, step.wait * 1000);
      }
      this.refresh();
    };
    this.bootTimer = setTimeout(next, 500);
  }

  /** Switch off. `safety` = someone reached inside while it was on. */
  powerOff(safety = false) {
    clearTimeout(this.bootTimer);
    const wasOn = this.state.power !== 'off';
    this.state.power = 'off';
    this.fans?.set(0);
    this.state.screen = { lines: [], note: null, desktop: false };
    this.endTour();
    if (safety && wasOn) this.state.explain = T.SAFETY;
  }

  get powered() {
    const s = this.state;
    return (s.power === 'booting' || s.power === 'on') && s.build.psu && s.build.board;
  }

  // ───────────── how it works (guided tour) ─────────────

  startTour() {
    if (!this.state.booted) return;
    if (this.state.power !== 'on') {
      // Restart it quietly so the parts are running during the tour.
      this.state.power = 'on';
    }
    this.state.tourStep = 0;
    this.tour.show(T.TOUR[0]);
    this.say(`${T.TOUR[0].title}. ${T.TOUR[0].text}`);
  }

  tourGo(d) {
    const n = this.state.tourStep + d;
    if (n >= T.TOUR.length) {
      this.endTour();
      this.state.explain = { title: 'That Is a Working Computer', text: 'Power from the PSU, start-up from the motherboard’s BIOS, programs loaded from storage into RAM, the CPU processing them, graphics drawing the picture, and the cooler keeping everything safe — every part depends on the others.' };
    } else {
      this.state.tourStep = Math.max(0, n);
      this.tour.show(T.TOUR[this.state.tourStep]);
      this.say(`${T.TOUR[this.state.tourStep].title}. ${T.TOUR[this.state.tourStep].text}`);
    }
    this.refresh();
  }

  endTour() {
    this.state.tourStep = null;
    this.tour.clear();
  }

  // ───────────── drawing ─────────────

  refresh() {
    const s = this.state;
    this.tray.show(s.trayCat);
    this.explainPanel.mesh.visible = !!s.explain || s.power !== 'off' || s.tourStep != null;
    this.redrawPanels();
  }

  update(dt) {
    this.pc.animate(dt, this.powered);
    this.tour.update(dt);
  }
}

window.app = new App();
