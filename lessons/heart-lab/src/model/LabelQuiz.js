import * as THREE from 'three';
import { PARTS, partsFor } from '../data/heart.js';
import { font, roundRect } from '../../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../../shared/util/sound.js';
import { LabelSpots } from '../../../../shared/ui/LabelSpots.js';

// "Label it" (plenary): name tags wait below your heart; beside it, a spot for each part with a line to that part.
// Drag each name onto its spot (or straight onto the part). Right answers stick; wrong ones come back with a hint. The teacher sees everyone's score in the Admin menu.

function tagTexture(text, state) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  roundRect(g, 4, 4, 504, 120, 30);
  g.fillStyle = { idle: 'rgba(20,26,48,0.92)', right: 'rgba(30,120,70,0.95)', wrong: 'rgba(170,40,50,0.95)' }[state];
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = state === 'idle' ? '#ff8fa3' : '#ffffff';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let s = 50;
  g.font = font(s, 700);
  while (g.measureText(text).width > 470 && s > 22) g.font = font(--s, 700);
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class LabelQuiz {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.tags = [];
    this.right = 0;
    this.wrong = 0;
    this.raycaster = new THREE.Raycaster();
    this.spots = new LabelSpots(app, this.group, { w: 0.14, h: 0.035 });
  }

  /** The model's bounds, in this group's space. */
  modelBox(objects) {
    const box = new THREE.Box3();
    for (const o of objects) box.expandByObject(o);
    return new THREE.Box3(this.group.worldToLocal(box.min.clone()), this.group.worldToLocal(box.max.clone()));
  }

  start(heart, level) {
    this.heart = heart;
    for (const t of this.tags) {
      t.material.map.dispose();
      this.group.remove(t);
    }
    this.tags = [];
    this.right = 0;
    this.wrong = 0;
    const ids = partsFor(level);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    heart.group.updateMatrixWorld(true);
    const parts = ids.map((id) => ({ id, objects: heart.parts.get(id) ?? [] }));
    const box = this.modelBox(parts.flatMap((p) => p.objects));
    this.spots.build(parts, box);
    const cols = 4;
    ids.forEach((id, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const inRow = Math.min(cols, ids.length - row * cols);
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.035),
        new THREE.MeshBasicMaterial({ map: tagTexture(PARTS[id].name, 'idle'), transparent: true, toneMapped: false, depthTest: false }));
      tag.renderOrder = 8;
      tag.position.set((col - (inRow - 1) / 2) * (0.14 + 0.015), box.min.y - 0.05 - row * (0.035 + 0.014), box.max.z + 0.06 + row * 0.02);
      tag.rotation.x = -0.35; // tilted up towards you, like cards on a desk
      tag.userData = { handler: this, tag: id, home: tag.position.clone(), done: false };
      this.group.add(tag);
      this.tags.push(tag);
    });
  }

  home(tag) {
    tag.position.copy(tag.userData.home);
    tag.rotation.set(-0.35, 0, 0);
  }

  get total() {
    return this.tags.length;
  }

  setLook(tag, state) {
    tag.material.map.dispose();
    tag.material.map = tagTexture(PARTS[tag.userData.tag].name, state);
  }

  describe(o) {
    return o.userData.done ? `${PARTS[o.userData.tag].name} ✓` : 'Drag this label onto the heart';
  }

  grab(o, mode, world) {
    if (o.userData.done) return null;
    const lab = this.app.lab;
    const offset = o.position.clone().sub(lab.worldToLocal(world.clone()));
    o.rotation.set(0, 0, 0);
    this.spots.held = o;
    return {
      move: (w) => o.position.copy(lab.worldToLocal(w.clone())).add(offset),
      release: () => {
        this.spots.held = null;
        this.drop(o);
      },
    };
  }

  /** The part of the heart behind the tag, seen from your eyes. */
  partBehind(tag) {
    const eye = this.app.viewCamera().getWorldPosition(new THREE.Vector3());
    this.heart.group.updateMatrixWorld(true); // (the heart may have just been turned back)
    const at = tag.getWorldPosition(new THREE.Vector3());
    this.raycaster.set(eye, at.clone().sub(eye).normalize());
    const hit = this.raycaster.intersectObjects(this.heart.targets, false)[0];
    return hit ? { id: hit.object.userData.part, point: hit.point } : null;
  }

  drop(tag) {
    const id = tag.userData.tag;
    const spot = this.spots.at(tag.getWorldPosition(new THREE.Vector3()));
    const hit = spot ? { id: spot } : this.partBehind(tag);
    if (!hit || !PARTS[hit.id]) {
      this.home(tag);
      return;
    }
    if (hit.id === id) {
      this.right++;
      tag.userData.done = true;
      this.setLook(tag, 'right');
      const at = this.spots.place(id);
      if (at) tag.position.copy(at);
      tag.rotation.set(0, 0, 0);
      this.spots.done(id);
      sound.bond();
      this.app.interaction.pulse(0.5, 40);
      if (this.right === this.total) {
        sound.release(300);
        this.app.explain({ done: true, title: `All ${this.total} labelled!`, text: `You named every part of the heart${this.wrong ? ` (with ${this.wrong} wrong tr${this.wrong === 1 ? 'y' : 'ies'} on the way)` : ' without a single mistake'}. Now explain to a partner what each part does.` });
      } else {
        this.app.explain({ title: `Yes: ${PARTS[id].name}`, text: `${PARTS[id].text} (${this.right} of ${this.total} labelled)` });
      }
    } else {
      this.wrong++;
      this.setLook(tag, 'wrong');
      sound.refuse();
      this.app.interaction.pulse(0.8, 100);
      this.app.explain({ title: `Not quite: that’s the ${PARTS[hit.id].name.toLowerCase()}`, text: `Look for ${PARTS[id].look}.` });
      setTimeout(() => {
        if (!tag.userData.done) this.setLook(tag, 'idle');
      }, 1200);
      this.home(tag);
    }
    this.app.quizChanged?.();
  }

  get grabTargets() {
    return this.tags.filter((t) => !t.userData.done);
  }
}
