import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { BALLS, BALL_IDS } from '../data/bounce.js';

// The six balls at real size, on a shelf in the middle of your lab. Pick one up, hold it over a mat at
// any height and let go. (The balls live in the floor zone's coordinates, so their flights are worked out
// above the floor; on the shelf they simply follow the lab.)

const SHELF_Y = -0.42;

function ballTexture(id) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  const col = `#${BALLS[id].color.toString(16).padStart(6, '0')}`;
  x.fillStyle = col;
  x.fillRect(0, 0, 512, 256);
  if (id === 'basketball') {
    x.strokeStyle = '#1b1208';
    x.lineWidth = 7;
    for (const u of [0, 128, 256, 384]) {
      x.beginPath();
      x.moveTo(u, 0);
      x.lineTo(u, 256);
      x.stroke();
    }
    x.beginPath();
    x.moveTo(0, 128);
    x.lineTo(512, 128);
    x.stroke();
  } else if (id === 'tennis') {
    x.strokeStyle = '#f7f7ef';
    x.lineWidth = 9;
    x.beginPath();
    for (let u = 0; u <= 512; u += 4) x.lineTo(u, 128 + 70 * Math.sin((u / 512) * Math.PI * 4));
    x.stroke();
  } else if (id === 'pingpong') {
    x.fillStyle = '#7a4a10';
    x.font = '700 40px system-ui';
    x.fillText('★★★', 200, 140);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The ball's surface relief (a bump map, light = raised): golf-ball dimples, the pebbled skin of a basketball,
 * tennis-ball felt, plasticine fingerprints. Smooth balls have none.
 */
function ballBump(id) {
  if (!['golf', 'basketball', 'tennis', 'plasticine'].includes(id)) return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 512, 256);
  if (id === 'golf') {
    // dimples: a regular pattern of shallow round dents
    for (let row = 0; row < 18; row++) {
      for (let col = 0; col < 36; col++) {
        const px = col * (512 / 36) + (row % 2) * (256 / 36), py = 7 + row * (242 / 17);
        const g = x.createRadialGradient(px, py, 0, px, py, 6.5);
        g.addColorStop(0, '#5a5a5a');
        g.addColorStop(1, '#ffffff');
        x.fillStyle = g;
        x.beginPath();
        x.arc(px, py, 6.5, 0, Math.PI * 2);
        x.fill();
      }
    }
  } else if (id === 'basketball') {
    // pebbles all over, and the seams pressed in
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = Math.random() < 0.5 ? '#bdbdbd' : '#ffffff';
      x.beginPath();
      x.arc(Math.random() * 512, Math.random() * 256, 1.2 + Math.random(), 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = '#303030';
    x.lineWidth = 8;
    for (const u of [0, 128, 256, 384]) { x.beginPath(); x.moveTo(u, 0); x.lineTo(u, 256); x.stroke(); }
    x.beginPath(); x.moveTo(0, 128); x.lineTo(512, 128); x.stroke();
  } else {
    // felt / plasticine: fine random fuzz
    for (let i = 0; i < 14000; i++) {
      const v = 160 + Math.floor(Math.random() * 95);
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(Math.random() * 512, Math.random() * 256, id === 'tennis' ? 1.5 : 3, id === 'tennis' ? 1.5 : 1);
    }
  }
  return new THREE.CanvasTexture(c);
}

/** What each ball is made of: shiny rubber, fuzzy felt, a glossy golf-ball shell… */
function ballMaterial(id) {
  const map = ballTexture(id);
  const bumpMap = ballBump(id);
  const base = { map, bumpMap, bumpScale: id === 'golf' ? 1.2 : id === 'basketball' ? 0.8 : 0.4 };
  switch (id) {
    case 'rubber': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.1 });
    case 'tennis': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 1, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xf4ffb0) });
    case 'basketball': return new THREE.MeshStandardMaterial({ ...base, roughness: 0.75 });
    case 'golf': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    case 'pingpong': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 });
    default: return new THREE.MeshStandardMaterial({ ...base, roughness: 0.85 }); // plasticine: soft and matte
  }
}

export class Balls {
  constructor(app, floor) {
    this.app = app;
    this.floor = floor;
    // the shelf
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: 0x2a3560, roughness: 0.6 }));
    shelf.position.set(0, SHELF_Y - 0.01, 0.02);
    app.lab.add(shelf);

    let x = -0.405;
    this.list = BALL_IDS.map((id) => {
      const b = BALLS[id];
      x += b.r + 0.025;
      const home = new THREE.Vector3(x, SHELF_Y + b.r, 0.02);
      x += b.r + 0.025;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.r, 48, 32), ballMaterial(id));
      const ball = { id, mesh, home, flight: null, held: false };
      mesh.userData = { handler: this, ball };
      floor.group.add(mesh);
      const label = makeLabel(b.short, { height: 0.018, size: 40 });
      label.position.set(home.x, SHELF_Y - 0.035, 0.12);
      app.lab.add(label);
      return ball;
    });
    this.byId = Object.fromEntries(this.list.map((b) => [b.id, b]));
  }

  get targets() {
    return this.list.map((b) => b.mesh);
  }

  onShelf(ball) {
    return !ball.flight && !ball.held && !ball.out;
  }

  /** Every frame: balls on the shelf follow the lab. */
  update() {
    for (const b of this.list) {
      if (!this.onShelf(b)) continue;
      this.floor.group.worldToLocal(this.app.lab.localToWorld(b.mesh.position.copy(b.home)));
    }
  }

  home(ball) {
    ball.flight = null;
    ball.out = false;
    ball.mesh.scale.set(1, 1, 1);
  }

  describe(o) {
    const b = BALLS[o.userData.ball.id];
    return `${b.name} · lift it over a mat and let go`;
  }

  tap(o) {
    this.app.selectBall(o.userData.ball.id, true);
  }

  grab(o, mode, world) {
    const ball = o.userData.ball;
    const zone = this.floor.group;
    ball.flight = null;
    ball.held = true;
    ball.mesh.scale.set(1, 1, 1);
    const off = ball.mesh.position.clone().sub(zone.worldToLocal(world.clone()));
    this.app.selectBall(ball.id, true);
    return {
      move: (w) => {
        ball.mesh.position.copy(zone.worldToLocal(w.clone())).add(off);
        if (!this.app.presenting) ball.mesh.position.z = 0; // on a screen: up, down and sideways only
      },
      release: () => {
        ball.held = false;
        this.app.letGo(ball, ball.mesh.position.clone());
      },
    };
  }
}
