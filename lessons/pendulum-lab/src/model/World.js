import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { TOP, Pend } from './Rig.js';
import { SECONDS_L } from '../data/pendulum.js';

// Real-world pendulums, as models on the bench (the physics uses their real sizes):
//  - a grandfather clock with a seconds pendulum and a real clock beside it. Adjust the pendulum's length
//    (a centimetre or a millimetre at a time) until it keeps time: too long and it loses time.
//  - a playground swing (2.4 m chains) or a pirate-ship ride (6 m arm). Push it: in time with the swing it goes
//    higher; at the wrong moment, a push slows it down.
//  - a metronome: slide the weight up the arm and the beat slows (it ticks at each end of its swing).

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });

function canvasTex(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t, x: c.getContext('2d') };
}

function drawDial(tex, seconds, label) {
  const { x, c, t } = tex;
  const R = c.width / 2;
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = '#f6f0e0';
  x.beginPath();
  x.arc(R, R, R - 4, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#3a2a10';
  x.lineWidth = 6;
  x.stroke();
  x.fillStyle = '#2a1e0a';
  x.font = '700 30px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
    x.fillText(String(h), R + Math.cos(a) * (R - 36), R + Math.sin(a) * (R - 36));
  }
  const hand = (frac, len, w, col) => {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    x.strokeStyle = col;
    x.lineWidth = w;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(R, R);
    x.lineTo(R + Math.cos(a) * len, R + Math.sin(a) * len);
    x.stroke();
  };
  const s = seconds + 10 * 3600 + 8 * 60; // starts at 10:08
  hand(((s / 3600) % 12) / 12, R * 0.5, 9, '#1a1a1a');
  hand(((s / 60) % 60) / 60, R * 0.75, 6, '#1a1a1a');
  hand((Math.floor(s) % 60) / 60, R * 0.82, 2.5, '#c02020');
  x.font = '600 18px system-ui, sans-serif';
  x.fillStyle = '#5a4a2a';
  x.fillText(label, R, R + R * 0.45);
  t.needsUpdate = true;
}

export class World {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.which = null;

    // ── grandfather clock (1:4) and a real clock ──
    this.clock = new THREE.Group();
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.09), mat(0x5a3418, { roughness: 0.7 }));
    caseMesh.position.y = 0.28;
    const window_ = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.9 }));
    window_.position.set(0, 0.2, 0.0451);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.1), mat(0x6a3e1c, { roughness: 0.7 }));
    hood.position.y = 0.62;
    this.dialTex = canvasTex(256, 256);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.07, 48), new THREE.MeshBasicMaterial({ map: this.dialTex.t, toneMapped: false }));
    dial.position.set(0, 0.62, 0.0505);
    this.clockPend = new Pend({ L: 1.02, bob: 'steel', air: 0 });
    this.clockRod = new THREE.Group();
    this.clockRod.position.set(0, 0.5, 0.05);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.004, 1, 0.003), mat(0xc8a040, { metalness: 0.7, roughness: 0.3 }));
    this.clockBob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 32).rotateX(Math.PI / 2), mat(0xd4a83a, { metalness: 0.8, roughness: 0.25 }));
    this.clockRod.add(rod, this.clockBob);
    this.clockRodMesh = rod;
    this.clock.add(caseMesh, window_, hood, dial, this.clockRod);
    this.realTex = canvasTex(256, 256);
    const real = new THREE.Mesh(new THREE.CircleGeometry(0.06, 48), new THREE.MeshBasicMaterial({ map: this.realTex.t, toneMapped: false }));
    real.position.set(0.24, 0.45, 0);
    const realTag = makeLabel('Real time', { height: 0.014, size: 36 });
    realTag.position.set(0.24, 0.53, 0);
    const clockTag = makeLabel('Grandfather clock (1:4 model)', { height: 0.014, size: 36 });
    clockTag.position.set(0, 0.73, 0);
    this.clock.add(real, realTag, clockTag);
    this.clock.position.set(-0.05, TOP, -0.1);
    this.group.add(this.clock);
    this.clockTime = 0;
    this.realTime = 0;

    // ── swing / pirate ship (1:8) ──
    this.swing = new THREE.Group();
    const frameMat = mat(0x3a7bd5, { metalness: 0.4, roughness: 0.4 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 8), frameMat);
        leg.position.set(sx * 0.12, 0.16, sz * 0.032);
        leg.rotation.x = -sz * 0.19; // an A-frame: the legs lean in to meet at the top bar
        this.swing.add(leg);
      }
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 8).rotateZ(Math.PI / 2), frameMat);
    bar.position.y = 0.33;
    this.swing.add(bar);
    this.swingArm = new THREE.Group();
    this.swingArm.position.y = 0.33;
    this.swing.add(this.swingArm);
    this.swing.position.set(-0.05, TOP, -0.08);
    this.group.add(this.swing);
    this.ride = 'swing';
    this.buildRide();
    this.swingPend = new Pend({ L: 2.4, bob: 'steel', air: 0.6 });
    this.maxDeg = 0;

    // ── metronome ──
    this.metro = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 0.24, 4, 1), mat(0x2a1a10, { roughness: 0.5 }));
    body.rotation.y = Math.PI / 4;
    body.position.y = 0.12;
    const scale = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.16), mat(0xe9d9a0));
    scale.position.set(0, 0.13, 0.04);
    scale.rotation.x = -0.18;
    this.metroArm = new THREE.Group();
    this.metroArm.position.set(0, 0.03, 0.05);
    const armRod = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.22, 0.003), metalMat());
    armRod.position.y = 0.11;
    this.metroWeight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.014, 0.01), mat(0xd4a83a, { metalness: 0.8, roughness: 0.25 }));
    this.metroArm.add(armRod, this.metroWeight);
    this.metro.add(body, scale, this.metroArm);
    this.metro.position.set(-0.05, TOP, -0.06);
    this.group.add(this.metro);
    this.bpm = 100;
    this.metroPhase = 0;

    this.show(null);
  }

  buildRide() {
    while (this.swingArm.children.length) this.swingArm.remove(this.swingArm.children[0]);
    if (this.ride === 'swing') {
      const chainMat = mat(0x9aa0aa, { metalness: 0.7, roughness: 0.3 });
      for (const x of [-0.025, 0.025]) {
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.3, 6), chainMat);
        chain.position.set(x, -0.15, 0);
        this.swingArm.add(chain);
      }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.006, 0.03), mat(0xe03030));
      seat.position.y = -0.3;
      const kid = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.03, 4, 8), mat(0xffb380));
      kid.position.y = -0.27;
      this.swingArm.add(seat, kid);
    } else {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.28, 0.01), mat(0x8a5a2a));
      arm.position.y = -0.14;
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 24, 1, false, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), mat(0x8a3a1a, { side: THREE.DoubleSide }));
      hull.position.y = -0.27;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 6), mat(0xd8c090));
      mast.position.y = -0.24;
      this.swingArm.add(arm, hull, mast);
    }
  }

  setRide(r) {
    this.ride = r;
    this.swingPend.L = r === 'ship' ? 6 : 2.4;
    this.swingPend.stop();
    this.maxDeg = 0;
    this.buildRide();
  }

  show(which) {
    this.which = which;
    this.clock.visible = which === 'clock';
    this.swing.visible = which === 'swing';
    this.metro.visible = which === 'metronome';
    if (which === 'clock') {
      this.clockPend.release(4);
      this.clockPend.air = 0;
      this.clockTime = 0;
      this.realTime = 0;
    }
  }

  // ── clock ──
  /** Seconds gained (+) or lost (−) per day at the current length. */
  get clockError() {
    const T = 2 * Math.PI * Math.sqrt(this.clockPend.L / 9.81);
    return (2 / T - 1) * 86400;
  }

  adjustClock(dL) {
    this.clockPend.L = Math.max(0.9, Math.min(1.1, Math.round((this.clockPend.L + dL) * 10000) / 10000));
    this.clockTime = 0;
    this.realTime = 0;
  }

  // ── swing ──
  push() {
    const p = this.swingPend;
    if (!p.running) {
      p.release(1);
    }
    // a push is always forwards (away from you): it helps if the swing is moving away, hinders if coming back
    const helps = p.w >= -0.05;
    p.w += 0.2;
    return helps;
  }

  // ── metronome ──
  setBpm(b) {
    this.bpm = b;
  }

  get targets() {
    return [];
  }

  update(dt) {
    if (this.which === 'clock') {
      const p = this.clockPend;
      // the escapement gives a tiny kick each swing, so the amplitude stays at about 4°
      p.step(dt);
      if (Math.abs(p.w) < 1e-3 && Math.abs(p.th) < 0.01) p.release(4);
      const T = 2 * Math.PI * Math.sqrt(p.L / 9.81);
      this.clockTime += dt * (2 / T);
      this.realTime += dt;
      const vis = p.L * 0.33;
      this.clockRodMesh.scale.y = vis;
      this.clockRodMesh.position.y = -vis / 2;
      this.clockBob.position.y = -vis;
      this.clockRod.rotation.z = p.th;
      this.tick = (this.tick ?? 0) + dt;
      if (this.tick > 0.25) {
        this.tick = 0;
        drawDial(this.dialTex, this.clockTime * 600, 'clock'); // shown 600× faster so the drift is visible
        drawDial(this.realTex, this.realTime * 600, 'real');
      }
    } else if (this.which === 'swing') {
      const p = this.swingPend;
      p.step(dt);
      this.swingArm.rotation.x = p.th;
      this.maxDeg = Math.max(this.maxDeg * (1 - dt * 0.02), (Math.abs(p.th) * 180) / Math.PI);
    } else if (this.which === 'metronome') {
      const period = 120 / this.bpm; // a tick at each end
      const before = Math.sin(this.metroPhase);
      this.metroPhase += (dt * 2 * Math.PI) / period;
      const now = Math.sin(this.metroPhase);
      const cosNow = Math.cos(this.metroPhase);
      const cosBefore = Math.cos(this.metroPhase - (dt * 2 * Math.PI) / period);
      this.metroArm.rotation.z = 0.42 * now;
      if (Math.sign(cosNow) !== Math.sign(cosBefore)) this.app.metronomeTick();
      void before;
      // the weight slides up for slow beats
      const f = (208 - this.bpm) / (208 - 40);
      this.metroWeight.position.y = 0.06 + f * 0.14;
    }
  }
}

function metalMat() {
  return new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.8, roughness: 0.25 });
}

export { SECONDS_L };
