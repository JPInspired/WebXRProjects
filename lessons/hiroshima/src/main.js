import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { sound } from '../../../shared/util/sound.js';
import { City } from './world/City.js';
import { Atmosphere } from './world/Atmosphere.js';
import { Fires } from './world/Fires.js';
import { Blast } from './world/Blast.js';
import { PARK } from './world/layout.js';
import { Walker } from './Walker.js';
import { LessonAudio } from './audio.js';
import { ERA, MARKERS, QUIZ, UI, START } from './data/text.js';
import { drawControls, drawInfo, drawCard } from './ui/panels.js';

// Hiroshima, 6 August 1945: a virtual-reality visit for The Flowers of Hiroshima (Edita Morris, 1959), asked for
// by a Greek school's Year 2 Gymnasium literature teachers. One place, the streets round the Industrial Promotion
// Hall and the Aioi Bridge, in five moments: the morning of 6 August 1945, 8:15 (the explosion, the blast wave
// and the cloud), the same afternoon, the rebuilt city of 1958 (the world of the novel) and today. Walk anywhere,
// point at the ⓘ markers, read in English or Greek, answer the quiz, discuss the questions on the text, leave a
// paper crane at the Children's Peace Monument and ring the Peace Bell. The teacher can bring everyone to the
// same moment, and start 8:15 for the whole class at once.

const TURNS = [{ label: '30°', angle: Math.PI / 6 }, { label: '45°', angle: Math.PI / 4 }, { label: 'smooth', angle: 0 }];
const LANG_KEY = 'webxr-classes:hiroshima-lang';
const CRANE_COLOURS = [0xe0485f, 0xf2a33a, 0xf4d35e, 0x5ab06a, 0x3f8fd6, 0x8f6bd6, 0xf28ab8, 0xf6f1e4];

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.4, 0), camPos: new THREE.Vector3(0, 1.6, 0), background: 0x9fb8cc });
    let lang = new URLSearchParams(location.search).get('lang');
    try { lang ??= localStorage.getItem(LANG_KEY); } catch { /* no storage */ }
    this.state = {
      ...this.state,
      era: 'before',
      lang: lang === 'el' ? 'el' : 'en',
      selected: null,
      markers: true,
      flash: true,
      turn: 0,
      panels: true,
      quiz: { i: 0, picked: null, score: 0 },
    };
    this.menuTab = 'moments';
    this.myCranes = [];
    this.craneColour = CRANE_COLOURS[Math.floor(Math.random() * CRANE_COLOURS.length)];
    // the lesson brings its own sky and light: remove the shared ones
    for (const o of [...this.scene.children]) if (o.isLight) this.scene.remove(o);
    this.grid.visible = false;
    this.camera.fov = 70;
    this.camera.near = 0.1;
    this.camera.far = 60000;
    this.camera.updateProjectionMatrix();
    this.controls.dispose();
    this.controls = { enabled: true, target: new THREE.Vector3(), update() {} };
    this.keys = new Set();
    this.ownMenuToggle = true; // B / Y hide the panels here (see updateXR)

    this.audio = new LessonAudio();
    this.city = new City(this);
    this.atmos = new Atmosphere(this);
    this.fires = new Fires(this.scene);
    this.walker = new Walker(this);
    this.blast = new Blast(this);
    this.buildMarkers();
    this.buildCranes();
    this.buildTeleportRings();
    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
    this.initDesktopControls();
    this.setEra('before', { quiet: true });
    this.walker.teleportDesk(START.pos, START.look, false);
    this.state.explain = { title: ERA.before[this.state.lang].title, text: ERA.before[this.state.lang].text };
    this.ready = true;
    this.start();
  }

  // ───────────── moments ─────────────

  /** Show a moment's city, sky, fires and markers (without changing the lesson's state). */
  showEra(era, { blast = false, keepLook = false } = {}) {
    const visual = era === 'blast' ? 'before' : era;
    const e = this.city.show(visual);
    this.walker.walk = e.walk;
    if (!keepLook) this.atmos.set(visual);
    else this.atmos.apply();
    this.fires.setSpots(e.fires ?? []);
    this.fires.level = visual === 'after' ? 1 : 0;
    this.fires.visible = visual === 'after';
    if (!blast) this.audio.ambience(visual);
    else if (visual === 'after') this.audio.ambience('after');
    this.markerEra = visual;
    this.bellPick.visible = visual === 'today';
    this.updateCranes();
  }

  /** Choose a moment (from the menu, or the teacher's Show Everyone). */
  chooseEra(id) {
    if (this.followsTeacherMoment && !this.applyingTeacher) return;
    sound.click();
    this.setEra(id);
  }

  setEra(id, { quiet = false, offset = 0 } = {}) {
    if (this.blast.running) this.blast.stop(true);
    this.walker.free = false;
    this.state.era = id;
    this.state.selected = null;
    if (id === 'blast') {
      this.playBlast(offset);
    } else {
      this.showEra(id);
      this.keepClear();
      if (!quiet) this.explain({ title: ERA[id][this.state.lang].title, text: ERA[id][this.state.lang].text });
    }
    this.refresh();
  }

  /** Play 8:15 from where you are standing. */
  playBlast(offset = 0) {
    this.state.era = 'blast';
    this.state.selected = null;
    this.blast.start(offset);
    if (this.isAdmin && this.showAll) this.blastRun = (this.blastRun ?? 0) + 1;
    this.refresh();
  }

  blastCaption(cap) {
    this.state.explain = { title: '8:15', text: cap[this.state.lang] };
    this.say(cap[this.state.lang]);
    this.refresh();
  }

  blastFinished() {
    this.walker.free = false;
    this.state.era = 'after';
    this.showEra('after');
    this.keepClear();
    this.explain({ title: ERA.after[this.state.lang].title, text: ERA.after[this.state.lang].text });
  }

  /** If the new moment has something standing where you are (a house, a heap of rubble), step to the nearest free ground. */
  keepClear() {
    const [x, , z] = this.viewerFeet();
    if (this.walker.ok(x, z)) return;
    for (let r = 1; r < 40; r++) {
      for (let a = 0; a < 16; a++) {
        const nx = x + Math.cos((a / 16) * Math.PI * 2) * r, nz = z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (this.walker.ok(nx, nz)) return this.moveViewer([nx, 0, nz], null);
      }
    }
    this.moveViewer(START.pos, START.look);
  }

  // ───────────── where you are ─────────────

  viewerFeet() {
    if (this.presenting && this.walker.baseRef) {
      const { world } = this.walker.head();
      return [world.x, this.walker.origin.y, world.z];
    }
    const d = this.walker.desk;
    return [d.x, d.y, d.z];
  }

  viewerHead() {
    const cam = this.presenting ? this.renderer.xr.getCamera() : this.camera;
    return cam.getWorldPosition(new THREE.Vector3());
  }

  moveViewer(pos, look) {
    this.walker.free = pos[1] > 1; // (up in the hills during 8:15: nowhere to walk)
    if (this.presenting) {
      this.walker.teleportXR(pos, look);
      this.labSnap = true;
    } else this.walker.teleportDesk(pos, look, false);
  }

  teleport(pos, look = null) {
    if (this.presenting) {
      this.walker.teleportXR(pos, look);
      this.labSnap = true;
    } else this.walker.teleportDesk(pos, look);
  }

  goToPlace(p) {
    sound.click();
    this.teleport(p.pos, p.look);
  }

  goToMarker(id) {
    const m = MARKERS.find((x) => x.id === id);
    if (!m) return;
    this.select(id);
    this.teleport(m.view.pos, m.view.look);
  }

  // ───────────── markers ─────────────

  buildMarkers() {
    const tex = markerTexture();
    this.markerSprites = [];
    this.colliders = [];
    const hidden = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    for (const m of MARKERS) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
      s.position.set(...m.at);
      const size = 1.6 + m.at[1] * 0.04;
      s.scale.setScalar(size);
      s.renderOrder = 7;
      s.userData = { marker: m, size };
      const pick = new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 10, 8), hidden);
      pick.position.copy(s.position);
      Object.assign(pick.userData, { handler: this, marker: m.id, tapOnly: true, eras: m.eras });
      this.scene.add(s, pick);
      this.markerSprites.push(s);
      this.colliders.push(pick);
    }
    // the Peace Bell's log (today)
    this.bellPick = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), hidden);
    this.bellPick.position.set(PARK.bell[0] - 1.9, 2.2, PARK.bell[1]);
    Object.assign(this.bellPick.userData, { handler: this, bell: true, tapOnly: true });
    this.scene.add(this.bellPick);
  }

  grabTargets() {
    const era = this.markerEra;
    const list = this.colliders.filter((c) => c.userData.eras.includes(era) && this.state.markers && !this.blast.running);
    for (const c of this.colliders) c.visible = list.includes(c);
    if (this.bellPick.visible) list.push(this.bellPick);
    return list;
  }

  describe(o) {
    if (o.userData.bell) return UI[this.state.lang].bellRung;
    return MARKERS.find((m) => m.id === o.userData.marker)?.[this.state.lang].title ?? '';
  }

  tap(o) {
    if (o.userData.bell) return this.ringBell();
    if (o.userData.marker) this.select(o.userData.marker);
  }

  select(id) {
    this.state.selected = id;
    this.state.panels = true;
    this.menuTab = this.menuTab === 'text' || this.menuTab === 'quiz' ? 'moments' : this.menuTab;
    this.infoPanel.scroll = 0;
    this.interaction?.pulse(0.4, 30);
    sound.tap();
    this.refresh();
  }

  toggleMarkers() {
    this.state.markers = !this.state.markers;
    this.refresh();
  }

  // ───────────── language, settings, tabs ─────────────

  toggleLanguage() {
    this.state.lang = this.state.lang === 'en' ? 'el' : 'en';
    try { localStorage.setItem(LANG_KEY, this.state.lang); } catch { /* not remembered */ }
    const era = this.state.era;
    if (this.state.explain && !this.blast.running) this.state.explain = { title: ERA[era][this.state.lang].title, text: ERA[era][this.state.lang].text };
    sound.click();
    this.refresh();
  }

  toggleFlash() {
    this.state.flash = !this.state.flash;
    this.refresh();
  }

  setTab(id) {
    this.menuTab = id;
    this.infoPanel.scroll = 0;
    if (id === 'text' || id === 'quiz') this.state.selected = null;
    sound.click();
    this.refresh();
  }

  turnLabel() {
    return TURNS[this.state.turn].label;
  }

  cycleTurn() {
    this.state.turn = (this.state.turn + 1) % TURNS.length;
    this.refresh();
  }

  togglePanels() {
    this.state.panels = !this.state.panels;
    if (this.state.panels) this.labSnap = true;
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
    if (q.i >= QUIZ.length) this.celebrate();
    this.refresh();
  }

  restartQuiz() {
    this.state.quiz = { i: 0, picked: null, score: 0 };
    this.refresh();
  }

  // ───────────── paper cranes and the bell ─────────────

  buildCranes() {
    // a folded paper crane: a body, two wings, the neck and tail (a few triangles, instanced)
    const v = [
      0, 0.05, -0.2, 0, 0.05, 0.2, 0, -0.07, 0, // body
      0, 0.05, -0.08, 0, 0.05, 0.08, -0.32, 0.14, 0, // left wing
      0, 0.05, 0.08, 0, 0.05, -0.08, 0.32, 0.14, 0, // right wing
      0, 0.05, -0.18, 0, 0.0, -0.1, 0, 0.26, -0.3, // neck
      0, 0.05, 0.18, 0, 0.0, 0.1, 0, 0.24, 0.3, // tail
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    this.cranes = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), 600);
    this.cranes.count = 0;
    this.cranes.frustumCulled = false;
    this.scene.add(this.cranes);
  }

  /** Everyone's cranes, from this headset and the others in the class. */
  allCranes() {
    const out = this.myCranes.map((c) => ({ c }));
    for (const p of this.presence?.peers?.values?.() ?? []) for (const c of p.replica?.cranes ?? []) out.push({ c });
    return out;
  }

  craneCount() {
    return this.allCranes().length;
  }

  updateCranes() {
    const list = this.allCranes();
    const show = this.markerEra === 'rebuilt' || this.markerEra === 'today';
    this.cranes.visible = show;
    const anchor = new THREE.Vector3(PARK.monument[0], 0, PARK.monument[1] - 6.2);
    const m = new THREE.Matrix4();
    list.slice(0, 600).forEach((it, i) => {
      // hung in strings in front of the glass booths
      const col = i % 24, row = Math.floor(i / 24) % 9, layer = Math.floor(i / 216);
      const x = anchor.x - 7 + col * 0.6 + (row % 2) * 0.3, y = 0.5 + row * 0.24, z = anchor.z + 0.05 + layer * 0.25;
      m.makeRotationY(((i * 2.3) % 1) - 0.5 + Math.PI / 2).setPosition(x, y, z);
      this.cranes.setMatrixAt(i, m);
      this.cranes.setColorAt(i, new THREE.Color(it.c));
    });
    this.cranes.count = Math.min(600, list.length);
    this.cranes.instanceMatrix.needsUpdate = true;
    if (this.cranes.instanceColor) this.cranes.instanceColor.needsUpdate = true;
  }

  leaveCrane() {
    if (this.myCranes.length >= 12) return; // (enough from one headset)
    this.myCranes.push(this.craneColour);
    this.updateCranes();
    this.teleport([PARK.monument[0], 0, PARK.monument[1] + 4], [PARK.monument[0], 1.5, PARK.monument[1] - 6]);
    const L = UI[this.state.lang];
    this.explain({ title: L.craneLeft, text: L.craneLeftText });
    sound.correct();
    this.refresh();
  }

  ringBell() {
    this.audio.bell();
    this.bellSwing = 1;
    this.interaction?.pulse(0.5, 80);
    const L = UI[this.state.lang];
    this.explain({ title: L.bellRung, text: L.bellRungText });
  }

  // ───────────── the teacher: show everyone a moment ─────────────

  get followsTeacherMoment() {
    return !!this.teacherShow && !this.isAdmin;
  }

  adminLessonButtons() {
    const L = UI[this.state.lang];
    const label = ERA[this.state.era][this.state.lang].label;
    return [{
      heading: L.showAll,
      text: this.showAll ? L.showAllText(label) : L.showAllOff,
      buttons: [{ id: 'admin-showall', label: this.showAll ? L.showingBtn : L.showBtn(label), active: !!this.showAll, onClick: () => this.toggleShowAll() }],
    }];
  }

  toggleShowAll() {
    this.showAll = !this.showAll;
    sound.click();
    this.broadcastAdmin();
    this.refresh();
  }

  adminLessonState() {
    if (!this.showAll) return { show: null };
    return { show: this.state.era, run: this.state.era === 'blast' ? this.blastRun ?? 0 : null, t: this.blast.running ? Math.floor(this.blast.t) : null };
  }

  onAdminLesson(l) {
    const era = l?.show && ERA[l.show] ? l.show : null;
    const was = this.teacherShow;
    this.teacherShow = era;
    if (!era) {
      if (was) this.refresh();
      return;
    }
    this.applyingTeacher = true;
    if (era === 'blast') {
      if (l.run !== this.lastRun) {
        this.lastRun = l.run;
        this.setEra('blast', { offset: l.t ?? 0 });
      }
    } else if (era !== this.state.era || was !== era) {
      this.setEra(era, { quiet: true });
      const L = UI[this.state.lang];
      this.explain({ title: L.lookTogether, text: `${ERA[era][this.state.lang].title}. ${L.lookTogetherText}` });
    }
    this.applyingTeacher = false;
    this.refresh();
  }

  // ───────────── shared sessions: everyone's cranes ─────────────

  netState() {
    return { era: this.state.era, cranes: this.myCranes };
  }

  createReplica() {
    const app = this;
    const rep = {
      group: new THREE.Group(),
      cranes: [],
      apply(snap) {
        const list = Array.isArray(snap?.cranes) ? snap.cranes.filter((c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff).slice(0, 12) : [];
        if (list.join() === rep.cranes.join()) return;
        rep.cranes = list;
        app.updateCranes();
        app.refresh();
      },
    };
    return rep;
  }

  // ───────────── headset ─────────────

  initXRButtons() {
    // a visit to another place and time: virtual reality only
    const btn = document.getElementById('btn-ar');
    const hint = document.getElementById('hint');
    btn.textContent = 'Checking for VR…';
    if (!('xr' in navigator)) {
      btn.textContent = 'VR Not Available';
      btn.classList.add('unavailable');
      if (hint) hint.textContent = 'Explore on screen: W A S D to walk, drag to look, click the ground to go there, click an ⓘ for its story.';
      return;
    }
    navigator.xr.isSessionSupported('immersive-vr').catch(() => false).then((vr) => {
      this.vrSupported = vr;
      btn.textContent = vr ? 'Enter VR' : 'VR Not Supported Here';
      btn.classList.toggle('unavailable', !vr);
      btn.disabled = !vr;
      btn.onclick = () => this.startSession('immersive-vr');
      if (hint) hint.textContent = vr ? 'Put on your headset and press “Enter VR”.' : 'Explore on screen: W A S D to walk, drag to look, click the ground to go there, click an ⓘ for its story.';
    });
  }

  initSessionUI(session) {
    super.initSessionUI(session);
    // (this lesson is entered in VR, not mixed reality)
    for (const el of document.querySelectorAll('#overlay .session-box *')) {
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.includes('Enter Mixed Reality')) n.textContent = n.textContent.replace('Enter Mixed Reality', 'Enter VR');
    }
  }

  onXRStart() {
    this.grid.visible = false;
    this.scene.background = this.background;
    this.walker.startXR();
    this.placedXR = false;
  }

  onXREnd() {
    this.walker.stopXR();
    this.renderer.xr.setReferenceSpace?.(null);
  }

  placeInFrontOfUser() {
    if (!this.placedXR) {
      const d = this.walker.desk;
      const look = [d.x - Math.sin(d.yaw) * 10, 1.6, d.z - Math.cos(d.yaw) * 10];
      this.walker.teleportXR([d.x, d.y, d.z], look);
      this.placedXR = true;
    }
    this.labSnap = true;
  }

  recenter() {
    if (this.presenting) this.labSnap = true;
    else this.walker.teleportDesk(START.pos, START.look);
  }

  buildTeleportRings() {
    this.rings = [0, 1].map(() => {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x7ee2ff, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
      g.add(new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40).rotateX(-Math.PI / 2), mat), new THREE.Mesh(new THREE.CircleGeometry(0.06, 20).rotateX(-Math.PI / 2), mat));
      g.visible = false;
      g.renderOrder = 8;
      this.scene.add(g);
      return g;
    });
  }

  onSelectNothing(c) {
    const p = c.userData.teleport;
    if (!p || this.blast.running) return;
    this.walker.teleportXR([p.x, 0, p.z]);
    this.labSnap = this.state.panels;
    this.interaction.pulse(0.3, 20, c);
  }

  updateXR(dt) {
    const w = this.walker;
    if (!w.baseRef) return;
    this.interaction.controllers.forEach((c, i) => {
      const src = c.userData.inputSource;
      const ring = this.rings[i];
      ring.visible = false;
      c.userData.teleport = null;
      if (!src || c.userData.mode !== 'tracked-pointer') return;
      const pad = src.gamepad;
      if (pad) {
        const [ax, ay] = [pad.axes[2] ?? 0, pad.axes[3] ?? 0];
        if (src.handedness === 'left') w.moveXR(-ay, ax, dt);
        else {
          const t = TURNS[this.state.turn];
          if (t.angle === 0) { if (Math.abs(ax) > 0.2) w.turnXR(-ax * dt * 1.8); }
          else if (Math.abs(ax) > 0.7 && !c.userData.turned) { w.turnXR(-Math.sign(ax) * t.angle); c.userData.turned = true; }
          else if (Math.abs(ax) < 0.3) c.userData.turned = false;
        }
        const menu = pad.buttons[5]?.pressed;
        if (menu && !c.userData.menuDown) this.togglePanels();
        c.userData.menuDown = !!menu;
      }
      if (this.interaction.active.has(c) || this.interaction.castFromController(c)) return;
      const from = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
      const dir = new THREE.Vector3(0, 0, -1).applyMatrix4(new THREE.Matrix4().extractRotation(c.matrixWorld));
      const hit = w.cast(from, dir, 80);
      if (!hit) return;
      c.userData.line.scale.z = hit.distanceTo(from);
      if (!w.standable(hit)) return;
      ring.position.copy(hit).add(new THREE.Vector3(0, 0.03, 0));
      ring.visible = true;
      c.userData.teleport = hit.clone();
    });
  }

  // ───────────── screen ─────────────

  initDesktopControls() {
    const dom = this.renderer.domElement;
    const shrink = () => document.getElementById('overlay')?.setMini?.(true);
    addEventListener('keydown', shrink, { once: true });
    dom.addEventListener('pointerdown', shrink, { once: true });
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === 'h') { this.togglePanels(); this.refresh(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    dom.addEventListener('pointerdown', (e) => {
      if (this.presenting) return;
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), onUI: !!this.pickUI(e) };
    });
    dom.addEventListener('pointermove', (e) => {
      if (!drag || drag.onUI) return;
      const d = this.walker.desk;
      d.yaw -= (e.clientX - drag.x) * 0.004;
      d.pitch = Math.max(-1.3, Math.min(1.3, d.pitch - (e.clientY - drag.y) * 0.004));
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    dom.addEventListener('pointerup', (e) => {
      const was = drag;
      drag = null;
      if (!was || was.onUI || this.presenting || this.blast.running) return;
      const quick = Math.hypot(e.clientX - was.sx, e.clientY - was.sy) < 6 && performance.now() - was.t < 500;
      if (!quick) return;
      const r = dom.getBoundingClientRect();
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      const hit = this.walker.cast(rc.ray.origin, rc.ray.direction, 150);
      if (hit && this.walker.standable(hit)) this.walker.teleportDesk([hit.x, 0, hit.z]);
    });
  }

  pickUI(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    return rc.intersectObjects([...this.panels.filter((p) => p.mesh.visible).map((p) => p.mesh), ...this.grabTargets()], false)[0];
  }

  updateDesk(dt) {
    const w = this.walker;
    const k = this.keys;
    if (!this.blast.running || !w.free) {
      const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
      const turn = (k.has('arrowleft') || k.has('q') ? 1 : 0) - (k.has('arrowright') || k.has('e') ? 1 : 0);
      w.desk.yaw += turn * dt * 1.6;
      w.moveDesk(fwd, side, dt, k.has('shift'));
    }
    w.update(dt);
    w.placeCamera(this.camera);
  }

  // ───────────── every frame ─────────────

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  update(dt) {
    this.time = (this.time ?? 0) + dt;
    if (this.presenting) this.updateXR(dt);
    else this.updateDesk(dt);
    this.blast.update(dt);
    this.city.update(dt, this.time);
    const head = this.viewerHead();
    this.atmos.update(head);
    this.fires.update(dt, this.scene.fog);
    this.updatePanels(dt);
    // markers: only this moment's, gently pulsing; the selected one gold
    const t = this.time;
    for (const m of this.markerSprites) {
      const d = m.userData.marker;
      m.visible = this.state.markers && !this.blast.running && d.eras.includes(this.markerEra);
      if (!m.visible) continue;
      const sel = d.id === this.state.selected;
      m.material.color.set(sel ? 0xffd166 : 0xffffff);
      const far = Math.max(1, head.distanceTo(m.position) / 25); // stay readable from across the river
      m.scale.setScalar(m.userData.size * far * (sel ? 1.12 + 0.06 * Math.sin(t * 4) : 1));
    }
    // the bell swings back after it is rung
    if (this.bellSwing > 0 && this.city.bellLog) {
      this.bellSwing = Math.max(0, this.bellSwing - dt * 0.8);
      this.city.bellLog.position.x = -Math.sin(this.bellSwing * Math.PI) * 0.6;
      this.city.bellBody.rotation.z = Math.sin(this.time * 6) * 0.03 * this.bellSwing;
    }
    if (this.isAdmin) {
      const json = JSON.stringify(this.adminLessonState());
      if (json !== this.lastAdminJson) {
        this.lastAdminJson = json;
        this.broadcastAdmin();
      }
    }
  }

  /** The panels: a heads-up display on a screen; in the headset they follow you lazily. */
  updatePanels(dt) {
    const lab = this.lab;
    lab.visible = this.state.panels;
    for (const p of this.panels) p.mesh.visible = this.state.panels && (p !== this.explainPanel || !!this.state.explain);
    if (!this.state.panels) return;
    const cam = this.presenting ? this.renderer.xr.getCamera() : this.camera;
    const pos = cam.getWorldPosition(new THREE.Vector3());
    const dir = cam.getWorldDirection(new THREE.Vector3());
    if (!this.presenting) {
      lab.position.copy(pos).addScaledVector(dir, 1.2).add(new THREE.Vector3(0, -0.06, 0));
      lab.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));
      return;
    }
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const want = pos.clone().addScaledVector(dir, this.state.seated ? 0.7 : 0.85);
    want.y = pos.y - (this.state.seated ? 0.22 : 0.15);
    const wantYaw = Math.atan2(-dir.x, -dir.z);
    const away = lab.position.distanceTo(want);
    const angle = Math.abs(Math.atan2(Math.sin(wantYaw - lab.rotation.y), Math.cos(wantYaw - lab.rotation.y)));
    if (this.labSnap || away > 3) {
      lab.position.copy(want);
      lab.rotation.set(0, wantYaw, 0);
      this.labSnap = false;
      this.labFollow = false;
      return;
    }
    if (this.state.locked || this.interaction.labGrabber) return;
    if (away > 1.3 || angle > 1.2) this.labFollow = true;
    if (this.labFollow) {
      const k = Math.min(1, dt * 3);
      lab.position.lerp(want, k);
      lab.rotation.y += Math.atan2(Math.sin(wantYaw - lab.rotation.y), Math.cos(wantYaw - lab.rotation.y)) * k;
      if (away < 0.08 && angle < 0.05) this.labFollow = false;
    }
  }
}

/** A round "i" marker. */
function markerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20, 28, 60, 0.85)';
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 76px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('i', 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

window.app = new App();
