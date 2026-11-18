import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { SAMPLES, SAMPLE_IDS, MAGS } from '../data/micro.js';

// The bench, as in the original lesson: a row of glass slides with samples, a pipette, a box of coverslips
// and a microscope with − / + focus buttons. Every part of the microscope can be tapped (starter activity).
// Steps: pipette a drop of stain (or water) onto a slide, put a coverslip on it, move it onto the stage.
// The microscope is modelled on a real school compound microscope: a curved arm, a lamp in the base, a stage
// with a slide holder, a condenser, coaxial coarse and fine focus knobs, a revolving nosepiece and an angled head.

export const TOP = -0.3;
const M = new THREE.Vector3(0.24, TOP, -0.05); // microscope base
const STAGE_Y = 0.105;
const SLIDE_Z = 0.17;
const PIPETTE_HOME = new THREE.Vector3(-0.02, TOP, SLIDE_Z);
const COVER_HOME = new THREE.Vector3(0.07, TOP, SLIDE_Z);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, envMapIntensity: 0.5, ...o });
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });

/** A turned shape (bottles, lenses, tubes): `profile` = [[radius, y], …] from bottom to top. */
const lathe = (profile, seg = 28) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** Fine ridges round a knob's edge (knurling), as a texture. */
let knurl = null;
function knurlTexture() {
  if (knurl) return knurl;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f4a';
  g.fillRect(0, 0, 128, 16);
  g.fillStyle = '#16181d';
  for (let i = 0; i < 32; i++) g.fillRect(i * 4, 0, 2, 16);
  knurl = new THREE.CanvasTexture(c);
  knurl.colorSpace = THREE.SRGBColorSpace;
  knurl.wrapS = THREE.RepeatWrapping;
  return knurl;
}

export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    // the bench: a lab worktop with a darker edge
    const top = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.014, 0.38, 3, 0.004), mat(0xc9ced7, { roughness: 0.6, envMapIntensity: 0.35 }));
    top.position.set(0, TOP - 0.007, 0.05);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.924, 0.006, 0.384), mat(0x5a6372, { roughness: 0.6 }));
    edge.position.set(0, TOP - 0.016, 0.05);
    this.group.add(top, edge);
    this.parts = [];
    this.buildMicroscope();

    // slides: glass, with a frosted end to write on
    const frost = mat(0xf4f4f0, { roughness: 0.95 });
    this.slides = SAMPLE_IDS.map((id, i) => {
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.0025, 0.024), glassMat);
      glass.position.y = 0.00125;
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0027, 0.0242), frost);
      end.position.set(-0.024, 0.00125, 0);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.0075, 24).rotateX(-Math.PI / 2), mat(0xd9d2c2, { transparent: true, opacity: 0.9, roughness: 0.3 }));
      spot.position.set(0.006, 0.0027, 0);
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0006, 0.02), new THREE.MeshPhysicalMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.4, roughness: 0.03, clearcoat: 1 }));
      cover.position.set(0.006, 0.0032, 0);
      cover.visible = false;
      g.add(glass, end, spot, cover);
      const home = new THREE.Vector3(-0.44 + i * 0.072, TOP, SLIDE_Z);
      g.position.copy(home);
      const tag = makeLabel(SAMPLES[id].short, { height: 0.011, size: 36 });
      tag.position.set(0, 0.005, 0.026);
      g.add(tag);
      const s = { id, group: g, spot, cover, home, stained: false, covered: false, onStage: false };
      for (const m of [glass, end, spot]) m.userData = { handler: this, slide: s };
      s.picks = [glass, end, spot];
      this.group.add(g);
      return s;
    });

    // the stain: an amber dropper bottle with a label, and the glass pipette you pick up
    const bottle = new THREE.Mesh(lathe([[0, 0], [0.016, 0], [0.017, 0.003], [0.017, 0.03], [0.012, 0.038], [0.007, 0.041], [0.007, 0.046], [0, 0.046]]),
      new THREE.MeshPhysicalMaterial({ color: 0x7a4012, transparent: true, opacity: 0.85, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 }));
    bottle.position.set(PIPETTE_HOME.x, TOP, PIPETTE_HOME.z);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0172, 0.0172, 0.016, 28, 1, true, -1.2, 2.4), mat(0xf3efe2, { roughness: 0.9, side: THREE.DoubleSide }));
    label.position.set(PIPETTE_HOME.x, TOP + 0.017, PIPETTE_HOME.z);
    const bTag = makeLabel('Stain / water', { height: 0.011, size: 36 });
    bTag.position.set(PIPETTE_HOME.x, TOP + 0.11, PIPETTE_HOME.z);
    this.group.add(bottle, label, bTag);
    this.pipette = new THREE.Group();
    const tube = new THREE.Mesh(lathe([[0, 0], [0.0009, 0], [0.0016, 0.012], [0.0034, 0.03], [0.0036, 0.066], [0.004, 0.068], [0, 0.068]], 16), glassMat);
    const bulb = new THREE.Mesh(lathe([[0, 0.064], [0.0045, 0.064], [0.0075, 0.07], [0.0082, 0.078], [0.0068, 0.086], [0.003, 0.089], [0, 0.089]], 18), mat(0xc8352f, { roughness: 0.6 }));
    this.pipette.add(tube, bulb);
    this.pipetteHome = new THREE.Vector3(PIPETTE_HOME.x, TOP + 0.045, PIPETTE_HOME.z);
    this.pipette.position.copy(this.pipetteHome);
    for (const m of [tube, bulb]) m.userData = { handler: this, pipette: true };
    this.pipettePicks = [tube, bulb];
    this.group.add(this.pipette);

    // coverslips: a small plastic box with a clear lid
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.01, 0.03, 2, 0.002), mat(0x3d6fd0, { roughness: 0.4 }));
    box.position.set(COVER_HOME.x, TOP + 0.005, COVER_HOME.z);
    const cTag = makeLabel('Coverslips', { height: 0.011, size: 36 });
    cTag.position.set(COVER_HOME.x, TOP + 0.04, COVER_HOME.z);
    this.group.add(box, cTag);
    this.coverslip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.002, 0.022), new THREE.MeshPhysicalMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.55, roughness: 0.03, clearcoat: 1 }));
    this.coverHome = new THREE.Vector3(COVER_HOME.x, TOP + 0.011, COVER_HOME.z);
    this.coverslip.position.copy(this.coverHome);
    this.coverslip.userData = { handler: this, coverslip: true };
    this.group.add(this.coverslip);
  }

  part(id, mesh) {
    mesh.userData = { handler: this, part: id, tapOnly: true };
    this.parts.push(mesh);
    this.scope.add(mesh);
    return mesh;
  }

  buildMicroscope() {
    this.scope = new THREE.Group();
    this.scope.position.copy(M);
    this.group.add(this.scope);
    const body = new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }); // enamel
    const dark = mat(0x2b2f3a, { roughness: 0.45 });
    const metal = mat(0xc4c9d2, { metalness: 0.8, roughness: 0.38, envMapIntensity: 0.8 });
    const black = mat(0x15171c, { roughness: 0.5 });
    const knurled = mat(0xffffff, { map: knurlTexture(), roughness: 0.55 });
    const at = (mesh, x, y, z, rot) => {
      mesh.position.set(x, y, z);
      if (rot) mesh.rotation.set(...rot);
      return mesh;
    };
    const add = (id, geo, m, x, y, z, rot) => this.part(id, at(new THREE.Mesh(geo, m), x, y, z, rot));

    // base: a heavy rounded foot with the lamp in it
    add('base', new RoundedBoxGeometry(0.12, 0.028, 0.155, 4, 0.008), body, 0, 0.014, 0.008);
    add('base', new RoundedBoxGeometry(0.124, 0.006, 0.159, 2, 0.003), dark, 0, 0.003, 0.008);
    add('light', new THREE.CylinderGeometry(0.016, 0.017, 0.004, 28), black, 0, 0.0295, 0.02);
    add('light', new THREE.CylinderGeometry(0.012, 0.012, 0.002, 28), mat(0xfff3b0, { emissive: 0xffe680, emissiveIntensity: 0.9 }), 0, 0.0315, 0.02);
    // arm: the curved back you carry it by
    const s = new THREE.Shape();
    s.moveTo(-0.068, 0.02);
    s.lineTo(-0.035, 0.02);
    s.quadraticCurveTo(-0.03, 0.1, -0.022, 0.16);
    s.lineTo(-0.02, 0.2);
    s.lineTo(-0.048, 0.2);
    s.quadraticCurveTo(-0.07, 0.11, -0.068, 0.02);
    const arm = new THREE.ExtrudeGeometry(s, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 16 });
    arm.translate(0, 0, -0.013);
    arm.rotateY(-Math.PI / 2); // the profile runs front–back, the thickness side to side
    add('arm', arm, body, 0, 0, 0);
    // stage: a plate with a hole for the light, a slide holder, and the knobs that move it
    const plate = new THREE.Shape();
    plate.moveTo(-0.05, -0.0425);
    plate.lineTo(0.05, -0.0425);
    plate.lineTo(0.05, 0.0425);
    plate.lineTo(-0.05, 0.0425);
    plate.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.009, 0, Math.PI * 2, true);
    plate.holes.push(hole);
    const stage = new THREE.ExtrudeGeometry(plate, { depth: 0.007, bevelEnabled: false, curveSegments: 20 });
    stage.rotateX(-Math.PI / 2);
    add('stage', stage, dark, 0, STAGE_Y - 0.0035, 0.015);
    add('stage', new THREE.BoxGeometry(0.016, 0.022, 0.03), dark, 0, STAGE_Y - 0.014, -0.03); // the bracket on the arm
    add('stage', new THREE.CylinderGeometry(0.004, 0.004, 0.022, 16), knurled, 0.042, STAGE_Y - 0.016, 0.04); // stage knobs
    add('stage', new THREE.CylinderGeometry(0.0055, 0.0055, 0.008, 16), knurled, 0.042, STAGE_Y - 0.03, 0.04);
    // the condenser under the stage, gathering the light onto the slide
    add('light', lathe([[0, 0], [0.008, 0], [0.011, 0.012], [0.011, 0.018], [0, 0.018]], 24), black, 0, STAGE_Y - 0.026, 0.015);
    // stage clips / slide holder (two pieces, as before)
    add('clips', new THREE.BoxGeometry(0.006, 0.003, 0.03), metal, -0.025, STAGE_Y + 0.0055, 0.025);
    add('clips', new THREE.BoxGeometry(0.006, 0.003, 0.03), metal, 0.025, STAGE_Y + 0.0055, 0.025);
    // focus: big coarse knobs, with the small fine knobs on the same axle outside them
    for (const side of [-1, 1]) {
      add('coarse', new THREE.CylinderGeometry(0.02, 0.02, 0.011, 32), knurled, side * 0.026, 0.1, -0.045, [0, 0, Math.PI / 2]);
      add('coarse', new THREE.CylinderGeometry(0.016, 0.016, 0.012, 24), dark, side * 0.026, 0.1, -0.045, [0, 0, Math.PI / 2]);
      add('fine', new THREE.CylinderGeometry(0.0105, 0.0105, 0.01, 24), knurled, side * 0.0365, 0.1, -0.045, [0, 0, Math.PI / 2]);
      add('fine', new THREE.CylinderGeometry(0.004, 0.004, 0.002, 12), metal, side * 0.042, 0.1, -0.045, [0, 0, Math.PI / 2]);
    }
    // head: the revolving nosepiece, the angled body and the eyepiece with its rubber cup
    add('nosepiece', lathe([[0, -0.006], [0.024, -0.006], [0.026, 0.0], [0.022, 0.008], [0.012, 0.012], [0, 0.012]], 32), metal, 0, 0.167, 0.012);
    add('nosepiece', new THREE.BoxGeometry(0.03, 0.03, 0.05), body, 0, 0.19, -0.012);
    this.objectives = MAGS.map((mag, i) => {
      const len = 0.022 + i * 0.008;
      // a tapered metal barrel, a knurled grip, a coloured ring and a black tip
      const o = add('objectives', lathe([[0, -len / 2], [0.003, -len / 2], [0.0045, -len / 2 + 0.004], [0.0058, -len / 2 + 0.008], [0.0062, len / 2 - 0.006], [0.0066, len / 2 - 0.005], [0.0066, len / 2], [0, len / 2]], 20), metal, 0, 0, 0);
      o.userData.mag = mag;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0064, 0.0064, 0.0025, 20), mat([0xd94848, 0xf2c12e, 0x3d8bd9][i]));
      band.position.y = -len / 2 + 0.0095;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.005, 20), knurled);
      grip.position.y = len / 2 - 0.0025;
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0031, 0.0031, 0.0012, 16), black);
      tip.position.y = -len / 2 + 0.0006;
      o.add(band, grip, tip);
      o.userData.len = len;
      o.userData.a = (i - 1) * 0.9;
      return o;
    });
    // the eyepiece tube leans towards you; the eyepiece and its rubber cup sit on its top end
    const d = new THREE.Vector3(0, Math.cos(0.5), Math.sin(0.5));
    const mid = new THREE.Vector3(0, 0.215, 0.005);
    const end = mid.clone().addScaledVector(d, 0.035);
    const cup = end.clone().addScaledVector(d, 0.03);
    add('eyepiece', new THREE.CylinderGeometry(0.013, 0.015, 0.07, 24), body, mid.x, mid.y, mid.z, [0.5, 0, 0]);
    add('eyepiece', lathe([[0, 0], [0.0095, 0], [0.0095, 0.028], [0.011, 0.03], [0, 0.03]], 24), dark, end.x, end.y, end.z, [0.5, 0, 0]);
    add('eyepiece', new THREE.TorusGeometry(0.0105, 0.003, 10, 28), black, cup.x, cup.y, cup.z, [0.5 - Math.PI / 2, 0, 0]);
    // the − / + focus buttons, as in the original lesson
    this.focusButtons = [-1, 1].map((d) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 24).rotateX(Math.PI / 2), mat(d > 0 ? 0x3d8bd9 : 0x2b2f3a, { roughness: 0.35 }));
      b.position.set(d * 0.03, 0.014, 0.087);
      b.userData = { handler: this, focus: d, tapOnly: true };
      const l = makeLabel(d > 0 ? '+' : '−', { height: 0.016, size: 48, bg: null });
      l.position.set(b.position.x, b.position.y, b.position.z + 0.007);
      this.scope.add(b, l);
      return b;
    });
    this.setObjective(4);
  }

  /** Turn the nosepiece so that this lens points down at the stage. */
  setObjective(mag) {
    const i = MAGS.indexOf(mag);
    this.objectives.forEach((o, k) => {
      const a = (k - i) * 1.0;
      const len = o.userData.len;
      o.position.set(Math.sin(a) * 0.018, 0.16 - Math.cos(a) * (len / 2 + 0.002), 0.012);
      o.rotation.set(0, 0, a);
    });
  }

  get targets() {
    const t = [...this.parts, ...this.focusButtons, ...this.pipettePicks, this.coverslip];
    for (const s of this.slides) t.push(...s.picks);
    return t;
  }

  get onStage() {
    return this.slides.find((s) => s.onStage) ?? null;
  }

  describe(o) {
    const u = o.userData;
    if (u.part) return this.app.state.mode === 'parts' ? `Tap: ${u.part === 'objectives' ? 'objective lenses' : u.part}` : u.part === 'objectives' || u.part === 'nosepiece' ? 'Tap to change the objective lens' : '';
    if (u.focus) return u.focus > 0 ? 'Focus +' : 'Focus −';
    if (u.pipette) return 'Pipette · hold it over a slide to add a drop';
    if (u.coverslip) return 'Coverslip · put it on a slide with a drop on it';
    if (u.slide) return `${SAMPLES[u.slide.id].name}${u.slide.stained ? (u.slide.covered ? ' · ready: put it on the stage' : ' · needs a coverslip') : ' · add a drop first'}`;
    return '';
  }

  tap(o) {
    const u = o.userData;
    if (u.focus) this.app.focusButton(u.focus);
    else if (u.part) this.app.tapPart(u.part);
  }

  near(p, target, r) {
    if (this.app.presenting) return p.distanceTo(target) < r;
    const cam = this.app.camera;
    const a = this.group.localToWorld(p.clone()).project(cam);
    const b = this.group.localToWorld(target.clone()).project(cam);
    return Math.hypot((a.x - b.x) * cam.aspect, a.y - b.y) < r * 2.2;
  }

  follow(obj, world) {
    const off = obj.position.clone().sub(this.group.worldToLocal(world.clone()));
    return (w) => {
      obj.position.copy(this.group.worldToLocal(w.clone())).add(off);
      obj.position.y = Math.max(TOP + 0.003, obj.position.y);
    };
  }

  slideNear(p, r, filter) {
    return this.slides.find((s) => !s.onStage && filter(s) && this.near(p, s.group.position.clone().setY(TOP + 0.003), r)) ?? null;
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.pipette) {
      const move = this.follow(this.pipette, world);
      return {
        move: (w) => {
          move(w);
          // the tip over a slide (on a screen, the bulb over it will do too)
          const tip = this.pipette.position;
          const bulb = tip.clone().add(new THREE.Vector3(0, 0.075, 0));
          const s = this.slideNear(tip, 0.03, (x) => !x.stained) ?? (this.app.presenting ? null : this.slideNear(bulb, 0.03, (x) => !x.stained));
          if (s) this.stain(s);
        },
        release: () => this.pipette.position.copy(this.pipetteHome),
      };
    }
    if (u.coverslip) {
      const move = this.follow(this.coverslip, world);
      return {
        move,
        release: () => {
          const s = this.slideNear(this.coverslip.position, 0.03, (x) => !x.covered);
          this.coverslip.position.copy(this.coverHome);
          if (!s) return;
          if (!s.stained) this.app.dropFirst(s.id);
          else this.cover(s);
        },
      };
    }
    if (u.slide) {
      const s = u.slide;
      if (s.onStage) this.offStage(s);
      const move = this.follow(s.group, world);
      return {
        move,
        release: () => {
          const stage = new THREE.Vector3(M.x, M.y + STAGE_Y + 0.004, M.z + 0.015);
          if (this.near(s.group.position, stage, 0.05)) this.app.toStage(s.id);
          else s.group.position.copy(s.home);
        },
      };
    }
    return null;
  }

  stain(s) {
    s.stained = true;
    const c = new THREE.Color(SAMPLES[s.id].drop);
    s.spot.material.color.lerp(c, SAMPLES[s.id].stain === 'water' ? 0.25 : 0.75);
    this.app.onStep('stain', s.id);
  }

  cover(s) {
    s.covered = true;
    s.cover.visible = true;
    this.app.onStep('cover', s.id);
  }

  putOnStage(s) {
    const old = this.onStage;
    if (old && old !== s) this.offStage(old);
    s.onStage = true;
    s.group.position.set(M.x, M.y + STAGE_Y + 0.004, M.z + 0.015);
  }

  offStage(s) {
    s.onStage = false;
    s.group.position.copy(s.home);
    this.app.onOffStage(s.id);
  }

  /** The steps by button (for tests). */
  quick(id) {
    const s = this.slides.find((x) => x.id === id);
    if (!s.stained) this.stain(s);
    if (!s.covered) this.cover(s);
    this.app.toStage(id);
  }
}
