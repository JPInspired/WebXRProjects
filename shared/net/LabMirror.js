import * as THREE from 'three';
import { THEME } from '../ui/CanvasPanel.js';
import { makeShadowBlob } from '../util/contactShadows.js';

// The teacher's bench, copied live behind every student's own bench (class sessions without room alignment).
//
//  • Every headset places the lesson in front of its own wearer: nobody needs to line up with the room.
//  • Behind each bench there is room for one thing, chosen by the teacher (Teacher menu → Board → Behind Each
//    Bench): Nothing (the start of every lesson), the Class Board, or My Bench. My Bench is a live copy of the
//    teacher's lab, about 1.5 times its size, just behind and above the student's own bench (it follows the
//    student's bench if they move it).
//  • The teacher's hands are drawn over the copy in a bright see-through blue: real finger positions for bare
//    hands, a controller shape for controllers, one hand at the mouse on a computer. The teacher's pointer ray
//    shows too, whatever they hold or reach for glows, and a short fading trail shows where it just moved.
//  • "Show One Student's Work" (Teacher menu → Students → Show): that student's bench takes the teacher's place
//    on everyone's copy, with their name above it, until the teacher stops. That student is told so gently.
//
// How it works, for the next developer: every device runs the same lesson, so every device already has the same
// lab. The copy is made from this device's own lab (same shapes, same materials), and whoever is on the copy
// (the teacher, or the student being shown) sends how each part of its lab is placed, shown and coloured, in
// its lab's own coordinates: only what changed, about 12 times a second, and everything again to anyone who
// asks (joining, rejoining, the copy switched on). Each student's headset glides the copy's parts towards what
// arrived (about 0.2 s behind), so nothing jumps. Pictures drawn or loaded by the lesson (meter readings,
// paintings) and shapes the lesson bends (a rope, a wave) are sent when they change.
//
// Parts are found by their place in the lab (e.g. "the third part of the second group"). A lesson that MOVES
// parts from one place to another (an organ from the tray into the body, a part into the computer's case) or
// MAKES new ones (particles of an atom) names them, so they are followed wherever they go:
//   mirrorParts()  → [{ id, obj, type? }]   the loose parts, each with a name that is the same on every device
//   mirrorMake(type) → Object3D             a new part of that type, for one the student's own lab does not have
// Loose parts are left out of the "place in the lab" numbering, so moving them never confuses anything else.
// A lesson can also tag a part where it makes it: part.userData.mirror = { id, type, shape } (shape: true for a
// line or mesh it draws to order, whose points are always sent). Tagged parts are found by themselves.
//
// A lesson whose shapes bend or whose effects run on their own (a rope, strings, cables, bubbles, rays) gives those
// parts a RECIPE instead: a few numbers that say how to draw them (the rope's wave settings, a string's two ends,
// how hard a reaction fizzes). The teacher's headset sends the numbers; the student's headset draws the part from
// them with the lesson's own code, every frame, so it moves smoothly (see shapeRecipe, mirrorLine, glider below).
//   part.userData.mirrorShape = { get: () => [numbers], make: (copyPart) => ({ set(numbers), tick(dt) }) }
//
// Messages are checked: only the teacher (proven by the teacher's key), or the student the teacher chose, is
// listened to; numbers must be numbers, sizes are limited, and pictures must be pictures from this site.
//
// Switches: CLASS_COPY.enabled = false turns it off everywhere; a lesson sets `classCopy = false` to have none
// (Reef Dive: one shared reef round everyone; Hiroshima: a place to stand in; Bounce Lab: on the real floor).

export const CLASS_COPY = {
  enabled: true,
  scale: 1.7, // the copy's size, compared with your own bench
  back: 1.1, // how far behind your bench (m)
  lift: 0.3, // how far above your bench (m)
  tilt: 0.4, // (about 23°) tipped towards you (radians), like the angled mirror over a demonstration bench
  hz: 12, // updates a second from whoever is on the copy
  glide: 0.07, // how quickly the copy's parts catch up (s): about three times this behind the teacher
  shapeHz: 5, // bent shapes (ropes, waves) at most this often
};

const MAX_NODES = 6000;
const MAX_IMG = 400000; // characters in one picture
const MAX_SHAPE = 3000; // numbers in one bent shape (1000 points)
const MAX_RECIPE = 512; // numbers in one recipe
const KEY_RE = /^(@[A-Za-z0-9:_-]{1,40}|\d{1,4})(\.\d{1,4}){0,24}$/;
const ID_RE = /^[A-Za-z0-9:_-]{1,40}$/;
const q3 = (v) => Math.round(v * 1000) / 1000;
const finite = (v, lim = 1e4) => Number.isFinite(v) && Math.abs(v) < lim;
const ACCENT = 0x8fbaff; // the ghost hands, glow and trail: the lessons' light accent blue
const OUTLINE = 0x1d3b8f;

// the 25 joints of a tracked hand (WebXR), and the bones between them
const JOINTS = ['wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4]];
for (const f of [5, 10, 15, 20]) BONES.push([0, f], [f, f + 1], [f + 1, f + 2], [f + 2, f + 3], [f + 3, f + 4]);
const HAND_LEN = 10 + JOINTS.length * 3; // [kind, grip, ray, x, y, z, qx, qy, qz, qw, ...joints]

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
    this.loose = new Map(); // id → copied loose part
    this.moving = new Set(); // copied parts still gliding to where they were sent
    this.drivers = new Set(); // copied parts drawn from a recipe (see shapeRecipe)
    this.recipeSent = new Map(); // (sender) key → the recipe last sent
    this.sourceId = null; // whose bench is on the copy
    this.haveFull = false;
    this.builtAt = 0;
    // sending
    this.sent = new Map(); // key → last state sent
    this.texSent = new Map(); // key → 'uuid:version' of the picture last sent
    this.dynamic = new Set(); // keys whose pictures have changed while the lesson runs
    this.shapeSent = new Map(); // key → 'uuid:version' of the shape last sent
    this.bent = new Set(); // keys whose shapes the lesson has bent
    this.keyOf = new Map(); // (sender) object → key, from the last look round the lab
    this.clock = 0;
    this.shapeClock = 0;
    this.lastFullTo = new Map();
    this.imgQueue = [];
    this.takeBaseline(); // (made in start(), once the lesson has built its lab)
    // ghost hands, glow, trails and the name above the copy
    this.hands = [makeGhost(), makeGhost()];
    this.handsAt = 0;
    this.glows = new Map(); // key → { node, overlays, until }
    this.trails = new Map(); // key → { line, pts: [{ p, t }] }
    this.label = makeLabel();
    this.stage.add(this.label.mesh);
    app.scene.add(this.stage);
  }

  // ───────────── which parts of the lab are copied ─────────────

  /** Panels, other people's (hidden) benches and lights are not copied. */
  skip(o) {
    return !!(o.userData.panel || o.userData.noMirror || o.isLight || o.isCamera);
  }

  /** The lesson's loose parts (see the top of this file), checked. */
  looseParts() {
    let list = [];
    try {
      list = [...(this.app.mirrorParts?.() ?? [])];
    } catch (e) {
      console.warn('Class copy: mirrorParts', e);
    }
    // parts tagged by the lesson where it made them
    const find = (o) => {
      for (const c of o.children) {
        if (this.skip(c)) continue;
        const m = c.userData.mirror;
        if (m && m.id != null) list.push({ id: String(m.id), obj: c, type: m.type });
        find(c);
      }
    };
    find(this.app.lab);
    const seen = new Set();
    return list.filter((l) => l?.obj?.isObject3D && ID_RE.test(String(l.id)) && !seen.has(l.id) && seen.add(l.id));
  }

  /**
   * Visit the lab's parts with their keys: fixed parts by their place in the lab (counting only copied parts,
   * leaving loose parts out), then each loose part by its name ("@heart", "@heart.0"…). fn(o, key, loose) can
   * return false to skip what is inside. Returns object → key.
   */
  walk(fn, loose = this.looseParts()) {
    const looseSet = new Set(loose.map((l) => l.obj));
    const keyOf = new Map([[this.app.lab, '']]);
    const kids = (o, key) => {
      let i = 0;
      for (const c of o.children) {
        if (this.skip(c) || looseSet.has(c)) continue;
        visit(c, key === '' ? String(i++) : `${key}.${i++}`);
      }
    };
    const visit = (o, key, l = null) => {
      keyOf.set(o, key);
      if (fn(o, key, l) === false) return;
      kids(o, key);
    };
    kids(this.app.lab, '');
    for (const l of loose) visit(l.obj, `@${l.id}`, l);
    return keyOf;
  }

  // ───────────── the copy (on everyone else's device) ─────────────

  /** Copy this device's own lab (without its loose parts, which come with the messages). */
  build() {
    if (this.copy) this.stage.remove(this.copy);
    this.nodes.clear();
    this.loose.clear();
    this.moving.clear();
    this.drivers = new Set();
    this.clearExtras();
    const copy = new THREE.Group();
    copy.scale.setScalar(CLASS_COPY.scale);
    const parents = new Map([['', copy]]);
    let n = 0;
    this.walk((o, key, l) => {
      if (l) return false; // (loose parts: made when they are first sent)
      if (n++ > MAX_NODES) return false;
      const c = cloneOne(o);
      if (o.userData.mirrorShape) c.userData.srcShape = o.userData.mirrorShape;
      const dot = key.lastIndexOf('.');
      (parents.get(dot < 0 ? '' : key.slice(0, dot)) ?? copy).add(c);
      parents.set(key, c);
      this.nodes.set(key, c);
    });
    for (const h of this.hands) copy.add(h);
    this.copy = copy;
    this.stage.add(copy);
    this.builtAt = performance.now();
    this.builtCount = n;
    this.haveFull = false;
  }

  /** How many fixed parts this device's own lab has now (to tell whether it has grown since the copy was made). */
  countOwn() {
    let n = 0;
    this.walk((o, key, l) => (l ? false : (n++, n <= MAX_NODES)));
    return n;
  }

  /** A copy of one loose part: from this device's own part of that name, or a new one of its type. */
  makeLoose(id, type) {
    const own = this.looseParts().find((l) => l.id === id);
    let src = own && String(own.type ?? '') === String(type ?? '') ? own.obj : null; // (this device's own, if it is the same kind)
    if (!src && type === 'contact-shadow') src = makeShadowBlob();
    if (!src && typeof type === 'string' && type.length <= 80) {
      try {
        src = this.app.mirrorMake?.(type) ?? null;
      } catch (e) {
        console.warn('Class copy: mirrorMake', e);
      }
    }
    if (!src?.isObject3D) return null;
    const root = cloneTree(src, `@${id}`, this.nodes, (o) => this.skip(o));
    root.userData.mirrorType = type ?? '';
    this.loose.set(id, root);
    return root;
  }

  dropLoose(id) {
    const c = this.loose.get(id);
    if (!c) return;
    c.removeFromParent();
    this.loose.delete(id);
    const pre = `@${id}`;
    for (const k of [...this.nodes.keys()]) if (k === pre || k.startsWith(`${pre}.`)) this.nodes.delete(k);
  }

  /** A part's own material (copied the first time the source's colour differs from this device's). */
  ownMaterial(c) {
    if (c.userData.ownMat || !c.material) return c.material;
    const own = (m) => {
      const k = m.clone();
      k.onBeforeCompile = m.onBeforeCompile;
      k.customProgramCacheKey = m.customProgramCacheKey;
      return k;
    };
    c.material = Array.isArray(c.material) ? c.material.map(own) : own(c.material);
    c.userData.ownMat = true;
    return c.material;
  }

  /** Where a part should go: it glides there (or jumps, the first time or when it was hidden). */
  target(c, r, jump) {
    const t = (c.userData.to ??= { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1) });
    t.p.set(r[2], r[3], r[4]);
    t.q.set(r[5], r[6], r[7], r[8]);
    if (t.q.lengthSq() > 1e-6) t.q.normalize();
    else t.q.identity();
    t.s.set(r[9], r[10], r[11]);
    if (jump || !c.userData.placed || c.position.distanceToSquared(t.p) > 0.25) {
      c.position.copy(t.p);
      c.quaternion.copy(t.q);
      c.scale.copy(t.s);
      c.userData.placed = true;
      this.moving.delete(c);
    } else this.moving.add(c);
  }

  apply(d, from) {
    if (from !== this.sourceId || !d || typeof d !== 'object') return;
    if (!this.copy) this.build();
    const rows = (Array.isArray(d.r) ? d.r.slice(0, MAX_NODES) : []).filter((r) => Array.isArray(r) && typeof r[0] === 'string' && KEY_RE.test(r[0]) && (r.length === SLEN + 1 || (r[0][0] === '@' && !r[0].includes('.') && r.length === SLEN + 3)) && r.every((v, i) => i === 0 || i > SLEN || finite(v, 2e7)));
    // loose parts: make the new ones, drop the ones that have gone, then put each in its place
    const looseRows = rows.filter((r) => r.length === SLEN + 3);
    for (const r of looseRows) {
      const id = r[0].slice(1);
      const type = typeof r[SLEN + 2] === 'string' ? r[SLEN + 2] : '';
      if (this.loose.has(id) && this.loose.get(id).userData.mirrorType !== type) this.dropLoose(id); // (another kind of part now)
      if (!this.loose.has(id)) this.makeLoose(id, type);
    }
    const gone = d.f === 1 ? [...this.loose.keys()].filter((id) => !looseRows.some((r) => r[0] === `@${id}`)) : (Array.isArray(d.x) ? d.x.slice(0, 500) : []);
    for (const id of gone) if (typeof id === 'string') this.dropLoose(id);
    for (const r of looseRows) {
      const c = this.loose.get(r[0].slice(1));
      const pk = r[SLEN + 1];
      const parent = typeof pk === 'string' && (pk === '' || KEY_RE.test(pk)) ? (pk === '' ? this.copy : this.nodes.get(pk)) : null;
      if (c && parent && c.parent !== parent && parent !== c) {
        parent.add(c);
        c.userData.placed = false; // (a new place: jump there)
      }
    }
    let missing = 0;
    for (const r of rows) {
      const c = this.nodes.get(r[0]);
      if (!c) {
        if (r[0][0] !== '@') missing++;
        continue;
      }
      const wasHidden = !c.visible;
      c.visible = r[1] === 1;
      this.target(c, r, wasHidden && c.visible);
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
    if (Array.isArray(d.s)) for (const s of d.s.slice(0, 60)) this.applyShape(s);
    if (Array.isArray(d.p)) for (const p of d.p.slice(0, 200)) this.applyRecipe(p);
    if (d.f === 1) this.haveFull = true;
    // the source has fixed parts this copy does not (the lesson made something new): copy this lab again, and ask
    // (only when this device's own lab has grown since the copy was made, e.g. a model that was still loading;
    // the copy stays shown meanwhile, and everything is asked for again)
    if (missing && performance.now() - this.builtAt > 3000) {
      this.builtAt = performance.now();
      if (this.countOwn() !== this.builtCount) {
        const shown = this.haveFull;
        this.build();
        this.haveFull = shown;
        this.request();
      }
    }
    if (Array.isArray(d.h)) this.applyHands(d.h);
    if (Array.isArray(d.g)) this.applyGlow(d.g);
  }

  /** A part's recipe ([key, [numbers]]): its driver (made once, from this device's own part) draws it. */
  applyRecipe(p) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || !KEY_RE.test(p[0]) || !Array.isArray(p[1])) return;
    const a = p[1];
    if (a.length > MAX_RECIPE || !a.every((v) => finite(v, 1e6))) return;
    const c = this.nodes.get(p[0]);
    const sh = c?.userData.srcShape;
    if (!sh?.make) return;
    if (!c.userData.drv) {
      if (c.geometry && !c.userData.ownGeo) {
        c.geometry = c.geometry.clone(); // (drawn on its own, never on this device's own part)
        c.userData.ownGeo = true;
      }
      try {
        c.userData.drv = sh.make(c) ?? { set() {} };
      } catch (e) {
        console.warn('Class copy: recipe', e);
        c.userData.drv = { set() {} };
      }
      this.drivers.add(c);
    }
    try {
      c.userData.lastRecipe = a; // (for checking)
      c.userData.drv.set(a);
    } catch (e) {
      if (!c.userData.drvBad) console.warn('Class copy: recipe', e);
      c.userData.drvBad = true;
    }
  }

  /** A shape the source's lesson bent (a rope, a wave, a cable): [key, [x, y, z, …], [triangle order]?]. */
  applyShape(s) {
    if (!Array.isArray(s) || (s.length !== 2 && s.length !== 3) || typeof s[0] !== 'string' || !KEY_RE.test(s[0]) || !Array.isArray(s[1])) return;
    const a = s[1];
    if (a.length > MAX_SHAPE || a.length % 3 || !a.every((v) => finite(v, 1e4))) return;
    const idx = Array.isArray(s[2]) && s[2].length <= MAX_SHAPE * 2 && s[2].every((v) => Number.isInteger(v) && v >= 0 && v < a.length / 3) ? s[2] : null;
    const c = this.nodes.get(s[0]);
    if (!c?.geometry) return;
    if (!c.userData.ownGeo) {
      c.geometry = c.geometry.clone();
      c.userData.ownGeo = true;
    }
    const g = c.geometry;
    let pos = g.getAttribute('position');
    if (!pos || pos.array.length !== a.length) {
      pos = new THREE.BufferAttribute(new Float32Array(a.length), 3);
      g.setAttribute('position', pos);
      if (g.index && g.index.count && a.length / 3 <= Math.max(...g.index.array)) g.setIndex(null);
    }
    pos.array.set(a);
    pos.needsUpdate = true;
    if (idx) g.setIndex(idx);
    else if (s.length === 3) g.setIndex(null);
    g.setDrawRange(0, Infinity);
    if (c.isMesh) {
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && g.attributes[k].count !== pos.count) g.deleteAttribute(k);
      g.computeVertexNormals();
    }
    g.computeBoundingSphere();
    g.computeBoundingBox();
  }

  applyHands(list) {
    this.handsAt = performance.now();
    this.hands.forEach((g, i) => {
      const h = list[i];
      const ok = Array.isArray(h) && (h.length === 10 || h.length === HAND_LEN) && h.every((v) => finite(v, 100));
      g.visible = ok;
      if (!ok) return;
      g.userData.set(h);
    });
  }

  /** What the source is holding or reaching for: glows on the copy, and leaves a fading trail while it moves. */
  applyGlow(keys) {
    const now = performance.now();
    for (const k of keys.slice(0, 6)) {
      if (typeof k !== 'string' || !KEY_RE.test(k)) continue;
      const node = this.nodes.get(k);
      if (!node) continue;
      let gl = this.glows.get(k);
      if (!gl || gl.node !== node) {
        if (gl) removeOverlays(gl);
        gl = { node, overlays: addOverlays(node) };
        this.glows.set(k, gl);
      }
      gl.until = now + 400;
      if (!this.trails.has(k)) {
        const line = makeTrail();
        this.copy.add(line);
        this.trails.set(k, { line, pts: [] });
      }
      this.trails.get(k).until = now + 400;
    }
  }

  clearExtras() {
    for (const gl of this.glows.values()) removeOverlays(gl);
    this.glows.clear();
    for (const t of this.trails.values()) t.line.removeFromParent();
    this.trails.clear();
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

  /** Ask whoever is on the copy for everything. */
  request() {
    const pr = this.app.presence;
    if (this.sourceId && this.sourceId !== pr?.selfId) pr?.mirrorReqCh?.send(1, this.sourceId);
  }

  // ───────────── sending (whoever is on the copy) ─────────────

  /**
   * Everything (full: for one device that asked; nothing is marked as sent), or only what changed since the
   * last update to everyone. Loose parts' rows carry their parent's key and their type.
   */
  collect(full, pictures = null, shapes = null) {
    const rows = [];
    const recipes = (this.recipes = []);
    const keys = new Set();
    const loose = this.looseParts();
    const looseRows = new Map();
    let n = 0;
    const keyOf = this.walk((o, key, l) => {
      if (n++ > MAX_NODES) return false;
      keys.add(key);
      const now = stateOf(o, new Array(SLEN));
      if (l) {
        // a loose part: where it is, in its parent (decided below, once every key is known)
        looseRows.set(key, { o, now, type: typeof l.type === 'string' ? l.type.slice(0, 80) : '' });
        return full || o.visible;
      }
      if (o.userData.mirrorShape) this.noteRecipe(o, key, full, recipes);
      if (full) {
        rows.push([key, ...now]);
        const t = pictures && this.changedPicture(o, key);
        if (t) pictures.push({ key, t });
        if (shapes && this.bent.has(key)) shapes.push(key);
        return true; // (a full update also describes what is inside hidden parts)
      }
      if (this.changed(key, now)) rows.push([key, ...now]);
      this.watchPicture(o, key);
      return o.visible; // (parts inside something hidden are not looked at until it shows again)
    }, loose);
    this.keyOf = keyOf;
    // loose parts: their parent's key, or (a parent outside the copied lab) their place relative to the lab
    for (const [key, { o, now, type }] of looseRows) {
      let pk = keyOf.get(o.parent);
      if (pk === undefined) {
        pk = '';
        let top = o;
        while (top.parent) top = top.parent;
        if (top !== this.app.scene) {
          now[0] = 0; // (taken out of the scene by the lesson: not shown)
          const row = [key, ...now, pk, type];
          if (full || this.changed(key, now, pk)) rows.push(row);
          continue;
        }
        this.app.lab.updateMatrixWorld();
        const m = this.app.lab.matrixWorld.clone().invert().multiply(o.matrixWorld);
        const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        m.decompose(p, q, s);
        stateOf({ visible: o.visible, position: p, quaternion: q, scale: s, material: o.material }, now);
      }
      const row = [key, ...now, pk, type];
      if (full || this.changed(key, now, pk)) rows.push(row);
    }
    if (!full) {
      // parts not looked at (inside something hidden, or gone) are described afresh when they are next seen
      for (const k of this.sent.keys()) if (!keys.has(k)) this.sent.delete(k);
      // loose parts that have gone
      const ids = new Set(loose.map((l) => l.id));
      this.goneLoose = [...(this.lastLoose ?? [])].filter((id) => !ids.has(id));
      this.lastLoose = ids;
    }
    return rows;
  }

  /** A part's recipe, if it changed since it was last sent (or for everything). */
  noteRecipe(o, key, full, out) {
    let a;
    try {
      a = o.userData.mirrorShape.get?.() ?? null;
    } catch (e) {
      return;
    }
    if (!Array.isArray(a) && !(a instanceof Float32Array)) return;
    const r = Array.from(a.slice(0, MAX_RECIPE), (v) => (Number.isFinite(v) ? Math.round(v * 10000) / 10000 : 0));
    const j = r.join(',');
    if (!full) {
      if (this.recipeSent.get(key) === j) return;
      this.recipeSent.set(key, j);
    }
    out.push([key, r]);
  }

  /** Has this part changed since it was last sent? (Remembers it as sent.) */
  changed(key, now, extra = null) {
    const last = this.sent.get(key);
    let ch = !last || last.extra !== extra;
    if (last) for (let i = 0; i < SLEN && !ch; i++) if (now[i] !== last[i]) ch = true;
    if (ch) {
      const keep = now.slice();
      keep.extra = extra;
      this.sent.set(key, keep);
    }
    return ch;
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

  /** Shapes the lesson bends (a rope, a wave): small ones are sent when they change, a few times a second. */
  bentShapes(full) {
    const out = []; // candidates: { o, key, stamp, pos }
    for (const [o, key] of this.keyOf) {
      if (!o.geometry || !(o.isMesh || o.isLine || o.isPoints) || o.isInstancedMesh || !o.visible || this.inRecipe(o)) continue;
      const pos = o.geometry.getAttribute('position');
      if (!pos || pos.isInterleavedBufferAttribute || pos.array.length > MAX_SHAPE) continue;
      const stamp = `${o.geometry.uuid}:${pos.version}:${pos.array.length}`;
      const base = this.shapeBase.get(key);
      if (!this.bent.has(key) && o.userData.mirror?.shape) this.bent.add(key); // (drawn to order: always sent)
      if (!this.bent.has(key)) {
        if (!base || base === stamp) {
          if (!base) this.shapeBase.set(key, stamp);
          continue;
        }
        this.bent.add(key);
      }
      if (!full && this.shapeSent.get(key) === stamp) continue;
      out.push({ o, key, stamp, pos });
    }
    // (taking turns: the shapes that waited longest go first, so one that changes all the time never crowds out the rest)
    const at = (this.shapeAt ??= new Map());
    if (!full) out.sort((x, y) => (at.get(x.key) ?? 0) - (at.get(y.key) ?? 0));
    const now = performance.now();
    return out.slice(0, full ? 60 : 20).map(({ o, key, stamp, pos }) => {
      if (!full) {
        this.shapeSent.set(key, stamp);
        at.set(key, now);
      }
      const index = o.geometry.index;
      return index && index.count <= MAX_SHAPE * 2 ? [key, Array.from(pos.array, q3), Array.from(index.array)] : [key, Array.from(pos.array, q3), 0];
    });
  }

  /** Is this part (or something it is inside) drawn from a recipe? Then its shape is the recipe's business. */
  inRecipe(o) {
    for (let p = o; p && p !== this.app.lab; p = p.parent) if (p.userData.mirrorShape) return true;
    return false;
  }

  /** How every picture and shape was when the lesson started (the same on every device). */
  takeBaseline() {
    this.baseline = new Map();
    this.shapeBase = new Map();
    this.walk((o, key) => {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m?.map) this.baseline.set(key, { uuid: m.map.uuid, version: m.map.version });
      const pos = o.geometry?.getAttribute?.('position');
      if (pos && !pos.isInterleavedBufferAttribute) this.shapeBase.set(key, `${o.geometry.uuid}:${pos.version}:${pos.array.length}`);
      else if (o.geometry && !pos) this.shapeBase.set(key, 'empty'); // (drawn later, e.g. a cable: always counts as bent)
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

  /**
   * Where my hands are, in my lab's coordinates. Each: [kind (0 controller, 1 hand, 2 mouse), holding, ray length,
   * x, y, z, qx, qy, qz, qw] (the pointing pose), followed for a bare hand by its 25 joints (x, y, z each).
   */
  myHands() {
    const app = this.app;
    const it = app.interaction;
    if (!it) return [];
    app.lab.updateMatrixWorld();
    const inv = app.lab.matrixWorld.clone().invert();
    const labQ = app.lab.getWorldQuaternion(new THREE.Quaternion()).invert();
    const targets = app.grabTargets().filter((o) => o.visible);
    const out = [];
    if (app.presenting) {
      it.controllers.forEach((c, i) => {
        const mode = c.userData.mode;
        if (!mode || mode === 'screen' || mode === 'gaze') return out.push(0);
        const isHand = !!c.userData.inputSource?.hand;
        const p = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
        // the pointer ray, when it points at something in the lab
        let ray = 0;
        if (mode === 'tracked-pointer' && c.userData.line?.visible !== false && !it.active.has(c)) {
          const m = new THREE.Matrix4().extractRotation(c.matrixWorld);
          const rc = new THREE.Raycaster(p.clone(), new THREE.Vector3(0, 0, -1).applyMatrix4(m), 0, 3);
          const hit = rc.intersectObjects(targets, false)[0];
          if (hit) ray = q3(hit.distance);
        }
        const q = labQ.clone().multiply(c.getWorldQuaternion(new THREE.Quaternion()));
        const row = [isHand ? 1 : 0, it.active.has(c) ? 1 : 0, ray, ...p.applyMatrix4(inv).toArray().map(q3), ...q.toArray().map(q3)];
        if (isHand) {
          const hand = it.hands[i];
          for (const name of JOINTS) {
            const j = hand?.joints?.[name];
            if (!j) {
              row[0] = 0; // (no joints yet: drawn as a simple pointer)
              row.length = 10;
              break;
            }
            row.push(...j.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).toArray().map(q3));
          }
        }
        out.push(row);
      });
    } else if (it.mouseInside) {
      // a computer: one hand where the mouse is over the lab (holding: where the held thing is)
      const g = it.active.get('mouse');
      let p = null;
      if (g) p = g.handle.getWorldPosition(new THREE.Vector3());
      else {
        it.raycaster.setFromCamera(it.pointer, app.camera);
        const hit = it.raycaster.intersectObjects(targets, false)[0];
        if (hit) p = hit.point;
      }
      if (p) {
        const dir = p.clone().sub(app.camera.getWorldPosition(new THREE.Vector3())).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        out.push([2, g ? 1 : 0, 0, ...p.applyMatrix4(inv).toArray().map(q3), ...labQ.clone().multiply(q).toArray().map(q3)]);
      }
    }
    return out;
  }

  /** The keys of what I am holding or reaching for (they glow on the copy). */
  myGlow() {
    const it = this.app.interaction;
    if (!it) return [];
    const objs = [...[...it.active.values()].map((g) => g.object), ...it.reach.values()];
    const out = [];
    for (let o of objs) {
      while (o && !this.keyOf.has(o)) o = o.parent;
      const k = o && this.keyOf.get(o);
      if (k && !out.includes(k)) out.push(k);
    }
    return out;
  }

  /** Someone (re)joined: if I am on the copy, they get everything; if it is whoever is on my copy, I ask. */
  peerJoined(id) {
    const pr = this.app.presence;
    if (this.sourceId && this.sourceId === pr.selfId) setTimeout(() => this.sendFull(id), 600);
    else if (id === this.sourceId) setTimeout(() => this.request(), 600);
  }

  /** Someone asked for everything (they joined, rejoined, switched the copy on, or I have just come on it). */
  sendFull(to) {
    if (!this.wanted) return;
    const now = performance.now();
    if (now - (this.lastFullTo.get(to) ?? 0) < 1500) return;
    this.lastFullTo.set(to, now);
    const pictures = [];
    const shapes = [];
    const rows = this.collect(true, pictures, shapes);
    const bent = this.bentShapes(true).filter((s) => shapes.includes(s[0]) || this.bent.has(s[0]));
    this.app.presence.mirrorCh?.send({ f: 1, r: rows, s: bent, p: this.recipes, h: this.myHands(), g: this.myGlow() }, to);
    this.sendImages(pictures, to);
  }

  // ───────────── every frame ─────────────

  /** Whose bench is on the copy: the student the teacher chose, or the teacher. */
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
    const wanted = !!app.copyWanted; // the teacher has put My Bench behind every bench (or is showing a student's work)
    const fresh = wanted && !this.wanted;
    this.wanted = wanted;
    if (src !== this.sourceId || fresh) {
      if (src !== this.sourceId) this.clearExtras();
      this.sourceId = src;
      this.haveFull = false;
      this.sent.clear(); // (sending afresh if it is me)
      this.recipeSent.clear();
      this.shapeSent.clear();
      this.firstSend = true;
      if (wanted && src && src !== pr.selfId) {
        if (!this.copy) this.build();
        this.request();
        this.askedAt = performance.now();
      }
      this.label.draw(this.labelText());
    }
    // someone else is on the copy and it is wanted: show it (once their first full update has arrived)
    if (wanted && src && src !== pr?.selfId && !this.haveFull && performance.now() - (this.askedAt ?? 0) > 4000) {
      this.askedAt = performance.now();
      this.request(); // (asked, nothing yet: ask again)
    }
    this.stage.visible = wanted && !!src && src !== pr?.selfId && this.haveFull;
    if (this.stage.visible) {
      app.lab.updateMatrixWorld();
      this.stage.position.set(0, CLASS_COPY.lift, -CLASS_COPY.back).applyMatrix4(app.lab.matrixWorld);
      this.stage.quaternion.copy(app.lab.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CLASS_COPY.tilt));
      const name = this.labelText();
      if (name !== this.label.text) this.label.draw(name);
      this.glide(dt);
      for (const c of this.drivers) {
        try {
          c.userData.drv.tick?.(dt);
        } catch (e) {
          if (!c.userData.drvBad) console.warn('Class copy: recipe', e);
          c.userData.drvBad = true;
        }
      }
      const stale = performance.now() - this.handsAt > 1500;
      for (const h of this.hands) {
        if (stale) h.visible = false;
        else h.userData.glide(dt);
      }
      this.updateExtras();
    }
    // I am on the copy and it is wanted: send what changed
    if (wanted && src && src === pr.selfId && pr.peers.size) {
      this.clock += dt;
      this.shapeClock += dt;
      if (this.clock >= 1 / CLASS_COPY.hz) {
        this.clock = 0;
        const first = this.firstSend;
        this.firstSend = false;
        const rows = this.collect(first);
        const msg = { f: first ? 1 : 0, r: rows, h: this.myHands(), g: this.myGlow() };
        if (this.recipes.length) msg.p = this.recipes;
        if (!first && this.goneLoose?.length) msg.x = this.goneLoose;
        if (first || this.shapeClock >= 1 / CLASS_COPY.shapeHz) {
          this.shapeClock = 0;
          const s = this.bentShapes(first);
          if (s.length) msg.s = s;
        }
        pr.mirrorCh?.send(msg);
        this.sendImages();
      }
    }
  }

  /** The copy's parts glide towards where they were sent (about 0.2 s to arrive). */
  glide(dt) {
    const k = 1 - Math.exp(-dt / CLASS_COPY.glide);
    for (const c of this.moving) {
      const t = c.userData.to;
      c.position.lerp(t.p, k);
      c.quaternion.slerp(t.q, k);
      c.scale.lerp(t.s, k);
      if (c.position.distanceToSquared(t.p) < 1e-8 && c.quaternion.angleTo(t.q) < 1e-3) {
        c.position.copy(t.p);
        c.quaternion.copy(t.q);
        c.scale.copy(t.s);
        this.moving.delete(c);
      }
    }
  }

  /** Glow fades away when the teacher lets go; the trail follows what they hold, and fades after. */
  updateExtras() {
    const now = performance.now();
    for (const [k, gl] of this.glows) {
      if (now > gl.until) {
        removeOverlays(gl);
        this.glows.delete(k);
      }
    }
    const tmp = new THREE.Vector3();
    for (const [k, tr] of this.trails) {
      const node = this.nodes.get(k);
      if (node && now < tr.until && node.parent) {
        node.getWorldPosition(tmp);
        const p = this.copy.worldToLocal(tmp.clone());
        const last = tr.pts[tr.pts.length - 1];
        if (!last || last.p.distanceToSquared(p) > 1e-6) tr.pts.push({ p, t: now });
      }
      tr.pts = tr.pts.filter((x) => now - x.t < 1400);
      if (!tr.pts.length && now > tr.until) {
        tr.line.removeFromParent();
        this.trails.delete(k);
        continue;
      }
      drawTrail(tr, now);
    }
  }

  /** "Your Teacher's Bench", or "Maria's Work" while the teacher shows a student's work. */
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

// ───────────── recipes: helpers for lessons ─────────────

/** Give a part a recipe: get() → numbers (on the sender); make(copyPart) → { set(numbers), tick(dt) } (on the copy). */
export function shapeRecipe(obj, get, make) {
  obj.userData.mirrorShape = { get, make };
  return obj;
}

/**
 * Numbers that glide towards the latest ones they are given (about 0.2 s behind), as the copy's parts do.
 * step(dt) returns the current numbers while they move, and null once they have arrived.
 */
export function glider() {
  let cur = null;
  let to = null;
  let moving = false;
  return {
    to(a) {
      if (!cur || cur.length !== a.length) {
        cur = Float32Array.from(a);
        to = Float32Array.from(a);
      } else to.set(a);
      moving = true;
    },
    step(dt) {
      if (!moving || !cur) return null;
      const k = 1 - Math.exp(-dt / CLASS_COPY.glide);
      let d = 0;
      for (let i = 0; i < cur.length; i++) {
        const x = to[i] - cur[i];
        cur[i] += x * k;
        d = Math.max(d, Math.abs(x));
      }
      if (d < 1e-5) {
        cur.set(to);
        moving = false;
      }
      return cur;
    },
    get now() {
      return cur;
    },
  };
}

/** A small line or strip whose points the lesson moves (a string, a leader line, a cable): its recipe is its points. */
export function mirrorLine(obj, maxPoints = 64) {
  return shapeRecipe(obj, () => {
    const p = obj.geometry?.getAttribute('position');
    return p && p.count <= maxPoints ? Array.from(p.array).slice(0, p.count * 3) : null;
  }, (copy) => {
    const g = glider();
    return {
      set: (a) => g.to(a),
      tick: (dt) => {
        const v = g.step(dt);
        if (!v) return;
        let pos = copy.geometry.getAttribute('position');
        if (!pos || pos.array.length !== v.length) {
          pos = new THREE.BufferAttribute(new Float32Array(v.length), 3);
          copy.geometry.setAttribute('position', pos);
        }
        pos.array.set(v);
        pos.needsUpdate = true;
        copy.geometry.setDrawRange(0, Infinity);
        copy.geometry.computeBoundingSphere();
        copy.geometry.computeBoundingBox();
      },
    };
  });
}

/** Inside a copied group, the copy of one of the original group's parts (same place among the copied parts). */
export function twinOf(copyRoot, origRoot, orig) {
  const skip = (o) => !!(o.userData.panel || o.userData.noMirror || o.isLight || o.isCamera);
  const path = [];
  for (let o = orig; o && o !== origRoot; o = o.parent) {
    if (!o.parent) return null;
    path.unshift(o.parent.children.filter((c) => !skip(c)).indexOf(o));
  }
  let c = copyRoot;
  for (const i of path) c = c?.children.filter((k) => !k.userData.ghost && !k.userData.glowOverlay && !k.userData.trail)[i];
  return c ?? null;
}

// ───────────── copying parts ─────────────

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

/** A copy of a part and everything inside it, each registered under its key. */
function cloneTree(o, key, nodes, skip) {
  const c = cloneOne(o);
  if (o.userData.mirrorShape) c.userData.srcShape = o.userData.mirrorShape;
  nodes.set(key, c);
  let i = 0;
  for (const k of o.children) {
    if (skip(k)) continue;
    c.add(cloneTree(k, `${key}.${i++}`, nodes, skip));
  }
  return c;
}

// ───────────── glow and trails ─────────────

const glowMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, toneMapped: false });

function addOverlays(node) {
  const out = [];
  node.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.userData.glowOverlay || !m.geometry) return;
    const g = new THREE.Mesh(m.geometry, glowMat);
    g.userData.glowOverlay = true;
    g.scale.setScalar(1.08);
    g.renderOrder = 4;
    out.push([m, g]);
  });
  for (const [m, g] of out.slice(0, 60)) m.add(g);
  return out.slice(0, 60).map(([, g]) => g);
}

function removeOverlays(gl) {
  for (const g of gl.overlays) g.removeFromParent();
}

const TRAIL_N = 48;

function makeTrail() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  line.frustumCulled = false;
  line.renderOrder = 5;
  line.userData.trail = true;
  return line;
}

function drawTrail(tr, now) {
  const pts = tr.pts.slice(-TRAIL_N);
  const pos = tr.line.geometry.getAttribute('position');
  const col = tr.line.geometry.getAttribute('color');
  const c = new THREE.Color(ACCENT);
  pts.forEach((x, i) => {
    pos.setXYZ(i, x.p.x, x.p.y, x.p.z);
    const a = Math.max(0, 1 - (now - x.t) / 1400); // fades along its length (additive: darker is fainter)
    col.setXYZ(i, c.r * a, c.g * a, c.b * a);
  });
  pos.needsUpdate = true;
  col.needsUpdate = true;
  tr.line.geometry.setDrawRange(0, pts.length);
}

// ───────────── ghost hands ─────────────

/**
 * The teacher's hand over the copy, in bright see-through blue with a darker edge: a tracked hand's real joints
 * and bones, a controller's shape, or (a computer) a simple hand at the mouse. Its pointer ray, when pointing.
 */
function makeGhost() {
  const fill = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false });
  const edge = new THREE.MeshBasicMaterial({ color: OUTLINE, transparent: true, opacity: 0.85, side: THREE.BackSide, depthWrite: false, toneMapped: false });
  const g = new THREE.Group();
  g.renderOrder = 6;
  g.userData.ghost = true; // (not part of the copied lab)
  g.visible = false;
  const pair = (geo, edgeScale = 1.35) => {
    const grp = new THREE.Group();
    const a = new THREE.Mesh(geo, fill);
    const b = new THREE.Mesh(geo, edge);
    b.scale.setScalar(edgeScale);
    a.renderOrder = 7;
    b.renderOrder = 6;
    grp.add(b, a);
    return grp;
  };

  // a tracked hand: joints and bones
  const hand = new THREE.Group();
  const jointGeo = new THREE.SphereGeometry(0.0075, 10, 8);
  const boneGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const joints = new THREE.InstancedMesh(jointGeo, fill, JOINTS.length);
  const jointsEdge = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0105, 10, 8), edge, JOINTS.length);
  const bones = new THREE.InstancedMesh(boneGeo, fill, BONES.length);
  const bonesEdge = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0085, 0.0085, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), edge, BONES.length);
  for (const m of [joints, jointsEdge, bones, bonesEdge]) {
    m.frustumCulled = false;
    hand.add(m);
  }
  joints.renderOrder = bones.renderOrder = 7;
  g.add(hand);

  // a controller (or a hand whose joints are not known yet): a grip and a ring, pointing forward
  const ctrl = new THREE.Group();
  ctrl.add(pair(new THREE.CapsuleGeometry(0.018, 0.07, 4, 10).rotateX(Math.PI / 2).translate(0, -0.01, 0.04), 1.18));
  ctrl.add(pair(new THREE.TorusGeometry(0.032, 0.006, 8, 24).rotateX(Math.PI / 2.6).translate(0, 0.012, -0.012), 1.4));
  g.add(ctrl);

  // a computer's mouse: a simple pointing hand
  const mouse = new THREE.Group();
  const palm = pair(new THREE.SphereGeometry(1, 16, 10), 1.12);
  palm.scale.set(0.038, 0.014, 0.045);
  palm.position.set(0, 0, 0.07);
  mouse.add(palm);
  const finger = pair(new THREE.CapsuleGeometry(0.009, 0.05, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.03), 1.25);
  finger.position.set(-0.008, 0, 0.03);
  mouse.add(finger);
  g.add(mouse);

  // the pointer ray
  const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 1, 6).rotateX(Math.PI / 2).translate(0, 0, -0.5), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
  ray.visible = false;
  const rayDot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), fill);
  ray.add(rayDot);
  g.add(ray);

  // targets (where the latest message says) and what is shown (gliding towards them)
  const to = { p: new THREE.Vector3(), q: new THREE.Quaternion(), j: new Float32Array(JOINTS.length * 3), kind: -1, ray: 0, grip: 0 };
  const now = { j: new Float32Array(JOINTS.length * 3) };
  const m4 = new THREE.Matrix4();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const q = new THREE.Quaternion(), s = new THREE.Vector3();
  const fwd = new THREE.Vector3(0, 0, 1);
  let fresh = true;

  g.userData.set = (h) => {
    const kind = h[0];
    const jump = fresh || kind !== to.kind;
    to.kind = kind;
    to.grip = h[1];
    to.ray = h[2];
    to.p.set(h[3], h[4], h[5]);
    to.q.set(h[6], h[7], h[8], h[9]);
    if (to.q.lengthSq() > 1e-6) to.q.normalize();
    const hasJoints = kind === 1 && h.length === HAND_LEN;
    if (hasJoints) to.j.set(h.slice(10));
    hand.visible = hasJoints;
    ctrl.visible = kind === 0 || (kind === 1 && !hasJoints);
    mouse.visible = kind === 2;
    finger.rotation.x = to.grip ? -0.9 : 0;
    if (jump) {
      g.position.copy(to.p);
      g.quaternion.copy(to.q);
      now.j.set(to.j);
    }
    fresh = false;
  };

  g.userData.glide = (dt) => {
    const k = 1 - Math.exp(-dt / CLASS_COPY.glide);
    g.position.lerp(to.p, k);
    g.quaternion.slerp(to.q, k);
    ray.visible = to.ray > 0;
    if (ray.visible) {
      ray.scale.set(1, 1, to.ray);
      rayDot.scale.set(1, 1, 1 / Math.max(0.01, to.ray));
      rayDot.position.set(0, 0, -1);
    }
    if (!hand.visible) return;
    for (let i = 0; i < now.j.length; i++) now.j[i] += (to.j[i] - now.j[i]) * k;
    // joints and bones are drawn in the copy's coordinates: undo the group's own pose
    hand.matrixAutoUpdate = false;
    g.updateMatrix();
    hand.matrix.copy(g.matrix).invert();
    hand.matrixWorldNeedsUpdate = true;
    for (let i = 0; i < JOINTS.length; i++) {
      m4.makeTranslation(now.j[i * 3], now.j[i * 3 + 1], now.j[i * 3 + 2]);
      joints.setMatrixAt(i, m4);
      jointsEdge.setMatrixAt(i, m4);
    }
    BONES.forEach(([i0, i1], i) => {
      a.fromArray(now.j, i0 * 3);
      b.fromArray(now.j, i1 * 3);
      d.subVectors(b, a);
      const len = d.length() || 1e-4;
      q.setFromUnitVectors(fwd, d.normalize());
      s.set(1, 1, len);
      m4.compose(a, q, s);
      bones.setMatrixAt(i, m4);
      bonesEdge.setMatrixAt(i, m4);
    });
    for (const m of [joints, jointsEdge, bones, bonesEdge]) m.instanceMatrix.needsUpdate = true;
  };
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
  mesh.position.set(0, 0.5 * CLASS_COPY.scale, 0.3 * CLASS_COPY.scale); // just above the front of the copy
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
