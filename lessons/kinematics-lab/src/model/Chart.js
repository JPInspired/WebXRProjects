import * as THREE from 'three';

// The motion chart, in the style of the original lesson's board: one graph with 20 time samples, drawn as the
// run happens. It shows displacement, velocity or acceleration against time (chosen on the panel).
// Samples are evenly spaced over the run (the fall, the roll, or two swings / bounces).

const W = 1024;
const H = 640;
const QTY = {
  s: { name: 'Displacement', unit: 'm', key: 's' },
  v: { name: 'Velocity', unit: 'm/s', key: 'v' },
  a: { name: 'Acceleration', unit: 'm/s²', key: 'a' },
};

function nice(x) {
  if (x <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

export class Chart {
  constructor(app, w = 0.46) {
    this.app = app;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * H) / W), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, (w * H) / W + 0.02, 0.008), new THREE.MeshStandardMaterial({ color: 0x1a1a1e }));
    frame.position.z = -0.005;
    this.group = new THREE.Group();
    this.group.add(frame, this.mesh);
    app.lab.add(this.group);
    this.key = '';
  }

  /**
   * trace: [{t, s, v, a}]; win: the time the 20 samples cover (s); bounds: {s:[lo,hi], v:[..], a:[..]};
   * qty: 's' | 'v' | 'a'; title: the station.
   */
  draw({ trace, win, bounds, qty, title, done }) {
    const q = QTY[qty];
    const last = trace.at(-1)?.t ?? 0;
    const samples = [];
    let j = 0;
    for (let i = 0; i < 20 && trace.length; i++) {
      const t = (win * i) / 19;
      if (t > last + 1e-6) break;
      while (j < trace.length - 1 && trace[j + 1].t < t) j++;
      const a = trace[j];
      const b = trace[Math.min(j + 1, trace.length - 1)];
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
      samples.push({ t, y: a[q.key] + (b[q.key] - a[q.key]) * Math.max(0, Math.min(1, f)) });
    }
    const key = JSON.stringify([samples.map((s) => s.y.toFixed(3)), qty, title, win.toFixed(2), done]);
    if (key === this.key) return samples;
    this.key = key;
    const c = this.canvas.getContext('2d');
    c.fillStyle = '#2a2a2e';
    c.fillRect(0, 0, W, H);
    // range from what the motion can reach, rounded to nice numbers
    let [lo, hi] = bounds[qty];
    for (const s of samples) {
      lo = Math.min(lo, s.y);
      hi = Math.max(hi, s.y);
    }
    const span = nice(Math.max(Math.abs(lo), Math.abs(hi)) || 1);
    const yMin = lo < -1e-6 ? -span : 0;
    const yMax = hi > 1e-6 ? span : 0;
    const y0 = 70;
    const y1 = H - 80;
    const x0 = 120;
    const x1 = W - 40;
    c.fillStyle = '#4a4a50';
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    const Y = (v) => y1 - ((v - yMin) / (yMax - yMin || 1)) * (y1 - y0);
    const X = (i) => x0 + 20 + (i * (x1 - x0 - 40)) / 19;
    c.font = '600 22px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.textAlign = 'right';
    const steps = 10;
    for (let k = 0; k <= steps; k++) {
      const v = yMin + ((yMax - yMin) * k) / steps;
      c.fillText(v.toFixed(Math.abs(yMax - yMin) < 2 ? 2 : 1), x0 - 12, Y(v) + 7);
      c.fillStyle = 'rgba(255,255,255,0.07)';
      c.fillRect(x0, Y(v), x1 - x0, 1.5);
      c.fillStyle = '#ffffff';
    }
    if (yMin < 0 && yMax > 0) {
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fillRect(x0, Y(0) - 1, x1 - x0, 2.5);
    }
    c.textAlign = 'center';
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 20; i++) c.fillText(String(i + 1), X(i), y1 + 30);
    c.font = '600 20px system-ui, sans-serif';
    c.fillStyle = '#c8cbd6';
    c.fillText(`sample (every ${(win / 19).toFixed(win / 19 < 0.1 ? 3 : 2)} s)`, (x0 + x1) / 2, y1 + 62);
    c.textAlign = 'left';
    c.font = '700 30px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.fillText(`${title}: ${q.name.toLowerCase()} (${q.unit}) against time`, 24, 44);
    // the dots, joined
    c.strokeStyle = 'rgba(126,226,168,0.6)';
    c.lineWidth = 3;
    c.beginPath();
    samples.forEach((s, i) => (i ? c.lineTo(X(i), Y(s.y)) : c.moveTo(X(i), Y(s.y))));
    c.stroke();
    for (let i = 0; i < 20 && trace.length; i++) {
      const s = samples[i];
      c.fillStyle = s ? '#ffffff' : 'rgba(255,255,255,0.25)';
      c.beginPath();
      c.arc(X(i), s ? Y(s.y) : y1, s ? 9 : 6, 0, Math.PI * 2);
      c.fill();
      if (s) {
        c.fillStyle = '#29b38a';
        c.beginPath();
        c.arc(X(i), Y(s.y), 5, 0, Math.PI * 2);
        c.fill();
      }
    }
    this.tex.needsUpdate = true;
    return samples;
  }
}
