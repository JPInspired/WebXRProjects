import { sound } from '../../../shared/util/sound.js';

// The lesson's own sounds, made in code like every other sound in the library (no audio files), through the
// shared output so that ⚙ Settings › Sound: off silences them too.
//   ambience(era)  the background of each moment: cicadas and the city in 1945, wind and fire after, birds later
//   drone()        the bomber, high overhead
//   blast()        the explosion as it reaches you: a deep boom, then a long roar
//   bell()         the Peace Bell

let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b = 0.97 * b + 0.03 * w; // a little "brown" mixed in: softer than white noise
    d[i] = w * 0.5 + b * 3;
  }
  return noiseBuf;
}

function source(ctx, loop = true) {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  s.loop = loop;
  s.loopStart = Math.random();
  return s;
}

function filter(ctx, type, f, q = 0.7) {
  const n = ctx.createBiquadFilter();
  n.type = type;
  n.frequency.value = f;
  n.Q.value = q;
  return n;
}

export class LessonAudio {
  constructor() {
    this.amb = null;
    this.era = null;
  }

  get bus() {
    return sound.bus();
  }

  /** Change the background sound to a moment's (fading across). */
  ambience(era) {
    if (era === this.era) return;
    this.era = era;
    const b = this.bus;
    if (!b) return;
    const { ctx, out } = b;
    const old = this.amb;
    if (old) {
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
      setTimeout(() => { old.stop(); }, 3000);
    }
    this.amb = null;
    if (!era) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    const nodes = [];
    const timers = [];
    const loopNoise = (type, f, q, level) => {
      const s = source(ctx);
      const g = ctx.createGain();
      g.gain.value = level;
      s.connect(filter(ctx, type, f, q)).connect(g).connect(gain);
      s.start();
      nodes.push(s);
      return g;
    };
    if (era === 'before' || era === 'blast') {
      // cicadas: a high, pulsing buzz that swells and fades; the city's murmur underneath
      const c = loopNoise('bandpass', 4600, 6, 0.0);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 38;
      const depth = ctx.createGain();
      depth.gain.value = 0.05;
      lfo.connect(depth).connect(c.gain);
      lfo.start();
      nodes.push(lfo);
      const swell = () => {
        const t = ctx.currentTime;
        c.gain.cancelScheduledValues(t);
        c.gain.setTargetAtTime(0.04 + Math.random() * 0.04, t, 1.5);
        c.gain.setTargetAtTime(0.005, t + 5 + Math.random() * 4, 2);
      };
      swell();
      timers.push(setInterval(swell, 11000));
      loopNoise('lowpass', 380, 0.5, 0.05);
      // now and then, a tram's bell in the distance
      timers.push(setInterval(() => {
        if (Math.random() < 0.5) return;
        const t = ctx.currentTime;
        for (const [f, d] of [[1320, 0], [1320, 0.18]]) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t + d);
          g.gain.exponentialRampToValueAtTime(0.02, t + d + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
          o.connect(g).connect(gain);
          o.start(t + d);
          o.stop(t + d + 0.7);
        }
      }, 9000));
    } else if (era === 'after') {
      // wind, and fire crackling
      loopNoise('lowpass', 500, 0.6, 0.09);
      loopNoise('bandpass', 180, 0.8, 0.06);
      timers.push(setInterval(() => {
        const t = ctx.currentTime;
        for (let i = 0; i < 6; i++) {
          const s = source(ctx, false);
          const g = ctx.createGain();
          const d = Math.random() * 0.9;
          g.gain.setValueAtTime(0.0001, t + d);
          g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, t + d + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
          s.connect(filter(ctx, 'highpass', 1800 + Math.random() * 2000)).connect(g).connect(gain);
          s.start(t + d, Math.random() * 2, 0.1);
        }
      }, 900));
    } else if (era === 'hill') {
      loopNoise('lowpass', 300, 0.6, 0.12);
      loopNoise('lowpass', 90, 0.8, 0.12);
    } else {
      // birds and a quiet city
      loopNoise('lowpass', 420, 0.5, 0.045);
      timers.push(setInterval(() => {
        if (Math.random() < 0.35) return;
        const t = ctx.currentTime;
        const n = 2 + Math.floor(Math.random() * 4);
        const f0 = 2600 + Math.random() * 1600;
        for (let i = 0; i < n; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const d = i * 0.13;
          o.frequency.setValueAtTime(f0, t + d);
          o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.4), t + d + 0.08);
          g.gain.setValueAtTime(0.0001, t + d);
          g.gain.exponentialRampToValueAtTime(0.012, t + d + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.1);
          o.connect(g).connect(gain);
          o.start(t + d);
          o.stop(t + d + 0.12);
        }
      }, 1700));
    }
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    this.amb = {
      gain,
      stop() {
        for (const t of timers) clearInterval(t);
        for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } }
        gain.disconnect();
      },
    };
  }

  /** The bomber's engines high above, for `seconds`. */
  drone(seconds = 7) {
    const b = this.bus;
    if (!b) return;
    const { ctx, out } = b;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    const lp = filter(ctx, 'lowpass', 300);
    lp.connect(g).connect(out);
    for (const f of [55, 57.5, 110.5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + seconds + 0.1);
    }
  }

  /** The explosion reaching you: a boom and a long roar. `soft`: quieter (the gentle setting). */
  blast(soft = false) {
    const b = this.bus;
    if (!b) return;
    const { ctx, out } = b;
    const t = ctx.currentTime;
    const level = soft ? 0.45 : 1;
    // the boom: a falling deep tone and a burst of low noise
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 2.5);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.7 * level, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 3.1);
    // the roar: noise, bright at first, darkening as it goes on
    const s = source(ctx);
    const lp = filter(ctx, 'lowpass', 3000);
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + 9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * level, t + 0.05);
    g.gain.setTargetAtTime(0.18 * level, t + 0.6, 1.2);
    g.gain.setTargetAtTime(0.0001, t + 5, 2.5);
    s.connect(lp).connect(g).connect(out);
    s.start(t);
    s.stop(t + 16);
    // debris falling, a little later
    for (let i = 0; i < 40; i++) {
      const d = 0.6 + Math.random() * 6;
      const n = source(ctx, false);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t + d);
      ng.gain.exponentialRampToValueAtTime((0.04 + Math.random() * 0.08) * level, t + d + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
      n.connect(filter(ctx, 'bandpass', 300 + Math.random() * 1500, 1.5)).connect(ng).connect(out);
      n.start(t + d, Math.random() * 2, 0.3);
    }
  }

  /** The far rumble of the cloud, heard from the hills. */
  rumble(seconds = 30) {
    const b = this.bus;
    if (!b) return;
    const { ctx, out } = b;
    const t = ctx.currentTime;
    const s = source(ctx);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 3);
    g.gain.setTargetAtTime(0.0001, t + seconds - 6, 2);
    s.connect(filter(ctx, 'lowpass', 120)).connect(g).connect(out);
    s.start(t);
    s.stop(t + seconds);
  }

  /** The Peace Bell: a deep, long bronze note. */
  bell() {
    const b = this.bus;
    if (!b) return;
    const { ctx, out } = b;
    const t = ctx.currentTime;
    for (const [f, a, d] of [[98, 0.22, 9], [196.5, 0.12, 7], [233, 0.06, 5], [294, 0.05, 6], [392.6, 0.03, 4], [523, 0.015, 3]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + d + 0.1);
    }
    const s = source(ctx, false);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    s.connect(filter(ctx, 'lowpass', 600)).connect(g).connect(out);
    s.start(t, 0, 0.2);
  }

  stopAll() {
    this.ambience(null);
  }
}
