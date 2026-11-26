import * as THREE from 'three';

// Moving around the city, in the headset and on a screen. The ground is flat (y = 0, the bridge included), so
// walking only asks the moment's walk map (src/world/layout.js WalkMap) whether a spot is free: streets, paths,
// the park and the bridge are; buildings, rubble heaps and the rivers are not. Walking slides along anything in
// the way. Teleporting jumps to any free ground you point at.
// In the headset we never move the city: we move you, by offsetting the WebXR reference space.

const EYE = 1.6; // eye height on a screen (m)
const yawOf = (dir) => Math.atan2(-dir.x, -dir.z); // rotation about y that turns −z (forward) towards dir

export class Walker {
  constructor(app) {
    this.app = app;
    this.walk = null; // the current moment's WalkMap
    this.origin = { x: 0, y: 0, z: 0, yaw: 0 }; // headset: where the play area's origin is in the city
    this.desk = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }; // screen: the walking camera
    this.baseRef = null;
    this.glide = null;
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.free = false; // true while somewhere off the map (the hills during 8:15): no walking
  }

  ok(x, z) {
    return !this.free && !!this.walk?.ok(x, z);
  }

  /** Where a ray meets the ground (or null), within `far` metres. */
  cast(from, dir, far = 120) {
    const ray = new THREE.Ray(from, dir.clone().normalize());
    const p = ray.intersectPlane(this.ground, new THREE.Vector3());
    if (!p || p.distanceTo(from) > far) return null;
    return p;
  }

  standable(p) {
    return this.ok(p.x, p.z);
  }

  /** Try to walk from (x, z) by (dx, dz), sliding along anything in the way. */
  step(x, z, dx, dz) {
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      if (Math.abs(mx) + Math.abs(mz) < 1e-6) continue;
      const nx = x + mx, nz = z + mz;
      // look a little ahead too, so you stop before a wall rather than in it
      const len = Math.hypot(mx, mz);
      if (this.ok(nx, nz) && this.ok(nx + (mx / len) * 0.25, nz + (mz / len) * 0.25)) return { x: nx, z: nz };
    }
    return null;
  }

  // ───────────── headset ─────────────

  startXR() {
    this.baseRef = this.app.renderer.xr.getReferenceSpace();
    this.applyOrigin();
  }

  stopXR() {
    this.baseRef = null;
  }

  originMatrix() {
    const o = this.origin;
    return new THREE.Matrix4().compose(new THREE.Vector3(o.x, o.y, o.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw), new THREE.Vector3(1, 1, 1));
  }

  applyOrigin() {
    if (!this.baseRef) return;
    const inv = this.originMatrix().invert();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    inv.decompose(p, q, new THREE.Vector3());
    const offset = this.baseRef.getOffsetReferenceSpace(new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, { x: q.x, y: q.y, z: q.z, w: q.w }));
    this.app.renderer.xr.setReferenceSpace(offset);
  }

  head() {
    const world = this.app.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
    const local = world.clone().applyMatrix4(this.originMatrix().invert());
    return { world, local };
  }

  facing() {
    const d = new THREE.Vector3();
    this.app.renderer.xr.getCamera().getWorldDirection(d);
    d.y = 0;
    return d.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, -1) : d.normalize();
  }

  /** Put your head above `pos` (feet at pos[1]), optionally turned to face `look`. */
  teleportXR(pos, look = null) {
    const o = this.origin;
    const { local } = this.head();
    if (look) {
      const want = yawOf(new THREE.Vector3(look[0] - pos[0], 0, look[2] - pos[2]));
      const headYaw = yawOf(this.facing().applyAxisAngle(new THREE.Vector3(0, 1, 0), -o.yaw));
      o.yaw = want - headYaw;
    }
    const off = new THREE.Vector3(local.x, 0, local.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw);
    o.x = pos[0] - off.x;
    o.z = pos[2] - off.z;
    o.y = pos[1];
    this.applyOrigin();
  }

  moveXR(forward, strafe, dt) {
    if (Math.abs(forward) < 0.15 && Math.abs(strafe) < 0.15) return;
    const speed = 1.8;
    const f = this.facing();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const d = f.multiplyScalar(forward * speed * dt).addScaledVector(r, strafe * speed * dt);
    const { world } = this.head();
    const to = this.step(world.x, world.z, d.x, d.z);
    if (!to) return;
    this.origin.x += to.x - world.x;
    this.origin.z += to.z - world.z;
    this.applyOrigin();
  }

  turnXR(angle) {
    const { world } = this.head();
    const o = this.origin;
    const rel = new THREE.Vector3(o.x - world.x, 0, o.z - world.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    o.x = world.x + rel.x;
    o.z = world.z + rel.z;
    o.yaw += angle;
    this.applyOrigin();
  }

  // ───────────── screen ─────────────

  placeCamera(camera) {
    const d = this.desk;
    camera.position.set(d.x, d.y + EYE, d.z);
    camera.rotation.set(d.pitch, d.yaw, 0, 'YXZ');
  }

  teleportDesk(pos, look = null, smooth = true) {
    const d = this.desk;
    const target = { x: pos[0], y: pos[1], z: pos[2], yaw: d.yaw, pitch: d.pitch };
    if (look) {
      const dir = new THREE.Vector3(look[0] - pos[0], look[1] - (pos[1] + EYE), look[2] - pos[2]);
      target.yaw = yawOf(dir);
      target.pitch = Math.max(-1.2, Math.min(1.3, Math.atan2(dir.y, Math.hypot(dir.x, dir.z))));
    }
    if (!smooth) {
      Object.assign(d, target);
      this.glide = null;
    } else this.glide = { from: { ...d }, to: target, t: 0 };
  }

  moveDesk(forward, strafe, dt, fast = false) {
    if (this.glide) return;
    const d = this.desk;
    const speed = fast ? 6 : 2.4;
    const f = new THREE.Vector3(-Math.sin(d.yaw), 0, -Math.cos(d.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const v = f.multiplyScalar(forward * speed * dt).addScaledVector(r, strafe * speed * dt);
    if (v.lengthSq() < 1e-8) return;
    const to = this.step(d.x, d.z, v.x, v.z);
    if (!to) return;
    d.x = to.x;
    d.z = to.z;
  }

  update(dt) {
    const g = this.glide;
    if (!g) return;
    g.t = Math.min(1, g.t + dt / 0.6);
    const k = g.t * g.t * (3 - 2 * g.t);
    const d = this.desk;
    for (const key of ['x', 'y', 'z', 'pitch']) d[key] = g.from[key] + (g.to[key] - g.from[key]) * k;
    d.yaw = g.from.yaw + Math.atan2(Math.sin(g.to.yaw - g.from.yaw), Math.cos(g.to.yaw - g.from.yaw)) * k;
    if (g.t >= 1) this.glide = null;
  }
}
