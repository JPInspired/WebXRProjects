import * as THREE from 'three';
import { METALS, ELECTROLYTES, cellEMF } from '../data/voltaic.js';

// "Zoom into the particles": a magnified, animated view of the cell being measured, floating above the bench.
//  - At the negative strip (the more reactive metal) atoms lose electrons and leave as ions (oxidation).
//  - Electrons (e⁻) flow through the wire to the positive strip.
//  - Core (simple cell): hydrogen ions from the electrolyte pick them up and bubble off as hydrogen gas.
//    Advanced: the positive strip's own metal ions pick them up and coat it as atoms (reduction), and ions
//    drift through the salt bridge to keep each beaker neutral.
// Everything moves faster when more current would flow; nothing moves without ions or without a salt bridge.

const W = 768;
const H = 432;

export class Particles {
  constructor(app) {
    this.app = app;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6 * (H / W)), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, transparent: true }));
    this.mesh.position.set(0, 0.2, -0.32);
    this.mesh.rotation.x = 0.08;
    app.lab.add(this.mesh);
    this.mesh.visible = false;
    this.items = []; // moving particles
    this.spawn = 0;
    this.t = 0;
  }

  setVisible(on) {
    this.mesh.visible = on;
    if (!on) this.items = [];
  }

  /** Geometry of the drawing for the current cell. */
  layout(adv) {
    if (adv) return { negX: 170, posX: 598, top: 140, bottom: 320, beakers: [[60, 330], [438, 708]] };
    return { negX: 230, posX: 538, top: 140, bottom: 320, beakers: [[90, 678]] };
  }

  update(dt) {
    if (!this.mesh.visible) return;
    this.t += dt;
    const b = this.app.bench;
    const cell = b.chain()[0] ?? b.cell;
    const adv = b.level === 'advanced';
    const e = cell ? cellEMF(cell, b.level, cell.wear) : null;
    const working = e && !e.open && Math.abs(e.V) > 0.02 && (adv || ELECTROLYTES[cell.electrolyte]?.ions);
    // (sped up for weak cells so there is always something to see when it works at all)
    const rate = working ? Math.min(1.6, Math.max(0.35, Math.abs(e.V) / (e.R + 100) / 0.006)) : 0;
    const L = this.layout(adv);
    const negLeft = !e || e.V >= 0;
    const negX = negLeft ? L.negX : L.posX;
    const posX = negLeft ? L.posX : L.negX;
    const dir = Math.sign(posX - negX);
    if (!working) this.items = [];

    // spawn: each "event" is one atom oxidised and its electrons travelling
    this.spawn += dt * rate * 2.2;
    while (this.spawn > 1 && this.items.length < 140) {
      this.spawn -= 1;
      const y = L.top + 40 + Math.random() * (L.bottom - L.top - 60);
      this.items.push({ kind: 'ion', x: negX + dir * 14, y, vx: dir * (18 + Math.random() * 12), vy: (Math.random() - 0.5) * 20, life: 0 });
      this.items.push({ kind: 'e', s: 0, life: 0 });
      if (cell?.left && cell?.right) {
        const ny = L.top + 40 + Math.random() * (L.bottom - L.top - 60);
        const startX = adv ? posX + dir * 120 : (negX + posX) / 2 + dir * 80 * Math.random();
        this.items.push({ kind: adv ? 'pion' : 'h', x: startX, y: ny, tx: posX - dir * 14, ty: ny, life: 0 });
      }
      if (adv) this.items.push({ kind: Math.random() < 0.5 ? 'k' : 'no3', s: 0, life: 0 });
    }
    for (const it of this.items) {
      it.life += dt;
      if (it.kind === 'ion') {
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.vx *= 0.99;
      } else if (it.kind === 'e') it.s += dt * (0.35 + 0.25 * rate);
      else if (it.kind === 'h' || it.kind === 'pion') {
        const dx = it.tx - it.x;
        it.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 45);
        if (Math.abs(dx) < 1) {
          it.arrived = (it.arrived ?? 0) + dt;
          if (it.kind === 'h') it.y -= dt * 60;
        }
      } else it.s += dt * 0.25;
    }
    this.items = this.items.filter((it) => it.life < 6 && !(it.kind === 'e' && it.s > 1) && !((it.kind === 'k' || it.kind === 'no3') && it.s > 1) && !(it.kind === 'h' && it.y < L.top - 20) && !(it.kind === 'pion' && (it.arrived ?? 0) > 1.2));
    this.frameT = (this.frameT ?? 0) + dt;
    if (this.frameT > 1 / 24) {
      this.frameT = 0;
      this.draw(cell, e, adv, L, negX, posX, rate);
    }
  }

  draw(cell, e, adv, L, negX, posX, rate) {
    const c = this.canvas.getContext('2d');
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(12,16,30,0.9)';
    c.beginPath();
    c.roundRect(0, 0, W, H, 28);
    c.fill();
    c.strokeStyle = 'rgba(124,140,255,0.6)';
    c.lineWidth = 4;
    c.stroke();
    c.font = '700 26px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.textBaseline = 'alphabetic';
    c.fillText(`Zoomed in: cell ${cell ? cell.i + 1 : ''}`, 24, 40);
    if (!cell?.left || !cell?.right) {
      c.font = '400 24px system-ui, sans-serif';
      c.fillStyle = '#aab3d8';
      c.fillText('Put two metal strips in the cell you are measuring.', 24, 90);
      this.tex.needsUpdate = true;
      return;
    }
    const neg = METALS[negX === L.negX ? cell.left : cell.right];
    const pos = METALS[negX === L.negX ? cell.right : cell.left];
    // solutions
    const solCol = (metal) => `#${new THREE.Color(adv ? METALS[metal].solColor : ELECTROLYTES[cell.electrolyte]?.color ?? 0x334455).getHexString()}`;
    L.beakers.forEach(([x0, x1], k) => {
      c.fillStyle = adv ? solCol(k === 0 ? cell.left : cell.right) : cell.electrolyte ? solCol() : 'rgba(255,255,255,0.05)';
      c.globalAlpha = 0.28;
      c.fillRect(x0, L.top, x1 - x0, L.bottom - L.top);
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(200,220,255,0.5)';
      c.lineWidth = 3;
      c.strokeRect(x0, L.top - 20, x1 - x0, L.bottom - L.top + 20);
    });
    // salt bridge
    const bridgeOn = adv && cell.bridge;
    if (adv) {
      c.strokeStyle = bridgeOn ? '#f3efe2' : 'rgba(243,239,226,0.18)';
      c.lineWidth = 22;
      c.beginPath();
      c.moveTo(300, L.top + 60);
      c.lineTo(300, 110);
      c.lineTo(468, 110);
      c.lineTo(468, L.top + 60);
      c.stroke();
      c.fillStyle = bridgeOn ? '#5a4a2a' : '#888';
      c.font = '600 16px system-ui, sans-serif';
      c.fillText(bridgeOn ? 'salt bridge' : 'no salt bridge!', 335, 104);
    }
    // wire and meter
    const wireY = 72;
    c.strokeStyle = '#c9cfdc';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(negX, L.top - 10);
    c.lineTo(negX, wireY);
    c.lineTo(posX, wireY);
    c.lineTo(posX, L.top - 10);
    c.stroke();
    // electrodes
    const strip = (x, m, label) => {
      c.fillStyle = `#${new THREE.Color(m.color).getHexString()}`;
      c.fillRect(x - 13, L.top - 10, 26, L.bottom - L.top - 10);
      c.fillStyle = '#ffffff';
      c.font = '800 22px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(label, x, L.bottom + 28);
      c.textAlign = 'left';
    };
    strip(negX, neg, `${neg.sym} (−)`);
    strip(posX, pos, `${pos.sym} (+)`);
    // particles
    const wirePt = (s) => {
      const seg1 = wireY - (L.top - 10);
      const seg2 = Math.abs(posX - negX);
      const total = -seg1 * 2 + seg2;
      let d = s * total;
      if (d < -seg1) return [negX, L.top - 10 - d];
      d -= -seg1;
      if (d < seg2) return [negX + Math.sign(posX - negX) * d, wireY];
      d -= seg2;
      return [posX, wireY + d];
    };
    c.font = '700 14px system-ui, sans-serif';
    c.textAlign = 'center';
    for (const it of this.items) {
      if (it.kind === 'e') {
        const [x, y] = wirePt(Math.min(1, it.s));
        c.fillStyle = '#ffd166';
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#10162c';
        c.fillText('e⁻', x, y + 5);
      } else if (it.kind === 'ion') {
        c.fillStyle = '#9fb4c8';
        c.beginPath();
        c.arc(it.x, it.y, 11, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#10162c';
        c.fillText(neg.ion, it.x, it.y + 5);
      } else if (it.kind === 'h') {
        const bubble = (it.arrived ?? 0) > 0;
        c.fillStyle = bubble ? 'rgba(255,255,255,0.75)' : '#ff8a8a';
        c.beginPath();
        c.arc(it.x, it.y, bubble ? 9 : 7, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#10162c';
        c.fillText(bubble ? 'H₂' : 'H⁺', it.x, it.y + 5);
      } else if (it.kind === 'pion') {
        const done = (it.arrived ?? 0) > 0;
        c.fillStyle = done ? `#${new THREE.Color(pos.color).getHexString()}` : pos.sym === 'Cu' ? '#5aa8ff' : '#c8d4e8';
        c.beginPath();
        c.arc(it.x, it.y, 10, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#10162c';
        c.fillText(done ? pos.sym : pos.ion, it.x, it.y + 5);
      } else if (bridgeOn) {
        // K⁺ towards the positive side, NO₃⁻ towards the negative side, along the bridge
        const toPos = it.kind === 'k';
        const from = toPos ? (negX < posX ? 300 : 468) : negX < posX ? 468 : 300;
        const to = from === 300 ? 468 : 300;
        const x = from + (to - from) * it.s;
        c.fillStyle = toPos ? '#c9a6ff' : '#7ee2a8';
        c.beginPath();
        c.arc(x, 110, 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#10162c';
        c.fillText(toPos ? 'K⁺' : 'NO₃⁻', x, 114);
      }
    }
    c.textAlign = 'left';
    // equations
    c.font = '600 20px system-ui, sans-serif';
    c.fillStyle = '#ffd166';
    const n = neg.n === 1 ? '' : neg.n;
    c.fillText(`(−) oxidation: ${neg.sym} → ${neg.ion} + ${n}e⁻`, 24, H - 46);
    c.fillStyle = '#7cc4ff';
    const pn = pos.n === 1 ? '' : pos.n;
    c.fillText(adv ? `(+) reduction: ${pos.ion} + ${pn}e⁻ → ${pos.sym}` : '(+) reduction: 2H⁺ + 2e⁻ → H₂', 24, H - 18);
    if (neg.sym === pos.sym) {
      c.font = '700 22px system-ui, sans-serif';
      c.fillStyle = '#ff8a8a';
      c.textAlign = 'right';
      c.fillText('Same metal: no push either way', W - 24, 40);
      c.textAlign = 'left';
    } else if (!e || e.open || rate < 0.02) {
      c.font = '700 22px system-ui, sans-serif';
      c.fillStyle = '#ff8a8a';
      c.textAlign = 'right';
      c.fillText(!e ? 'No electrolyte: nothing can happen' : e.open ? 'Circuit not complete: nothing flows' : 'Almost no ions: nothing flows', W - 24, 40);
      c.textAlign = 'left';
    }
    this.tex.needsUpdate = true;
  }
}
