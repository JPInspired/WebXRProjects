import * as THREE from 'three';
import { INSIGHTS, SPRINGS, pendulumT, springT, rampA, G } from '../data/kinematics.js';

// The class board (2.6 m wide):
//   predict  – the prediction question and, once revealed, how the class answered;
//   results  – the class datasheet for the station the teacher is on: every student's results plotted (drop
//              time against height, period against length or mass, acceleration against ramp angle), with the
//              theory curves at Advanced;
//   insights – the key insights groups chose, tallied.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const GOOD = '#7ee2a8';
const DIM = '#aab3d8';
const FONT = 'system-ui, sans-serif';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;


const SPRING_COLS = { soft: '#7cc4ff', medium: '#7ee2a8', stiff: '#ffd166', mystery: '#c9a6ff' };
export const RESULT_AXES = {
  drop: { title: 'Drop Tower', x: [3, 17], ticks: [5, 10, 15], xLabel: 'height (m)', yLabel: 'time to fall (s)', yMax: 2.5, theory: [{ col: '#ffffff', fn: (h) => Math.sqrt((2 * h) / G) }] },
  pendulum: { title: 'Pendulum', x: [0.1, 0.7], ticks: [0.2, 0.3, 0.4, 0.5, 0.6], xLabel: 'length (m)', yLabel: 'period (s)', yMax: 2, theory: [{ col: '#ffffff', fn: pendulumT }] },
  spring: { title: 'Springs', x: [0, 350], ticks: [50, 100, 200, 300], xLabel: 'mass (g)', yLabel: 'period (s)', yMax: 1.2, theory: Object.entries(SPRINGS).map(([id, s]) => ({ col: SPRING_COLS[id], fn: (m) => springT(Math.max(1, m), s.k) })), key: Object.entries(SPRINGS).map(([id, s]) => [s.name, SPRING_COLS[id]]) },
  ramp: { title: 'Ramp', x: [0, 35], ticks: [5, 10, 15, 20, 25, 30], xLabel: 'angle (°)', yLabel: 'acceleration (m/s²)', yMax: 4, theory: [{ col: '#ffffff', fn: rampA }] },
};
export const springColour = (id) => SPRING_COLS[id];

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
    else if (v.kind === 'insights') this.drawInsights(c, v);
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
    const S = RESULT_AXES[v.station];
    c.fillStyle = '#ffffff';
    c.font = `700 44px ${FONT}`;
    c.fillText(`Class datasheet: ${S.title}`, 40, 64);
    c.font = `400 24px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText(`${v.points.length} result${v.points.length === 1 ? '' : 's'} from the class. Ringed dots are yours.${v.adv ? ' Dashed: the theory.' : ''}`, 40, 100);
    const x = 170;
    const y = 140;
    const w = W - 400;
    const h = 560;
    const [x0, x1] = S.x;
    const yMax = S.yMax;
    const X = (u) => x + ((u - x0) / (x1 - x0)) * w;
    const Y = (u) => y + h - (Math.min(u, yMax) / yMax) * h;
    c.font = `400 20px ${FONT}`;
    c.textAlign = 'right';
    for (let k = 0; k <= 5; k++) {
      const u = (yMax * k) / 5;
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(x, Y(u), w, 1.5);
      c.fillStyle = DIM;
      c.fillText(u.toFixed(yMax < 5 ? 1 : 0), x - 10, Y(u) + 7);
    }
    c.textAlign = 'center';
    for (const t of S.ticks) c.fillText(String(t), X(t), y + h + 30);
    c.fillText(S.xLabel, x + w / 2, y + h + 64);
    c.save();
    c.translate(x - 70, y + h / 2);
    c.rotate(-Math.PI / 2);
    c.fillText(S.yLabel, 0, 0);
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    if (v.adv) {
      for (const curve of S.theory) {
        c.strokeStyle = curve.col;
        c.globalAlpha = 0.6;
        c.setLineDash([10, 8]);
        c.beginPath();
        for (let i = 0; i <= 60; i++) {
          const u = x0 + ((x1 - x0) * i) / 60;
          const py = Y(curve.fn(u));
          if (i === 0) c.moveTo(X(u), py);
          else c.lineTo(X(u), py);
        }
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha = 1;
      }
    }
    v.points.forEach((p, i) => {
      c.fillStyle = p.col ?? css(p.color);
      c.beginPath();
      c.arc(X(p.x) + (((i * 37) % 9) - 4), Y(p.y), p.me ? 10 : 8, 0, Math.PI * 2);
      c.fill();
      if (p.me) {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2.5;
        c.stroke();
      }
    });
    c.textAlign = 'left';
    // key
    c.font = `600 22px ${FONT}`;
    let ky = 170;
    for (const [label, col] of S.key ?? []) {
      c.fillStyle = col;
      c.fillText(`● ${label}`, x + w + 40, ky);
      ky += 34;
    }
  }

  drawInsights(c, v) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText('What did your group find?', 40, 70);
    c.font = `400 26px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('Each group picks its key insight on its own panel.', 40, 110);
    const most = Math.max(1, ...INSIGHTS.map((s) => v.counts[s.id] ?? 0));
    INSIGHTS.forEach((s, i) => {
      const y = 140 + i * 72;
      const n = v.counts[s.id] ?? 0;
      rr(c, 40, y, W - 80, 62, 12);
      c.fillStyle = '#1b2444';
      c.fill();
      if (n) {
        rr(c, 40, y, Math.max(40, ((W - 80) * n) / most), 62, 12);
        c.fillStyle = '#2f4f8a';
        c.fill();
      }
      c.fillStyle = '#ffffff';
      c.font = `600 25px ${FONT}`;
      let text = s.text;
      while (c.measureText(text).width > W - 220 && text.length > 20) text = `${text.slice(0, -2)}…`;
      c.fillText(text, 64, y + 40);
      c.font = `800 32px ${FONT}`;
      c.textAlign = 'right';
      c.fillStyle = n ? GOOD : DIM;
      c.fillText(String(n), W - 64, y + 42);
      c.textAlign = 'left';
    });
  }
}
