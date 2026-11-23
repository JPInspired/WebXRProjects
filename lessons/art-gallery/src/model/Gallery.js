import * as THREE from 'three';
import { PAINTINGS } from '../data/paintings.js';

// The easel on the desk, the painting on it (real size whenever it fits, otherwise scaled down to fit), its
// hotspots, the "True Size" copy standing behind the desk, and the zoom for the guessing game.

const TOP = -0.3; // the desk top, in lab space
const FIT = { w: 0.9, h: 0.62 }; // the most the desk easel can hold (m)
const AT = new THREE.Vector3(0, TOP + 0.1, -0.05); // the bottom middle of the painting on the easel
const BIG_BACK = 1.9; // m behind the desk: the true-size painting
const loader = new THREE.TextureLoader();

const wood = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.7 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0xb8913f, metalness: 0.55, roughness: 0.35 });

/** A painting in its gilt frame: a group whose painting mesh is w by h metres. */
function framed() {
  const g = new THREE.Group();
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }));
  g.add(canvas);
  const bars = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), frameMat);
    g.add(m);
    return m;
  });
  return { g, canvas, bars };
}

function sizeFrame(f, w, h) {
  f.canvas.scale.set(w, h, 1);
  const t = Math.max(0.025, Math.min(w, h) * 0.06); // frame width
  const d = t * 0.6;
  const [top, bottom, left, right] = f.bars;
  top.scale.set(w + 2 * t, t, d); top.position.set(0, h / 2 + t / 2, 0);
  bottom.scale.set(w + 2 * t, t, d); bottom.position.set(0, -h / 2 - t / 2, 0);
  left.scale.set(t, h, d); left.position.set(-w / 2 - t / 2, 0, 0);
  right.scale.set(t, h, d); right.position.set(w / 2 + t / 2, 0, 0);
}

export class Gallery {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    // a small table easel: two front legs, a back leg and a ledge
    const leg = (x, z, rx, rz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.03), wood);
      m.position.set(x, TOP + 0.43, z);
      m.rotation.set(rx, 0, rz);
      this.group.add(m);
    };
    leg(-0.2, -0.15, 0.08, 0.1);
    leg(0.2, -0.15, 0.08, -0.1);
    leg(0, -0.33, -0.32, 0);
    this.ledge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.08), wood);
    this.ledge.position.set(0, AT.y - 0.03, AT.z + 0.02);
    this.group.add(this.ledge);
    // the painting on the easel
    this.small = framed();
    this.group.add(this.small.g);
    // true size: a second copy, standing on the floor behind the desk
    this.big = framed();
    this.big.g.visible = false;
    app.scene.add(this.big.g);
    // hotspots: glowing rings on the painting
    this.spots = [];
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, toneMapped: false, side: THREE.DoubleSide }));
      const fill = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.12, toneMapped: false }));
      ring.add(fill);
      ring.userData = { handler: this, spot: i, tapOnly: true };
      fill.userData = ring.userData;
      ring.visible = false;
      this.small.g.add(ring);
      this.spots.push(ring);
    }
    this.textures = {};
    this.zoom = 1; // 1: the whole painting; smaller: a close-up (the guessing game)
    this.focus = new THREE.Vector2(0.5, 0.5);
    this.current = null;
  }

  texture(p) {
    if (!this.textures[p.id]) {
      const t = loader.load(new URL(`../../paintings/${p.id}.webp`, import.meta.url).href, () => this.app.refresh());
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      this.textures[p.id] = t;
    }
    return this.textures[p.id];
  }

  /** The painting's size on the desk easel (m): real size if it fits, otherwise as large as fits. */
  fitted(p) {
    const w = p.w / 100, h = p.h / 100;
    const k = Math.min(1, FIT.w / w, FIT.h / h);
    return { w: w * k, h: h * k, scale: k };
  }

  show(id) {
    const p = PAINTINGS.find((x) => x.id === id) ?? PAINTINGS[0];
    this.current = p;
    const tex = this.texture(p);
    for (const f of [this.small, this.big]) {
      f.canvas.material.map = tex;
      f.canvas.material.needsUpdate = true;
    }
    const s = this.fitted(p);
    sizeFrame(this.small, s.w, s.h);
    this.small.g.position.set(AT.x, AT.y + s.h / 2, AT.z);
    this.small.g.rotation.x = -0.08; // leaning back a little on the easel
    sizeFrame(this.big, p.w / 100, p.h / 100);
    // hotspots on the painting
    this.spots.forEach((r, i) => {
      const h = p.hotspots[i];
      r.visible = !!h && this.zoom === 1 && this.app.state.mode === 'gallery';
      if (!h) return;
      const size = Math.max(0.018, Math.min(s.w, s.h) * 0.05);
      r.scale.setScalar(size);
      r.position.set((h.u - 0.5) * s.w, (0.5 - h.v) * s.h, 0.004);
    });
    this.applyZoom();
  }

  /** The guessing game's close-up: zoom 1 shows it all, 0.08 a small square around focus. */
  applyZoom() {
    const t = this.current && this.textures[this.current.id];
    if (!t) return;
    const z = this.zoom;
    t.repeat.set(z, z);
    t.offset.set(THREE.MathUtils.clamp(this.focus.x - z / 2, 0, 1 - z), THREE.MathUtils.clamp(1 - this.focus.y - z / 2, 0, 1 - z));
  }

  /** True size: the painting at its real size, standing on the floor behind the desk (or hidden). */
  setTrueSize(on) {
    this.big.g.visible = on;
    if (!on || !this.current) return;
    const p = this.current;
    const lab = this.app.lab;
    lab.updateMatrixWorld();
    const at = new THREE.Vector3(0, 0, -BIG_BACK).applyMatrix4(lab.matrixWorld);
    const floor = this.app.presenting ? 0 : lab.position.y - 1.2; // (on a computer the room's floor)
    this.big.g.position.set(at.x, floor + 0.35 + p.h / 200, at.z);
    this.big.g.quaternion.copy(lab.quaternion);
  }

  // hotspots are tapped
  tap(o) {
    const i = o.userData.spot;
    if (i == null || !this.current) return;
    this.app.onHotspot(this.current, i);
  }

  describe(o) {
    const h = this.current?.hotspots[o.userData.spot];
    return h ? `${h.title} · tap to find out more` : '';
  }

  get targets() {
    return this.spots.filter((r) => r.visible).flatMap((r) => [r, r.children[0]]);
  }

  update() {
    const t = performance.now() / 1000;
    for (const r of this.spots) if (r.visible) r.material.opacity = 0.6 + 0.35 * Math.sin(t * 3);
    if (this.big.g.visible) this.setTrueSize(true);
  }
}
