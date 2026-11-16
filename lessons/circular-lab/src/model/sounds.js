// The lab's sounds, made in the browser (no audio files): a whoosh each time the ball passes you (louder and
// brighter the faster it goes), a light-gate blip, and the snip of the scissors.

let ctx = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function hiss(dur, gain, freq, q = 0.8) {
  const a = ac();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t) ** 2;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

function tone(freq, dur, gain, type = 'sine') {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const fx = {
  /** speed in m/s */
  whoosh: (v) => hiss(Math.max(0.12, Math.min(0.3, 0.6 / (v + 0.5))), Math.min(0.5, 0.05 + v * 0.06), 300 + v * 160),
  gate: () => tone(1800, 0.05, 0.05, 'square'),
  snip: () => { hiss(0.06, 0.6, 4000, 2); tone(2600, 0.04, 0.05, 'triangle'); },
};
