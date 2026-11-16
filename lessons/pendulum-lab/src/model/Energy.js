import * as THREE from 'three';

// The energy display beside the pendulum: live bars of its gravitational potential energy, kinetic energy and
// the energy lost so far (to the air and the pivot), as shares of what it started with; and the swing dying
// away, each turning point's angle against time, with the point where it fell to half marked.

const W = 900;
const H = 560;

export class Energy {
  constructor(app) {
    this.app = app;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const w = 0.44;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * H) / W), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, transparent: true }));
    app.lab.add(this.mesh);
    this.mesh.position.set(0.55, 0.42, -0.2);
    this.mesh.rotation.y = -0.35;
    this.mesh.visible = false;
  }

  draw(p) {
    this.frame = (this.frame ?? 0) + 1;
    if (this.frame % 3) return;
    const c = this.canvas.getContext('2d');
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(14,18,32,0.92)';
    c.beginPath();
    c.roundRect(0, 0, W, H, 26);
    c.fill();
    c.font = '700 30px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.textBaseline = 'alphabetic';
    c.fillText('Energy', 24, 44);
    const E0 = p.E0 || 1e-9;
    const gpe = p.running || p.peaks.length ? p.gpe() / E0 : 0;
    const ke = p.running || p.peaks.length ? p.ke() / E0 : 0;
    const lost = p.peaks.length ? Math.max(0, 1 - gpe - ke) : 0;
    const bars = [['Potential', gpe, '#7cc4ff'], ['Kinetic', ke, '#ffd166'], ['Lost (heat, sound)', lost, '#ff8a8a']];
    const bx = 30;
    const by = 90;
    const bh = 360;
    bars.forEach(([name, f, col], i) => {
      const x = bx + i * 95;
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(x, by, 64, bh);
      c.fillStyle = col;
      c.fillRect(x, by + bh * (1 - Math.min(1, f)), 64, bh * Math.min(1, f));
      c.fillStyle = '#ffffff';
      c.font = '700 22px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(`${Math.round(f * 100)}%`, x + 32, by + bh + 32);
      c.font = '500 17px system-ui, sans-serif';
      c.fillStyle = '#aab3d8';
      const words = name.split(' ');
      c.fillText(words[0], x + 32, by + bh + 58);
      if (words[1]) c.fillText(words.slice(1).join(' '), x + 32, by + bh + 78);
      c.textAlign = 'left';
    });
    // decay graph
    const gx = 340;
    const gy = 90;
    const gw = W - gx - 30;
    const gh = 360;
    c.fillStyle = '#ffffff';
    c.font = '700 26px system-ui, sans-serif';
    c.fillText('Size of each swing', gx, 44);
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 2;
    c.strokeRect(gx, gy, gw, gh);
    const pk = p.peaks;
    const a0 = pk[0]?.[1] || 1;
    const tMax = Math.max(10, pk.at(-1)?.[0] ?? 0);
    c.font = '500 17px system-ui, sans-serif';
    c.fillStyle = '#aab3d8';
    c.fillText(`${a0.toFixed(0)}°`, gx - 0, gy - 8);
    c.fillText(`time → ${tMax.toFixed(0)} s`, gx + gw - 110, gy + gh + 26);
    // half line
    c.setLineDash([8, 6]);
    c.strokeStyle = 'rgba(255,209,102,0.6)';
    c.beginPath();
    c.moveTo(gx, gy + gh / 2);
    c.lineTo(gx + gw, gy + gh / 2);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#ffd166';
    c.fillText('half', gx + 6, gy + gh / 2 - 6);
    c.strokeStyle = '#7ee2a8';
    c.lineWidth = 3;
    c.beginPath();
    pk.forEach(([t, a], i) => {
      const x = gx + (t / tMax) * gw;
      const y = gy + gh - (a / a0) * gh;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    c.stroke();
    const half = pk.findIndex(([, a]) => a <= a0 / 2);
    c.font = '600 21px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    const swings = Math.floor((pk.length - 1) / 2);
    c.fillText(half > 0 ? `Halved after ${Math.round(half / 2)} swing${Math.round(half / 2) === 1 ? '' : 's'} (${pk[half][0].toFixed(0)} s)` : p.running ? `${swings} swing${swings === 1 ? '' : 's'} so far: not halved yet` : 'Let it go to start', gx, gy + gh + 60);
    this.tex.needsUpdate = true;
  }
}
