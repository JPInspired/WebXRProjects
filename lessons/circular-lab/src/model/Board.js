import * as THREE from 'three';
import { BALLS, LENGTHS, EXAMPLES, CORE_HANGING, idealRps } from '../data/circular.js';

// The class board (2.6 m wide):
//   predict – the prediction question and, once revealed, how the class answered;
//   results – everyone's turns per second against ball mass (one colour per string length) and against string
//             length (one colour per ball mass), every result from every student; at Advanced, the theory
//             curves for a 200 g hanging weight are drawn too;
//   world   – what provides the centripetal force in each example, and what happens when it is taken away.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const GOOD = '#7ee2a8';
const DIM = '#aab3d8';
const FONT = 'system-ui, sans-serif';
export const LENGTH_COLS = ['#ff7b7b', '#ffd166', '#7ee2a8', '#7cc4ff'];
export const MASS_COLS = ['#ff9a3c', '#ffd166', '#7ee2a8', '#7cc4ff', '#c9a6ff'];

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

/**
 * A scatter chart of turns per second. runs: [{ x, f, col }]; xs: tick values; theory: [{ col, fn(x) }].
 */
export function drawChart(c, x, y, w, h, { xs, xLabel, xFmt, runs, theory = [], size = 1, yMax = 2.5 }) {
  const x0 = xs[0] - (xs[1] - xs[0]) * 0.5;
  const x1 = xs.at(-1) + (xs[1] - xs[0]) * 0.5;
  const X = (v) => x + ((v - x0) / (x1 - x0)) * w;
  const Y = (f) => y + h - (Math.min(f, yMax) / yMax) * h;
  c.font = `400 ${17 * size}px ${FONT}`;
  c.textAlign = 'right';
  for (let f = 0; f <= yMax + 1e-6; f += 0.5) {
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(x, Y(f), w, 1.5 * size);
    c.fillStyle = DIM;
    c.fillText(f.toFixed(1), x - 8 * size, Y(f) + 6 * size);
  }
  c.textAlign = 'center';
  for (const v of xs) c.fillText(xFmt(v), X(v), y + h + 24 * size);
  c.fillText(xLabel, x + w / 2, y + h + 50 * size);
  c.save();
  c.translate(x - 50 * size, y + h / 2);
  c.rotate(-Math.PI / 2);
  c.fillText('turns per second', 0, 0);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.4)';
  c.lineWidth = 2 * size;
  c.strokeRect(x, y, w, h);
  for (const t of theory) {
    c.strokeStyle = t.col;
    c.globalAlpha = 0.55;
    c.setLineDash([8 * size, 6 * size]);
    c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const v = xs[0] + ((xs.at(-1) - xs[0]) * i) / 60;
      const py = Y(t.fn(v));
      if (i === 0) c.moveTo(X(v), py);
      else c.lineTo(X(v), py);
    }
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
  }
  for (const r of runs) {
    c.fillStyle = r.col;
    c.beginPath();
    c.arc(X(r.x) + (r.jitter ?? 0) * size, Y(r.f), (r.me ? 9 : 7) * size, 0, Math.PI * 2);
    c.fill();
    if (r.me) {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2 * size;
      c.stroke();
    }
  }
  c.textAlign = 'left';
}

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
    else if (v.kind === 'world') this.drawWorld(c, v);
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
    c.fillText('Class results: turns per second', 40, 64);
    c.font = `400 24px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText(`${v.count} result${v.count === 1 ? '' : 's'} from the class${v.adv ? ' · dashed lines: theory for a 200 g hanging weight (bigger pulls sit higher)' : ''}. Ringed dots are yours.`, 40, 100);
    const runs = v.runs;
    const jit = (i) => ((i * 37) % 9) - 4;
    // left: against mass, coloured by length
    drawChart(c, 150, 150, 610, 520, {
      xs: BALLS, xLabel: 'ball mass (g)', xFmt: (g) => String(g),
      runs: runs.map((r, i) => ({ x: r.m, f: r.f, col: LENGTH_COLS[LENGTHS.indexOf(r.L)] ?? '#fff', me: r.me, jitter: jit(i) })),
      theory: v.adv ? LENGTHS.map((L, i) => ({ col: LENGTH_COLS[i], fn: (m) => idealRps(m, L, CORE_HANGING) })) : [],
    });
    // right: against length, coloured by mass
    drawChart(c, 960, 150, 610, 520, {
      xs: LENGTHS, xLabel: 'string length, the radius (m)', xFmt: (L) => L.toFixed(1),
      runs: runs.map((r, i) => ({ x: r.L, f: r.f, col: MASS_COLS[BALLS.indexOf(r.m)] ?? '#fff', me: r.me, jitter: jit(i) })),
      theory: v.adv ? BALLS.map((m, i) => ({ col: MASS_COLS[i], fn: (L) => idealRps(m, L, CORE_HANGING) })) : [],
    });
    // keys
    c.font = `600 22px ${FONT}`;
    let x = 150;
    LENGTHS.forEach((L, i) => {
      c.fillStyle = LENGTH_COLS[i];
      c.fillText(`● ${L.toFixed(1)} m`, x, 790);
      x += 130;
    });
    x = 960;
    BALLS.forEach((g, i) => {
      c.fillStyle = MASS_COLS[i];
      c.fillText(`● ${g} g`, x, 790);
      x += 115;
    });
  }

  drawWorld(c, v) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText('What keeps it going round?', 40, 70);
    c.font = `400 26px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('Something always pulls towards the centre. Take it away and the object carries straight on, along the tangent.', 40, 110);
    const w = (W - 80 - 2 * 24) / 3;
    EXAMPLES.forEach((e, i) => {
      const x = 40 + i * (w + 24);
      rr(c, x, 150, w, 520, 18);
      c.fillStyle = v.done.includes(e.id) ? '#1d4a36' : '#1b2444';
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `800 34px ${FONT}`;
      c.fillText(e.name, x + 24, 205);
      c.fillStyle = DIM;
      c.font = `700 22px ${FONT}`;
      c.fillText('THE CENTRIPETAL FORCE', x + 24, 260);
      c.fillStyle = '#ff8a8a';
      c.font = `800 34px ${FONT}`;
      c.fillText(e.force, x + 24, 302);
      c.fillStyle = '#e6eaff';
      c.font = `400 25px ${FONT}`;
      wrap(c, e.what, w - 48).slice(0, 6).forEach((l, k) => c.fillText(l, x + 24, 350 + k * 33));
      c.fillStyle = v.done.includes(e.id) ? GOOD : '#ffd166';
      c.font = `700 25px ${FONT}`;
      c.fillText(v.done.includes(e.id) ? `${e.lose}: it flew off along the tangent ✓` : `Try it: ${e.lose}`, x + 24, 640);
    });
  }
}
