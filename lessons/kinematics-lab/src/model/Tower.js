import * as THREE from 'three';
import { DROP_OBJECTS, HEIGHTS } from '../data/kinematics.js';

// "Watch it life-size": the original lesson's measuring pole at full size, standing on the floor beside the
// bench and rising up through the classroom ceiling, with a glass balcony at 5, 10 and 15 m. It follows the
// bench's drop exactly (same heights, same timing), so students can look up and watch the ball fall the whole
// way and land at their feet. The ball is drawn a little bigger than life, with a short trail, so it can be
// seen 15 m up.

const POLE_H = 16;
const AT = new THREE.Vector3(-1.25, 0, -0.75); // x, z in lab coordinates; y is the floor

function poleTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 4096;
  const x = c.getContext('2d');
  x.fillStyle = '#d9b07c';
  x.fillRect(0, 0, 128, 4096);
  for (let i = 0; i <= POLE_H * 10; i++) {
    const y = 4096 - (i / (POLE_H * 10)) * 4096;
    const metre = i % 10 === 0;
    const half = i % 5 === 0;
    x.fillStyle = metre || half ? '#c02020' : '#2a1e12';
    x.fillRect(0, y - 1.5, metre ? 80 : half ? 56 : 30, 3);
    if (metre && i > 0) {
      x.fillStyle = '#2a1e12';
      x.font = '800 34px system-ui, sans-serif';
      x.fillText(`${i / 10} m`, 40, y + 34);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Tower {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.9), new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.85 }));
    base.position.set(0, 0.1, 0);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, POLE_H, 0.06), new THREE.MeshStandardMaterial({ map: poleTexture(), roughness: 0.7 }));
    pole.position.set(0, 0.2 + POLE_H / 2, -0.1);
    this.group.add(base, pole);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd0e0, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false });
    this.balconies = HEIGHTS.map((h) => {
      const b = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.0), glass.clone());
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.03), glass.clone());
      rail.position.set(0, 0.3, 0.5);
      b.add(floor, rail);
      b.position.set(0.85, 0.2 + h, 0.1);
      this.group.add(b);
      return { h, b, mats: [floor.material, rail.material] };
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd8f24a, emissive: 0x333300 }));
    this.trail = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.2, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.group.add(this.ball, this.trail);
    this.setVisible(false);
  }

  setVisible(on) {
    this.group.visible = on;
  }

  update(floorY, drop) {
    if (!this.group.visible) return;
    this.group.position.set(AT.x, floorY, AT.z);
    const o = DROP_OBJECTS[drop.obj];
    const r = Math.max(0.06, o.r * 1.6);
    this.ball.scale.setScalar(r);
    this.ball.material.color.setHex(o.color);
    this.ball.position.set(0.7, 0.2 + drop.y + r, 0.1);
    for (const b of this.balconies) {
      const on = b.h === drop.h;
      for (const m of b.mats) m.opacity = on ? 0.45 : 0.15;
    }
    const speed = Math.abs(drop.v);
    this.trail.visible = drop.running && speed > 1;
    if (this.trail.visible) {
      const len = Math.min(3, speed * 0.12);
      this.trail.scale.set(r, len, r);
      this.trail.position.set(0.7, this.ball.position.y + len / 2 + r * 0.3, 0.1);
    }
  }
}
