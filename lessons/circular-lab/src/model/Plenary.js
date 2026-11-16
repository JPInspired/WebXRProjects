import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { TOP } from './Kit.js';

// The plenary models on the bench: a small Earth with a satellite in orbit, and a car going round a bend.
// Each has its centripetal force (red arrow, towards the centre) and velocity (green, along the tangent), and
// a way to take the force away: switch off gravity, or put ice on the road. Then, like the ball whose string is
// cut, it carries straight on along the tangent, leaving a trail, and comes back after a few seconds.

const EARTH = new THREE.Vector3(-0.27, TOP + 0.14, 0.06);
const ORBIT = 0.17;
const TRACK = new THREE.Vector3(0.27, TOP, 0.06);
const BEND = 0.11;

function earthTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1d5fa8';
  x.fillRect(0, 0, 512, 256);
  // simple continents (made up blobs: this is a teaching model, not a map)
  x.fillStyle = '#3f9b4a';
  const blob = (cx, cy, rx, ry, n = 7, seed = 1) => {
    x.beginPath();
    for (let i = 0; i <= n * 4; i++) {
      const a = (i / (n * 4)) * Math.PI * 2;
      const k = 1 + 0.25 * Math.sin(a * 3 + seed) + 0.15 * Math.sin(a * 5 + seed * 2);
      const px = cx + Math.cos(a) * rx * k;
      const py = cy + Math.sin(a) * ry * k;
      if (i === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.fill();
  };
  blob(120, 95, 55, 40, 7, 1);
  blob(150, 175, 30, 45, 7, 2);
  blob(270, 90, 45, 35, 7, 3);
  blob(290, 160, 35, 45, 7, 4);
  blob(390, 100, 70, 40, 7, 5);
  blob(430, 190, 30, 20, 7, 6);
  x.fillStyle = '#f2f6fa';
  x.fillRect(0, 0, 512, 14);
  x.fillRect(0, 242, 512, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function arrow(color) {
  const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.08, color, 0.022, 0.014);
  a.line.material.depthTest = false;
  a.cone.material.depthTest = false;
  a.renderOrder = 5;
  return a;
}

class Orbiter {
  /** A body going round `centre` at radius R, angular speed w; `free` once its force is taken away. */
  constructor(group, mesh, centre, R, w, y = 0) {
    this.group = group;
    this.mesh = mesh;
    this.centre = centre;
    this.R = R;
    this.w = w;
    this.y = y;
    this.a = 0;
    this.free = null;
    this.vArrow = arrow(0x46d17a);
    this.fArrow = arrow(0xff4d4d);
    this.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd166 }));
    this.trail.visible = false;
    group.add(this.vArrow, this.fArrow, this.trail);
  }

  pos(a = this.a) {
    return new THREE.Vector3(this.centre.x + this.R * Math.cos(a), this.centre.y + this.y, this.centre.z - this.R * Math.sin(a));
  }

  tangent() {
    return new THREE.Vector3(-Math.sin(this.a), 0, -Math.cos(this.a));
  }

  release() {
    if (this.free) return false;
    this.free = { p: this.pos(), v: this.tangent().multiplyScalar(this.w * this.R), t: 0, path: [this.pos()] };
    this.trail.visible = true;
    return true;
  }

  update(dt, arrowsOn, onBack) {
    if (this.free) {
      const f = this.free;
      f.t += dt;
      f.p.addScaledVector(f.v, dt);
      if (f.path.at(-1).distanceTo(f.p) > 0.006) f.path.push(f.p.clone());
      this.trail.geometry.dispose();
      this.trail.geometry = new THREE.BufferGeometry().setFromPoints(f.path);
      this.mesh.position.copy(f.p);
      this.mesh.lookAt(this.group.localToWorld(f.p.clone().add(f.v)));
      if (f.t > 3.5) {
        this.free = null;
        this.trail.visible = false;
        onBack?.();
      }
    } else {
      this.a += this.w * dt;
      const p = this.pos();
      this.mesh.position.copy(p);
      this.mesh.lookAt(this.group.localToWorld(p.clone().add(this.tangent())));
    }
    const on = arrowsOn && !this.free;
    this.vArrow.visible = on;
    this.fArrow.visible = on;
    if (on) {
      const p = this.mesh.position;
      this.vArrow.position.copy(p);
      this.vArrow.setDirection(this.tangent());
      this.fArrow.position.copy(p);
      this.fArrow.setDirection(this.centre.clone().setY(p.y).sub(p).normalize());
    }
  }
}

export class Plenary {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.arrows = true;

    // Earth and satellite
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.075, 40, 24), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.8 }));
    earth.position.copy(EARTH);
    earth.rotation.z = 0.41;
    this.earth = earth;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, EARTH.y - TOP - 0.075, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a3a }));
    stand.position.set(EARTH.x, (EARTH.y - 0.075 + TOP) / 2, EARTH.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ORBIT, 0.0012, 6, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9aa8ff, transparent: true, opacity: 0.45 }));
    ring.position.copy(EARTH);
    const sat = new THREE.Group();
    const satBody = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.02), new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: 0.6, roughness: 0.3 }));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.002, 0.014), new THREE.MeshStandardMaterial({ color: 0x2a4ea8, metalness: 0.4, roughness: 0.3 }));
    sat.add(satBody, panel);
    for (const m of [satBody, panel, earth]) m.userData = { handler: this, which: 'satellite', tapOnly: true };
    const eTag = makeLabel('Satellite: gravity pulls it round', { height: 0.014, size: 36 });
    eTag.position.set(EARTH.x, EARTH.y + 0.12, EARTH.z);
    this.group.add(earth, stand, ring, sat, eTag);
    this.satellite = new Orbiter(this.group, sat, EARTH, ORBIT, 1.6);

    // car on a bend
    const road = new THREE.Mesh(new THREE.RingGeometry(BEND - 0.025, BEND + 0.025, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3d45, roughness: 0.9 }));
    road.position.set(TRACK.x, TOP + 0.002, TRACK.z);
    const line = new THREE.Mesh(new THREE.RingGeometry(BEND - 0.0012, BEND + 0.0012, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    line.position.set(TRACK.x, TOP + 0.003, TRACK.z);
    this.ice = new THREE.Mesh(new THREE.RingGeometry(BEND - 0.025, BEND + 0.025, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.6, roughness: 0.05 }));
    this.ice.position.set(TRACK.x, TOP + 0.004, TRACK.z);
    this.ice.visible = false;
    const car = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.01, 0.04), new THREE.MeshStandardMaterial({ color: 0xd8342c, roughness: 0.4 }));
    chassis.position.y = 0.009;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.009, 0.018), new THREE.MeshStandardMaterial({ color: 0x9fd4ff, roughness: 0.2 }));
    cab.position.set(0, 0.017, -0.002);
    car.add(chassis, cab);
    for (const m of [chassis, cab, road]) m.userData = { handler: this, which: 'car', tapOnly: true };
    const cTag = makeLabel('Car: friction pushes it round', { height: 0.014, size: 36 });
    cTag.position.set(TRACK.x, TOP + 0.07, TRACK.z - BEND - 0.04);
    this.group.add(road, line, this.ice, car, cTag);
    this.car = new Orbiter(this.group, car, new THREE.Vector3(TRACK.x, TOP, TRACK.z), BEND, 2.2, 0.0);
    this.picks = [satBody, panel, earth, chassis, cab, road];
    this.setVisible(false);
  }

  setVisible(on) {
    this.group.visible = on;
  }

  get targets() {
    return this.group.visible ? this.picks : [];
  }

  describe(o) {
    return o.userData.which === 'car' ? 'Car on a bend · tap to put ice on the road' : 'Satellite · tap to switch off gravity';
  }

  tap(o) {
    if (o.userData.which === 'car') this.app.iceRoad();
    else this.app.gravityOff();
  }

  grab() {
    return null;
  }

  update(dt) {
    if (!this.group.visible) return;
    this.earth.rotation.y += dt * 0.3;
    this.satellite.update(dt, this.arrows);
    this.car.update(dt, this.arrows, () => { this.ice.visible = false; });
  }
}
