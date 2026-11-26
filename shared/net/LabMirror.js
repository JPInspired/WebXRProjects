import * as THREE from 'three';
import { THEME } from '../ui/CanvasPanel.js';

// The teacher's bench, copied live behind every student's own bench (class sessions without room alignment).
//
//  • Every headset places the lesson in front of its own wearer: nobody needs to line up with the room.
//  • Each student sees a live copy of the teacher's lab, about 1.5 times its size, about 1.5 m behind and above
//    their own bench (it follows their bench when they move it). The class board sits above the copy.
//  • The teacher's hands or controllers (or, on a computer, the mouse) are drawn as simple ghost hands over the
//    copy, so students see how the teacher handles things.
//  • "Show one student's work" (Teacher menu → Students): that student's bench takes the place of the teacher's
//    on everyone's board, with their name above it, until the teacher stops. That student is told so gently.
//
// How it works, for the next developer: every device runs the same lesson, so every device already has the
// same lab. The copy is made from this device's own lab (same shapes, same materials), and whoever is "on the
// board" (the teacher, or the student being shown) sends how each part of its lab is placed, shown and coloured,
// in its lab's own coordinates. Only what changed is sent (about 8 times a second); everything is sent again
// to anyone who asks (joining, rejoining, a new person on the board). Pictures drawn by the lesson (meter
// readings, labels) and pictures loaded from the site (paintings) are sent too, now and then.
// Messages are checked: only the teacher (proven by the teacher's key), or the student the teacher chose, is
// listened to; numbers must be numbers, sizes are limited, and pictures must be pictures from this site.
//
// Switches: CLASS_COPY.enabled = false turns it off everywhere; a lesson sets `classCopy = false` to have none
// (Reef Dive: one shared reef round everyone; Hiroshima: a place to stand in, shared with Show Everyone).

export const CLASS_COPY = {
  enabled: true,
  scale: 1.5, // the copy's size, compared with your own bench
  back: 1.55, // how far behind your bench (m)
  lift: 0.34, // how far above your bench (m)
  boardLift: 0.75, // the class board moves up this much, to sit above the copy
  hz: 8, // updates a second from whoever is on the board
};

const MAX_NODES = 6000;
const MAX_IMG = 400000; // characters in one picture
const KEY_RE = /^\d{1,4}(\.\d{1,4}){0,24}$/;
const q3 = (v) => Math.round(v * 1000) / 1000;
const finite = (v, lim = 1e4) => Number.isFinite(v) && Math.abs(v) < lim;

/** One part's state: [visible, x, y, z, qx, qy, qz, qw, sx, sy, sz, color, emissive, opacity, count]. */
function stateOf(o, out) {
  out[0] = o.visible ? 1 : 0;
  out[1] = q3(o.position.x); out[2] = q3(o.position.y); out[3] = q3(o.position.z);
  out[4] = q3(o.quaternion.x); out[5] = q3(o.quaternion.y); out[6] = q3(o.quaternion.z); out[7] = q3(o.quaternion.w);
  out[8] = q3(o.scale.x); out[9] = q3(o.scale.y); out[10] = q3(o.scale.z);
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  out[11] = m?.color ? m.color.getHex() : -1;
  out[12] = m?.emissive ? m.emissive.getHex() : -1;
  out[13] = m ? q3(m.opacity ?? 1) : 1;
  out[14] = o.isInstancedMesh ? o.count : -1;
  return out;
}
const SLEN = 15;

export function makeLabMirror(app) {
  if (!CLASS_COPY.enabled || app.classCopy === false) return null;
  return new LabMirror(app);
}

class LabMirror {
  constructor(app) {
    this.app = app;
    this.stage = new THREE.Group(); // follows your bench (in the scene, so it never counts as part of your lab)
    this.stage.visible = false;
    this.copy = null; // the copy of the lab (scaled)
    this.nodes = new Map(); // key → copied part
    this.sourceId = null; // whose bench is on the board
    this.haveFull = false;
    this.missing = 0;
    this.builtAt = 0;
    // sending
    this.sent = new Map(); // key → last state sent
    this.texSent = new Map(); // key → 'uuid:version' of the picture last sent
    this.dynamic = new Set(); // keys whose pictures have changed while the lesson runs
    this.takeBaseline(); // (made in start(), once the lesson has built its lab)
    this.clock = 0;
    this.lastFullTo = new Map();
    this.imgQueue = [];
    // ghost hands and the name above the copy
    this.hands = [makeGhostHand(), makeGhostHand()];
    this.handsAt = 0;
    this.label = makeLabel();
    this.stage.add(this.label.mesh);
    app.scene.add(this.stage);
  }

  // ───────────── which parts of the lab are copied ─────────────

  /** Panels, other people's (hidden) benches and lights are not copied. */
  skip(o) {
    return !!(o.userData.panel || o.userData.noMirror || o.isLight || o.isCamera);
  }

  /** Visit the lab's parts with their keys (their place in the lab, counting only copied parts). */
  walk(root, fn) {
    const visit = (o, key) => {
      if (fn(o, key) === false) return;
      let i = 0;
      for (const c of o.children) {
        if (this.skip(c)) continue;
        visit(c, `${key}.${i++}`);
      }
    };
    let i = 0;
    for (const c of root.children) {
      if (this.skip(c)) continue;
      visit(c, String(i++));
    }
  }

  // ───────────── the copy (on everyone else's device) ─────────────

  /** Copy this device's own lab: same shapes and materials, nothing to grab. */
  build() {
    if (this.copy) {
      this.stage.remove(this.copy);
    }
    this.nodes.clear();
    const copy = new THREE.Group();
    copy.scale.setScalar(CLASS_COPY.scale);
    const parents = new Map();
    let n = 0;
    this.walk(this.app.lab, (o, key) => {
      if (n++ > MAX_NODES) return false;
      const c = cloneOne(o);
      c.userData.src = o;
      c.userData.shared = true; // (uses the original's material until it needs its own)
      const dot = key.lastIndexOf('.');
      (dot < 0 ? copy : parents.get(key.slice(0, dot)) ?? copy).add(c);
      parents.set(key, c);
      this.nodes.set(key, c);
    });
    for (const h of this.hands) copy.add(h);
    this.copy = copy;
    this.stage.add(copy);
    this.builtAt = performance.now();
    this.missing = 0;
    this.haveFull = false;
  }

  /** A part's own material (copied the first time the source's colour differs from this device's). */
  ownMaterial(c) {
    if (!c.userData.shared || !c.material) return c.material;
    const own = (m) => {
      const k = m.clone();
      k.onBeforeCompile = m.onBeforeCompile;
      k.customProgramCacheKey = m.customProgramCacheKey;
      return k;
    };
    c.material = Array.isArray(c.material) ? c.material.map(own) : own(c.material);
    c.userData.shared = false;
    return c.material;
  }

  apply(d, from) {
    if (from !== this.sourceId || !d || typeof d !== 'object') return;
    if (!this.copy) this.build();
    const rows = Array.isArray(d.r) ? d.r.slice(0, MAX_NODES) : [];
    let missing = 0;
    for (const r of rows) {
      if (!Array.isArray(r) || r.length !== SLEN + 1 || typeof r[0] !== 'string' || !KEY_RE.test(r[0])) continue;
      if (!r.every((v, i) => i === 0 || finite(v, 2e7))) continue;
      const c = this.nodes.get(r[0]);
      if (!c) {
        missing++;
        continue;
      }
      c.visible = r[1] === 1;
      c.position.set(r[2], r[3], r[4]);
      const q = c.quaternion.set(r[5], r[6], r[7], r[8]);
      if (q.lengthSq() > 1e-6) q.normalize();
      else q.identity();
      c.scale.set(r[9], r[10], r[11]);
      if (c.material) {
        const m0 = Array.isArray(c.material) ? c.material[0] : c.material;
        const differs = (r[12] >= 0 && m0.color && m0.color.getHex() !== r[12])
          || (r[13] >= 0 && m0.emissive && m0.emissive.getHex() !== r[13])
          || Math.abs((m0.opacity ?? 1) - r[14]) > 0.002;
        if (differs) {
          const mm = this.ownMaterial(c);
          const m = Array.isArray(mm) ? mm[0] : mm;
          if (r[12] >= 0 && m.color) m.color.setHex(r[12]);
          if (r[13] >= 0 && m.emissive) m.emissive.setHex(r[13]);
          m.opacity = Math.min(1, Math.max(0, r[14]));
        }
      }
      if (c.isInstancedMesh && r[15] >= 0) c.count = Math.min(r[15], c.instanceMatrix.count);
    }
    if (d.f === 1) this.haveFull = true;
    this.missing = missing;
    // the source has parts this copy does not (the lesson made something new): copy this lab again, and ask
    if (missing && performance.now() - this.builtAt > 5000) {
      this.build();
      this.request();
    }
    if (Array.isArray(d.h)) this.applyHands(d.h);
  }

  applyHands(list) {
    this.handsAt = performance.now();
    this.hands.forEach((g, i) => {
      const h = list[i];
      const ok = Array.isArray(h) && h.length === 9 && h.every((v) => finite(v, 100));
      g.visible = ok;
      if (!ok) return;
      g.position.set(h[2], h[3], h[4]);
      g.quaternion.set(h[5], h[6], h[7], h[8]);
      if (g.quaternion.lengthSq() > 1e-6) g.quaternion.normalize();
      g.userData.setGrip(h[1] === 1);
    });
  }

  /** A picture drawn or loaded by the source's lesson (a meter's reading, a painting). */
  applyImage(d, from) {
    if (from !== this.sourceId || !d || typeof d.k !== 'string' || !KEY_RE.test(d.k) || typeof d.u !== 'string' || d.u.length > MAX_IMG) return;
    const c = this.nodes.get(d.k);
    if (!c?.material) return;
    let url = null;
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.u)) url = d.u;
    else {
      try {
        const u = new URL(d.u, location.href);
        if (u.origin === location.origin && /\.(webp|png|jpe?g)$/i.test(u.pathname)) url = u.href;
      } catch { /* not a link */ }
    }
    if (!url) return;
    const mm = this.ownMaterial(c);
    const m = Array.isArray(mm) ? mm[0] : mm;
    const old = m.map;
    (this.loader ??= new THREE.TextureLoader()).load(url, (t) => {
      if (old) {
        t.colorSpace = old.colorSpace;
        t.wrapS = old.wrapS;
        t.wrapT = old.wrapT;
        t.repeat.copy(old.repeat);
        t.offset.copy(old.offset);
        t.flipY = old.flipY;
      }
      if (m.map && m.map !== old && m.map.userData.mirror) m.map.dispose();
      t.userData.mirror = true;
      m.map = t;
      m.needsUpdate = true;
    });
  }

  /** Ask whoever is on the board for everything. */
  request() {
    const pr = this.app.presence;
    if (this.sourceId && this.sourceId !== pr?.selfId) pr?.mirrorReqCh?.send(1, this.sourceId);
  }

  // ───────────── sending (whoever is on the board) ─────────────

  /**
   * Everything (full: for one device that asked; nothing is marked as sent), or only what changed since the
   * last update to everyone.
   */
  collect(full, pictures = null) {
    const rows = [];
    const keys = new Set();
    let n = 0;
    this.walk(this.app.lab, (o, key) => {
      if (n++ > MAX_NODES) return false;
      keys.add(key);
      const now = stateOf(o, new Array(SLEN));
      if (full) {
        rows.push([key, ...now]);
        const t = pictures && this.changedPicture(o, key);
        if (t) pictures.push({ key, t });
        return true; // (a full update also describes what is inside hidden parts)
      }
      let last = this.sent.get(key);
      let changed = !last;
      if (!last) this.sent.set(key, (last = now.slice()));
      for (let i = 0; i < SLEN && !changed; i++) if (now[i] !== last[i]) changed = true;
      if (changed) {
        for (let i = 0; i < SLEN; i++) last[i] = now[i];
        rows.push([key, ...now]);
      }
      this.watchPicture(o, key);
      return o.visible; // (parts inside something hidden are not looked at until it shows again)
    });
    // parts not looked at (inside something hidden, or gone) are described afresh when they are next seen
    if (!full) for (const k of this.sent.keys()) if (!keys.has(k)) this.sent.delete(k);
    return rows;
  }

  /** A part's picture, if the lesson has changed it since it started (drawn again, or a different one). */
  changedPicture(o, key) {
    if (!o.isMesh && !o.isSprite) return null;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const t = m?.map;
    if (!t?.image) return null;
    if (this.dynamic.has(key)) return t; // (once changed, always sent: it may also change back)
    const base = this.baseline.get(key);
    const canvas = t.image instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && t.image instanceof OffscreenCanvas);
    if (base && base.uuid === t.uuid && (!canvas || base.version === t.version)) return null; // as every device started
    this.dynamic.add(key);
    return t;
  }

  /** Pictures: the ones the lesson draws again or changes are sent when they change. */
  watchPicture(o, key) {
    const t = this.changedPicture(o, key);
    if (!t) return;
    const stamp = `${t.uuid}:${t.version}`;
    if (this.texSent.get(key) === stamp) return;
    this.texSent.set(key, stamp);
    this.queueImage(key, t);
  }

  /** How every picture was when the lesson started (the same on every device). */
  takeBaseline() {
    this.baseline = new Map();
    this.walk(this.app.lab, (o, key) => {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m?.map) this.baseline.set(key, { uuid: m.map.uuid, version: m.map.version });
    });
  }

  queueImage(key, t, again = false) {
    if (!again && this.imgQueue.some((x) => x.key === key)) return;
    this.imgQueue = this.imgQueue.filter((x) => x.key !== key);
    this.imgQueue.push({ key, t });
  }

  /** A picture as text: a link for one loaded from the site, a small copy for one drawn on a canvas. */
  pictureData(t) {
    const img = t.image;
    if (img instanceof HTMLImageElement && img.src) {
      try {
        const u = new URL(img.src);
        if (u.origin === location.origin) return u.pathname + u.search;
      } catch { /* not a link */ }
      return null;
    }
    if (!(img instanceof HTMLCanvasElement) && !(typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas)) return null;
    const W = img.width;
    const H = img.height;
    if (!W || !H) return null;
    const k = Math.min(1, 320 / Math.max(W, H));
    const c = (this.shrink ??= document.createElement('canvas'));
    c.width = Math.max(1, Math.round(W * k));
    c.height = Math.max(1, Math.round(H * k));
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/png');
    return url.length < MAX_IMG ? url : c.toDataURL('image/jpeg', 0.7);
  }

  /** A few pictures from the queue (to everyone), or the given list (to one device). */
  sendImages(list = null, to) {
    const pr = this.app.presence;
    const items = list ?? this.imgQueue.splice(0, 2);
    for (const { key, t } of items.slice(0, 40)) {
      const u = this.pictureData(t);
      if (u && u.length < MAX_IMG) pr.mirrorImgCh?.send({ k: key, u }, to);
    }
  }

  /** Where my hands are (in my lab's coordinates): controllers, tracked hands, or the mouse on a computer. */
  myHands() {
    const app = this.app;
    const it = app.interaction;
    if (!it) return [];
    app.lab.updateMatrixWorld();
    const inv = app.lab.matrixWorld.clone().invert();
    const labQ = app.lab.getWorldQuaternion(new THREE.Quaternion()).invert();
    const out = [];
    if (app.presenting) {
      for (const c of it.controllers) {
        if (!c.userData.mode || c.userData.mode === 'screen' || !c.visible) {
          out.push(0);
          continue;
        }
        const p = it.sourcePoint(c).applyMatrix4(inv);
        const q = labQ.clone().multiply(c.getWorldQuaternion(new THREE.Quaternion()));
        out.push([c.userData.inputSource?.hand ? 1 : 0, it.active.has(c) ? 1 : 0, ...p.toArray().map(q3), ...q.toArray().map(q3)]);
      }
    } else if (it.mouseInside) {
      // a computer: one hand where the mouse is over the lab (holding: where the held thing is)
      const g = it.active.get('mouse');
      let p = null;
      if (g) p = g.handle.getWorldPosition(new THREE.Vector3());
      else {
        it.raycaster.setFromCamera(it.pointer, app.camera);
        const hit = it.raycaster.intersectObjects(app.grabTargets().filter((o) => o.visible), false)[0];
        if (hit) p = hit.point;
      }
      if (p) {
        // pointing away from the camera, a little down
        const dir = p.clone().sub(app.camera.getWorldPosition(new THREE.Vector3())).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        out.push([2, g ? 1 : 0, ...p.applyMatrix4(inv).toArray().map(q3), ...labQ.clone().multiply(q).toArray().map(q3)]);
      }
    }
    return out;
  }

  /** Someone (re)joined: if I am on the board, they get everything; if it is whoever is on my board, I ask. */
  peerJoined(id) {
    const pr = this.app.presence;
    if (this.sourceId && this.sourceId === pr.selfId) setTimeout(() => this.sendFull(id), 600);
    else if (id === this.sourceId) setTimeout(() => this.request(), 600);
  }

  /** Someone asked for everything (they joined, rejoined, or I have just come on the board). */
  sendFull(to) {
    const now = performance.now();
    if (now - (this.lastFullTo.get(to) ?? 0) < 1500) return;
    this.lastFullTo.set(to, now);
    const pictures = [];
    const rows = this.collect(true, pictures);
    this.app.presence.mirrorCh?.send({ f: 1, r: rows, h: this.myHands() }, to);
    this.sendImages(pictures, to);
  }

  // ───────────── every frame ─────────────

  /** Whose bench is on the board: the student the teacher chose, or the teacher. */
  whoIsOn() {
    const app = this.app;
    const pr = app.presence;
    if (!pr?.selfId || pr.status !== 'connected') return null;
    const show = app.showWork?.id;
    if (show && (show === pr.selfId || pr.peers.has(show))) return show;
    if (pr.host && pr.isHost) return pr.selfId;
    const teacher = [...pr.peers.values()].find((p) => p.host);
    return teacher?.id ?? null;
  }

  update(dt) {
    const app = this.app;
    const pr = app.presence;
    const src = this.whoIsOn();
    if (src !== this.sourceId) {
      this.sourceId = src;
      this.haveFull = false;
      this.sent.clear(); // (sending afresh if it is me)
      if (src && src !== pr.selfId) {
        if (!this.copy) this.build();
        this.request();
        this.askedAt = performance.now();
      }
      this.label.draw(this.labelText());
    }
    // someone else is on the board: show their bench (once their first full update has arrived)
    const showing = !!src && src !== pr?.selfId && this.haveFull;
    if (src && src !== pr?.selfId && !this.haveFull && performance.now() - (this.askedAt ?? 0) > 4000) {
      this.askedAt = performance.now();
      this.request(); // (asked, nothing yet: ask again)
    }
    this.stage.visible = showing;
    if (this.stage.visible) {
      app.lab.updateMatrixWorld();
      this.stage.position.set(0, CLASS_COPY.lift, -CLASS_COPY.back).applyMatrix4(app.lab.matrixWorld);
      this.stage.quaternion.copy(app.lab.getWorldQuaternion(new THREE.Quaternion()));
      const name = this.labelText();
      if (name !== this.label.text) this.label.draw(name);
      if (performance.now() - this.handsAt > 1500) for (const h of this.hands) h.visible = false;
    }
    // I am on the board: send what changed
    if (src && src === pr.selfId && pr.peers.size) {
      this.clock += dt;
      if (this.clock >= 1 / CLASS_COPY.hz) {
        this.clock = 0;
        const rows = this.collect(false);
        const hands = this.myHands();
        const hj = JSON.stringify(hands);
        const now = performance.now();
        // hands: when they move, and twice a second while they are shown (a still hand must not fade away)
        const handsDue = hj !== this.lastHands || (hands.some(Boolean) && now - (this.handsSentAt ?? 0) > 500);
        this.lastHands = hj;
        if (rows.length || handsDue) {
          pr.mirrorCh?.send({ f: 0, r: rows, h: hands });
          this.handsSentAt = now;
        }
        this.sendImages();
      }
    }
  }

  /** "Teacher's Bench", or "Maria's Work" while the teacher shows a student's work. */
  labelText() {
    const app = this.app;
    const pr = app.presence;
    const show = app.showWork;
    if (show?.id && show.id === this.sourceId) return `${show.name || 'A Student'}’s Work`;
    if (pr?.host && pr.isHost) return 'Your Bench';
    return 'Your Teacher’s Bench';
  }

  /** Where the copy is (for Look Here): its middle, in the world. */
  where() {
    return this.stage.visible ? this.stage.localToWorld(new THREE.Vector3(0, 0.3, 0)) : null;
  }
}

// ───────────── copying one part ─────────────

function cloneOne(o) {
  let c;
  if (o.isInstancedMesh) {
    c = new THREE.InstancedMesh(o.geometry, o.material, o.instanceMatrix.count);
    c.instanceMatrix.copy(o.instanceMatrix);
    if (o.instanceColor) c.instanceColor = o.instanceColor.clone();
    c.count = o.count;
  } else if (o.isSkinnedMesh) c = new THREE.Mesh(o.geometry, o.material);
  else if (o.isMesh) c = new THREE.Mesh(o.geometry, o.material);
  else if (o.isLineSegments) c = new THREE.LineSegments(o.geometry, o.material);
  else if (o.isLineLoop) c = new THREE.LineLoop(o.geometry, o.material);
  else if (o.isLine) c = new THREE.Line(o.geometry, o.material);
  else if (o.isPoints) c = new THREE.Points(o.geometry, o.material);
  else if (o.isSprite) c = new THREE.Sprite(o.material);
  else c = new THREE.Group();
  c.name = o.name;
  c.position.copy(o.position);
  c.quaternion.copy(o.quaternion);
  c.scale.copy(o.scale);
  c.visible = o.visible;
  c.renderOrder = o.renderOrder;
  c.frustumCulled = o.frustumCulled;
  if (o.isSprite) c.center.copy(o.center);
  return c;
}

// ───────────── ghost hands ─────────────

/** A simple see-through hand: palm, four fingers and a thumb, which close round what it holds. */
function makeGhostHand() {
  const mat = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.42, depthWrite: false });
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat);
  palm.scale.set(0.038, 0.014, 0.045);
  palm.position.set(0, 0, 0.06);
  g.add(palm);
  const fingers = [];
  const fingerGeo = new THREE.CapsuleGeometry(0.0085, 0.045, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.03);
  [-0.025, -0.008, 0.009, 0.025].forEach((x, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, 0.02);
    const f = new THREE.Mesh(fingerGeo, mat);
    f.scale.z = [0.85, 1, 0.95, 0.75][i];
    pivot.add(f);
    g.add(pivot);
    fingers.push(pivot);
  });
  const thumb = new THREE.Group();
  thumb.position.set(-0.035, -0.004, 0.06);
  thumb.rotation.y = 0.7;
  const t = new THREE.Mesh(fingerGeo, mat);
  t.scale.z = 0.75;
  thumb.add(t);
  g.add(thumb);
  // a soft dot where the hand is pointing / holding
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
  g.add(dot);
  g.renderOrder = 5;
  g.visible = false;
  g.userData.setGrip = (on) => {
    for (const f of fingers) f.rotation.x = on ? -1.1 : -0.15;
    thumb.rotation.x = on ? -0.6 : 0;
    dot.scale.setScalar(on ? 1.4 : 1);
  };
  g.userData.setGrip(false);
  return g;
}

// ───────────── the name above the copy ─────────────

function makeLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.09), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.position.set(0, 0.5 * CLASS_COPY.scale, 0.3 * CLASS_COPY.scale); // just above the front of the copy, below the board
  mesh.renderOrder = 6;
  const label = {
    mesh,
    text: null,
    draw(text) {
      label.text = text;
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.font = '700 44px system-ui, -apple-system, "Segoe UI", sans-serif';
      const w = Math.min(canvas.width - 8, c.measureText(text).width + 64);
      c.fillStyle = THEME.bg;
      c.strokeStyle = THEME.accent;
      c.lineWidth = 4;
      c.beginPath();
      c.roundRect((canvas.width - w) / 2, 6, w, canvas.height - 12, 40);
      c.fill();
      c.stroke();
      c.fillStyle = THEME.text;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 40);
      tex.needsUpdate = true;
    },
  };
  return label;
}
