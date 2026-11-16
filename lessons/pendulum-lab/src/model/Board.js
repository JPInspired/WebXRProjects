import * as THREE from 'three';

// The class board (2.6 m wide):
//   predict – the prediction question and, once revealed, how the class answered;
//   results – everyone's period against length (period² against length at Advanced), with the theory;
//   energy  – how many swings it took to halve, for each bob and air setting the class tried;
//   world   – the clock challenge (who got closest to keeping time) and the pendulum on other planets.

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
    else if (v.kind === 'energy') this.drawEnergy(c, v);
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
    const sq = v.adv;
    c.fillStyle = '#ffffff';
    c.font = `700 44px ${FONT}`;
    c.fillText(sq ? 'Class results: period² against length' : 'Class results: period against length', 40, 64);
    c.font = `400 24px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText(`${v.points.length} result${v.points.length === 1 ? '' : 's'} (each from timing several swings). Ringed dots are yours. ${sq ? 'A straight line through 0: its slope is 4π²/g.' : 'Dashed: the theory, T = 2π√(L/g).'}`, 40, 100);
    const x = 170;
    const y = 140;
    const w = W - 260;
    const h = 560;
    const xMax = 2.6;
    const yMax = sq ? 11 : 3.4;
    const X = (u) => x + (u / xMax) * w;
    const Y = (u) => y + h - (Math.min(u, yMax) / yMax) * h;
    c.font = `400 20px ${FONT}`;
    c.textAlign = 'right';
    const step = sq ? 1 : 0.5;
    for (let u = 0; u <= yMax + 1e-6; u += step) {
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(x, Y(u), w, 1.5);
      c.fillStyle = DIM;
      c.fillText(u.toFixed(sq ? 0 : 1), x - 10, Y(u) + 7);
    }
    c.textAlign = 'center';
    for (let u = 0; u <= xMax + 1e-6; u += 0.2) c.fillText(u.toFixed(1), X(u), y + h + 30);
    c.fillText('length (m)', x + w / 2, y + h + 64);
    c.save();
    c.translate(x - 70, y + h / 2);
    c.rotate(-Math.PI / 2);
    c.fillText(sq ? 'period² (s²)' : 'period (s)', 0, 0);
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    c.strokeStyle = '#ffffff';
    c.globalAlpha = 0.55;
    c.setLineDash([10, 8]);
    c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const L = (xMax * i) / 80;
      const T = 2 * Math.PI * Math.sqrt(L / 9.81);
      const py = Y(sq ? T * T : T);
      if (i === 0) c.moveTo(X(L), py);
      else c.lineTo(X(L), py);
    }
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
    v.points.forEach((p, i) => {
      c.fillStyle = css(p.color);
      c.beginPath();
      c.arc(X(p.L) + (((i * 37) % 9) - 4), Y(sq ? p.T * p.T : p.T), p.me ? 10 : 8, 0, Math.PI * 2);
      c.fill();
      if (p.me) {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2.5;
        c.stroke();
      }
    });
    c.textAlign = 'left';
  }

  drawEnergy(c, v) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText('How quickly do the swings die away?', 40, 70);
    c.font = `400 26px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('Swings until the swing is half as big, for each bob and air setting the class has tried.', 40, 110);
    const rows = v.rows.slice(0, 10);
    const most = Math.max(5, ...rows.map((r) => Math.min(r.swings, 200)));
    rows.forEach((r, i) => {
      const y = 150 + i * 62;
      rr(c, 40, y, W - 80, 54, 10);
      c.fillStyle = '#1b2444';
      c.fill();
      rr(c, 520, y + 10, Math.max(10, ((W - 720) * Math.min(r.swings, 200)) / most), 34, 8);
      c.fillStyle = r.air === 'vacuum' ? '#2f8a5c' : '#3e5bd0';
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `600 26px ${FONT}`;
      c.fillText(`${r.bob} · ${r.airName}`, 64, y + 36);
      c.font = `700 26px ${FONT}`;
      c.textAlign = 'right';
      c.fillText(r.swings >= 200 ? '200+ swings' : `${r.swings} swing${r.swings === 1 ? '' : 's'}`, W - 64, y + 36);
      c.textAlign = 'left';
    });
    if (!rows.length) {
      c.font = `400 28px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('Results appear when someone’s pendulum swing has halved.', 40, 190);
    }
    c.font = `600 26px ${FONT}`;
    c.fillStyle = '#ffd166';
    c.fillText('Light or draggy bobs lose their energy to the air quickly; the period hardly changes.', 40, H - 30);
  }

  drawWorld(c, v) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText('Pendulums in the real world', 40, 70);
    const w = (W - 80 - 24) / 2;
    // clock challenge
    rr(c, 40, 110, w, 660, 18);
    c.fillStyle = '#1b2444';
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = `800 32px ${FONT}`;
    c.fillText('Clock challenge: keep time', 64, 160);
    c.font = `400 24px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('Best so far (seconds gained or lost a day):', 64, 200);
    v.clocks.slice(0, 9).forEach((r, i) => {
      const y = 250 + i * 54;
      c.fillStyle = css(r.color);
      c.beginPath();
      c.arc(80, y - 8, 10, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `${r.me ? 800 : 600} 26px ${FONT}`;
      c.fillText(r.name, 104, y);
      c.textAlign = 'right';
      c.fillStyle = Math.abs(r.err) < 60 ? GOOD : '#ffd166';
      c.fillText(`${r.err > 0 ? '+' : ''}${Math.round(r.err)} s/day · ${(r.L * 100).toFixed(1)} cm`, 40 + w - 24, y);
      c.textAlign = 'left';
    });
    // planets
    const x2 = 40 + w + 24;
    rr(c, x2, 110, w, 660, 18);
    c.fillStyle = '#1b2444';
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = `800 32px ${FONT}`;
    c.fillText('The same 1 m pendulum on…', x2 + 24, 160);
    v.planets.forEach((p, i) => {
      const y = 230 + i * 110;
      c.fillStyle = '#ffffff';
      c.font = `700 30px ${FONT}`;
      c.fillText(p.name, x2 + 24, y);
      c.font = `400 24px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText(`g = ${p.g} m/s²`, x2 + 24, y + 36);
      c.font = `800 34px ${FONT}`;
      c.fillStyle = '#ffd166';
      c.textAlign = 'right';
      c.fillText(`period ${p.T.toFixed(2)} s`, x2 + w - 24, y + 14);
      c.textAlign = 'left';
    });
  }
}
