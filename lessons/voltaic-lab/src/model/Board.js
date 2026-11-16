import * as THREE from 'three';
import { BATTERIES } from '../data/voltaic.js';

// The class board (2.6 m wide):
//   predict   – the prediction question and, once revealed, how the class answered;
//   results   – every reading the class has recorded, biggest voltage first, with the cell (metals and
//               electrolyte, or the two half-cells) and who recorded it;
//   batteries – real batteries compared: voltage, what is negative and positive, the electrolyte.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const GOOD = '#7ee2a8';
const DIM = '#aab3d8';
const FONT = 'system-ui, sans-serif';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

const wrap = (c, text, maxW) => {
  const lines = [];
  let line = '';
  for (const w of String(text).split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (line && c.measureText(t).width > maxW) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  return lines;
};
const rr = (c, x, y, w, h, r) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

export class Board {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.group = new THREE.Group();
    const h = (BOARD_W * H) / W;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, h), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.06, h + 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x2a3560, roughness: 0.6 }));
    frame.position.z = -0.012;
    this.group.add(frame, face);
    this.key = '';
  }

  draw(v) {
    const key = JSON.stringify(v);
    if (key === this.key) return;
    this.key = key;
    const c = this.canvas.getContext('2d');
    c.fillStyle = '#10162c';
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    if (v.kind === 'predict') this.drawPredict(c, v.ch);
    else if (v.kind === 'batteries') this.drawBatteries(c);
    else this.drawResults(c, v);
    this.tex.needsUpdate = true;
  }

  drawPredict(c, ch) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText(ch.title, 40, 70);
    c.font = `600 28px ${FONT}`;
    c.fillStyle = '#9aa8ff';
    c.textAlign = 'right';
    c.fillText(`${ch.votes} answer${ch.votes === 1 ? '' : 's'}${ch.revealed ? '' : ' in'}`, W - 40, 66);
    c.textAlign = 'left';
    c.font = `400 36px ${FONT}`;
    c.fillStyle = '#e6eaff';
    wrap(c, ch.q, W - 80).slice(0, 3).forEach((line, i) => c.fillText(line, 40, 130 + i * 46));
    const w = (W - 80 - 24) / 2;
    const h = 92;
    const top = 290;
    const most = Math.max(1, ...ch.counts);
    ch.options.forEach((o, i) => {
      const x = 40 + (i % 2) * (w + 24);
      const y = top + Math.floor(i / 2) * (h + 16);
      const right = ch.revealed && i === ch.answer;
      rr(c, x, y, w, h, 16);
      c.fillStyle = right ? '#1d4a36' : '#1b2444';
      c.fill();
      if (ch.revealed && ch.counts[i]) {
        rr(c, x, y, Math.max(32, (w * ch.counts[i]) / most), h, 16);
        c.fillStyle = right ? '#2f8a5c' : '#35406e';
        c.fill();
      }
      if (right) {
        c.strokeStyle = GOOD;
        c.lineWidth = 4;
        rr(c, x, y, w, h, 16);
        c.stroke();
      }
      let size = 30;
      const text = `${'ABCD'[i]}   ${o}`;
      c.font = `600 ${size}px ${FONT}`;
      while (size > 18 && c.measureText(text).width > w - 120) c.font = `600 ${--size}px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText(text, x + 24, y + h / 2 + size * 0.36);
      if (ch.revealed) {
        c.font = `700 36px ${FONT}`;
        c.textAlign = 'right';
        c.fillStyle = right ? GOOD : '#ffffff';
        c.fillText(`${right ? '✓ ' : ''}${ch.counts[i]}`, x + w - 22, y + h / 2 + 13);
        c.textAlign = 'left';
      }
    });
    c.font = `400 30px ${FONT}`;
    c.fillStyle = ch.revealed ? '#ffd166' : DIM;
    if (ch.revealed) wrap(c, ch.why, W - 80).slice(0, 4).forEach((line, i) => c.fillText(line, 40, 560 + i * 40));
    else c.fillText('Pick your prediction on your own panel.', 40, 590);
  }

  drawResults(c, v) {
    c.fillStyle = '#ffffff';
    c.font = `700 44px ${FONT}`;
    c.fillText(v.adv ? 'Class results: two-beaker cells' : 'Class results: which cell gives the most voltage?', 40, 64);
    c.font = `400 24px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText(`${v.rows.length} reading${v.rows.length === 1 ? '' : 's'} recorded by the class, biggest voltage first (cells in series marked ×n).`, 40, 100);
    const rows = v.rows.slice(0, 11);
    const most = Math.max(0.5, ...rows.map((r) => Math.abs(r.V)));
    const x0 = 40;
    const barX = 760;
    const barW = W - barX - 200;
    rows.forEach((r, i) => {
      const y = 140 + i * 58;
      rr(c, x0, y, W - 80, 50, 10);
      c.fillStyle = r.me ? '#24305a' : '#1b2444';
      c.fill();
      c.fillStyle = css(r.color);
      c.beginPath();
      c.arc(x0 + 26, y + 25, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `600 24px ${FONT}`;
      let text = r.label;
      while (c.measureText(text).width > barX - x0 - 80 && text.length > 10) text = `${text.slice(0, -2)}…`;
      c.fillText(text, x0 + 48, y + 33);
      rr(c, barX, y + 10, Math.max(6, (barW * Math.abs(r.V)) / most), 30, 8);
      c.fillStyle = r.V < 0 ? '#a83d3d' : i === 0 ? '#2f8a5c' : '#3e5bd0';
      c.fill();
      c.font = `700 26px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.textAlign = 'right';
      c.fillText(`${r.V.toFixed(2)} V${r.I != null ? `  ${(r.I * 1000).toFixed(1)} mA` : ''}`, W - 52, y + 34);
      c.textAlign = 'left';
    });
    if (!rows.length) {
      c.font = `400 28px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('Readings appear here when people press “Record this reading”.', 40, 190);
    }
  }

  drawBatteries(c) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText('Real batteries: the same idea, packed tight', 40, 70);
    c.font = `400 26px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('Every battery has a negative material that gives up electrons, a positive one that takes them, and an electrolyte between.', 40, 110);
    const w = (W - 80 - 2 * 24) / 3;
    BATTERIES.forEach((b, i) => {
      const x = 40 + i * (w + 24);
      rr(c, x, 140, w, 640, 18);
      c.fillStyle = '#1b2444';
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `800 30px ${FONT}`;
      wrap(c, b.name, w - 48).forEach((l, k) => c.fillText(l, x + 24, 190 + k * 36));
      c.fillStyle = '#ffd166';
      c.font = `800 40px ${FONT}`;
      c.fillText(b.volts, x + 24, 280);
      const rows = [['Negative', b.neg], ['Positive', b.pos], ['Electrolyte', b.electrolyte], ['Rechargeable', b.recharge]];
      let y = 330;
      for (const [k, val] of rows) {
        c.fillStyle = DIM;
        c.font = `700 20px ${FONT}`;
        c.fillText(k.toUpperCase(), x + 24, y);
        c.fillStyle = '#e6eaff';
        c.font = `400 24px ${FONT}`;
        const lines = wrap(c, val, w - 48).slice(0, 2);
        lines.forEach((l, j) => c.fillText(l, x + 24, y + 30 + j * 28));
        y += 46 + lines.length * 28;
      }
    });
  }
}
