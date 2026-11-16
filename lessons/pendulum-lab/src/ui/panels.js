import { LEVELS, LENGTHS, GIANT_LENGTHS, ANGLES, BOBS, AIR, PLANETS, WORLD, FACTORS, DISCUSS, QUESTIONS, SECONDS_L, periodSmall } from '../data/pendulum.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['measure', 'Measure'], ['energy', 'Energy'], ['world', 'Real world']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const r = app.rig;
  const adv = s.level === 'advanced';
  ui.title('Pendulum Lab', { size: 40 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${adv ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { cols: 2, height: 48, size: 19, gap: 8 });
  }

  if (s.mode === 'predict') {
    if (app.controlsBoard) {
      const ch = app.challenge();
      ui.text('Read the question out and let everyone pick, then reveal the answer.', { size: 21, color: THEME.dim });
      ui.buttons(app.predictions().map((p, i) => ({ id: `round-${i}`, label: `${i + 1}. ${p.name}`, active: s.round === i, onClick: () => app.setRound(i) })), { cols: 2, height: 50, size: 20, gap: 8 });
      ui.buttons([{ id: 'reveal', label: ch.revealed ? 'Hide the answer' : 'Reveal the answer', active: ch.revealed, onClick: () => app.reveal() }], { height: 58, size: 24 });
      const t = app.tally(ch);
      ui.text(`${t.votes} answer${t.votes === 1 ? '' : 's'} in so far.`, { size: 22, weight: 700 });
    } else ui.text('Read the question on the class board and pick your answer on the right. Your teacher will reveal it.', { size: 22, color: THEME.dim });
  } else if (s.mode === 'measure') {
    ui.heading('Pendulum', { size: 21 });
    ui.buttons([['bench', 'Bench'], ['giant', 'Giant (from the ceiling)']].map(([id, label]) => ({ id: `t-${id}`, label, active: r.target === id, onClick: () => app.setTarget(id) })), { height: 44, size: 18, gap: 8 });
    ui.heading('Length', { size: 21 });
    if (r.target === 'giant') ui.buttons(GIANT_LENGTHS.map((L) => ({ id: `gl-${L}`, label: `${L.toFixed(1)} m`, active: r.giant.L === L, onClick: () => app.setLength(L) })), { height: 42, size: 18, gap: 6 });
    else ui.buttons(LENGTHS.map((L) => ({ id: `l-${L}`, label: L.toFixed(1), active: Math.abs(r.bench.L - L) < 1e-6, onClick: () => app.setLength(L) })), { cols: 4, height: 40, size: 17, gap: 5 });
    drawRelease(ui, app);
    drawWatch(ui, app);
  } else if (s.mode === 'energy') {
    ui.heading('Bob', { size: 21 });
    ui.buttons(Object.entries(BOBS).map(([id, b]) => ({ id: `b-${id}`, label: b.name, active: r.bench.bob === id, onClick: () => app.setBob(id) })), { cols: 2, height: 42, size: 16, gap: 6 });
    ui.heading('Air resistance', { size: 21 });
    ui.buttons(AIR.map(([id, label, f]) => ({ id: `a-${id}`, label, active: r.bench.air === f, onClick: () => app.setAir(f) })), { cols: 2, height: 42, size: 16, gap: 6 });
    drawRelease(ui, app);
  } else {
    ui.heading('Look at', { size: 21 });
    ui.buttons(WORLD.map(([id, label]) => ({ id: `w-${id}`, label, active: s.world === id, onClick: () => app.setWorld(id) })), { cols: 2, height: 44, size: 17, gap: 6 });
    const w = app.world;
    if (s.world === 'clock') {
      ui.heading('Pendulum length', { size: 21 });
      ui.buttons([['-0.01', '− 1 cm'], ['-0.001', '− 1 mm'], ['0.001', '+ 1 mm'], ['0.01', '+ 1 cm']].map(([d, label]) => ({ id: `c${d}`, label, onClick: () => app.adjustClock(+d) })), { height: 46, size: 17, gap: 5 });
    } else if (s.world === 'swing') {
      ui.buttons([['swing', 'Playground swing'], ['ship', 'Pirate ship']].map(([id, label]) => ({ id: `ride-${id}`, label, active: w.ride === id, onClick: () => app.setRide(id) })), { height: 44, size: 17, gap: 6 });
      ui.buttons([{ id: 'push', label: 'Push!', onClick: () => app.pushSwing() }], { height: 64, size: 28 });
    } else if (s.world === 'metronome') {
      ui.heading('Beats per minute (slide the weight)', { size: 19 });
      ui.buttons([40, 60, 80, 100, 120, 144, 176, 208].map((b) => ({ id: `bpm-${b}`, label: String(b), active: w.bpm === b, onClick: () => app.setBpm(b) })), { cols: 4, height: 42, size: 17, gap: 5 });
    } else {
      ui.heading('Take the bench pendulum to…', { size: 19 });
      ui.buttons(Object.entries(PLANETS).map(([id, p]) => ({ id: `p-${id}`, label: p.name, active: s.planet === id, onClick: () => app.setPlanet(id) })), { cols: 2, height: 44, size: 18, gap: 6 });
      drawRelease(ui, app);
    }
  }

  if (!app.followsAdmin) {
    ui.heading('Level', { size: 22 });
    ui.buttons(LEVELS.map(([id, label]) => ({ id: `level-${id}`, label, active: s.level === id, onClick: () => app.setLevel(id) })), { height: 46, size: 20, gap: 8 });
  }
  if (app.controlsBoard) ui.buttons([{ id: 'board', label: s.big ? 'Class board: shown' : 'Class board: hidden', active: s.big, onClick: () => app.toggleBoard() }], { height: 46, size: 20 });
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

function drawRelease(ui, app) {
  const r = app.rig;
  ui.heading('Release angle', { size: 21 });
  ui.buttons(ANGLES.map((d) => ({ id: `d-${d}`, label: `${d}°`, active: r.deg === d, onClick: () => app.setAngle(d) })), { cols: 4, height: 40, size: 17, gap: 5 });
  ui.buttons([{ id: 'release', label: r.active.running ? 'Swinging…' : 'Let go', disabled: r.active.running, onClick: () => app.release() }, { id: 'stop', label: 'Stop', onClick: () => app.stopSwing() }], { height: 48, size: 20, gap: 8 });
}

function drawWatch(ui, app) {
  const w = app.rig.watch;
  ui.heading('Stopwatch', { size: 21 });
  ui.buttons([
    { id: 'watch', label: w.running ? 'Stop' : 'Start', active: w.running, onClick: () => app.pressStartStop() },
    { id: 'count', label: `Count a swing (${w.n})`, disabled: !w.running, onClick: () => app.pressCount() },
  ], { height: 50, size: 19, gap: 8 });
}

// ───────────────────────── Right ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'predict') drawPredict(ui, app);
  else if (s.mode === 'measure') drawMeasure(ui, app);
  else if (s.mode === 'energy') drawEnergy(ui, app);
  else drawWorld(ui, app);
  ui.divider();
  ui.heading('Ask the physicist', { size: 24 });
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.physicistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.phys.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 16, gap: 8 });
  if (s.phys.answer) ui.box(s.phys.answer, { size: 20 });
}

function drawPredict(ui, app) {
  const ch = app.challenge();
  const mine = app.myVote(ch);
  ui.title(ch.title, { size: 30 });
  ui.text(ch.q, { size: 22 });
  ui.gap(4);
  if (!ch.revealed) {
    ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCD'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 52, size: 18, gap: 8 }));
    ui.text(mine == null ? 'Pick your answer.' : 'Saved. You can change it until the answer is revealed.', { size: 20, color: mine == null ? WARN : GOOD });
  } else {
    ch.options.forEach((o, i) => {
      const right = i === ch.answer;
      ui.text(`${right ? '✓' : mine === i ? '✗' : '  '}  ${'ABCD'[i]}   ${o}${mine === i ? '   (you)' : ''}`, { size: 19, weight: right || mine === i ? 700 : 400, color: right ? GOOD : mine === i ? BAD : THEME.dim });
    });
    ui.gap(6);
    ui.box(ch.why, { size: 20 });
  }
  ui.heading('Discuss: what might affect the swing?', { size: 21 });
  for (const f of FACTORS) ui.text(`• ${f}`, { size: 19 });
}

function drawMeasure(ui, app) {
  const s = app.state;
  const r = app.rig;
  const adv = s.level === 'advanced';
  const p = r.active;
  ui.title(`${r.target === 'giant' ? 'Giant' : 'Bench'} pendulum: ${p.L.toFixed(2)} m`, { size: 28 });
  ui.text('Start the stopwatch as you let go, tap “Count a swing” each time it comes back to where you let go, and stop after 10 swings.', { size: 18, color: THEME.dim });
  const gp = p.gatePeriod();
  ui.text(s.gateShown ? `Light gate: ${gp ? `${gp.toFixed(3)} s per swing` : 'waiting for a full swing…'}` : 'Light gate reading: hidden until you have timed it yourself', { size: 19, weight: 700, color: s.gateShown ? '#ff8080' : THEME.dim });
  ui.buttons([{ id: 'gate', label: s.gateShown ? 'Hide the light gate' : 'Show the light gate', active: s.gateShown, onClick: () => app.toggleGate() }], { height: 42, size: 17 });
  const runs = s.runs;
  if (runs.length) {
    const { ctx } = ui;
    ui.heading('Results', { size: 20 });
    const cols = adv ? [0, 70, 130, 210, 300, 380] : [0, 80, 150, 240, 340];
    ctx.font = font(16, 700);
    ctx.fillStyle = THEME.accent;
    ctx.textBaseline = 'top';
    (adv ? ['L (m)', 'Swings', 'Time (s)', 'T (s)', 'T² (s²)', 'Gate T'] : ['L (m)', 'Swings', 'Time (s)', 'T (s)', 'Gate T']).forEach((h, i) => ctx.fillText(h, ui.pad + cols[i], ui.y));
    ui.y += 24;
    for (const x of runs.slice(-7)) {
      const cells = adv ? [x.L.toFixed(2), String(x.n), x.t.toFixed(2), x.T.toFixed(3), (x.T * x.T).toFixed(2), x.gate ? x.gate.toFixed(3) : '–'] : [x.L.toFixed(2), String(x.n), x.t.toFixed(2), x.T.toFixed(3), x.gate ? x.gate.toFixed(3) : '–'];
      ctx.font = font(16, 600);
      cells.forEach((c, i) => {
        ctx.fillStyle = x.g !== 9.81 && i === 0 ? WARN : THEME.text;
        ctx.fillText(c, ui.pad + cols[i], ui.y + 4);
      });
      ui.y += 26;
    }
    drawGraph(ui, runs, adv);
    if (adv && runs.length >= 2) {
      const pts = runs.filter((x) => x.g === 9.81);
      const slope = pts.reduce((a, x) => a + x.T * x.T * x.L, 0) / pts.reduce((a, x) => a + x.L * x.L, 0);
      ui.text(`Best line through 0: T² = ${slope.toFixed(2)} × L, so g = 4π² ÷ ${slope.toFixed(2)} = ${((4 * Math.PI * Math.PI) / slope).toFixed(2)} m/s²`, { size: 18, weight: 700, color: GOOD });
    }
  }
}

function drawGraph(ui, runs, adv) {
  const { ctx } = ui;
  const x = ui.pad + 50;
  const y = ui.y + 10;
  const w = ui.contentWidth - 60;
  const h = 170;
  const xMax = 2.6;
  const pts = runs.map((r) => [r.L, adv ? r.T * r.T : r.T]);
  const yMax = adv ? 11 : 3.4;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  for (let i = 0; i <= 50; i++) {
    const L = (xMax * i) / 50;
    const T = periodSmall(L);
    const py = y + h - ((adv ? T * T : T) / yMax) * h;
    if (i === 0) ctx.moveTo(x + (L / xMax) * w, py);
    else ctx.lineTo(x + (L / xMax) * w, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#5b9bff';
  for (const [L, v] of pts) {
    ctx.beginPath();
    ctx.arc(x + (L / xMax) * w, y + h - (Math.min(v, yMax) / yMax) * h, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = font(14);
  ctx.fillStyle = THEME.dim;
  ctx.fillText(adv ? 'T² (s²)' : 'T (s)', ui.pad, y);
  ctx.fillText('length (m) → 2.6', x + w - 120, y + h + 6);
  ui.y = y + h + 30;
}

function drawEnergy(ui, app) {
  const s = app.state;
  const p = app.rig.bench;
  const b = BOBS[p.bob];
  ui.title('Energy and momentum', { size: 28 });
  ui.text(`${b.name} bob, ${(b.m * 1000).toFixed(b.m < 0.01 ? 1 : 0)} g, in ${AIR.find(([, , f]) => f === p.air)[1].toLowerCase()}.`, { size: 19, weight: 700 });
  ui.text('At the ends of each swing it stops for an instant: all its energy is gravitational potential energy. At the bottom it is all kinetic energy, and its momentum is biggest. Each swing, the air takes a little energy away as heat and sound, so the swings get smaller.', { size: 18, color: THEME.dim });
  if (p.running || p.peaks.length) {
    const v = p.L * p.w;
    ui.text(`Speed ${Math.abs(v).toFixed(2)} m/s · momentum ${(p.m * Math.abs(v)).toFixed(3)} kg m/s · period ${p.gatePeriod()?.toFixed(3) ?? '…'} s`, { size: 18, weight: 700, color: THEME.accent });
  }
  ui.heading('Try', { size: 20 });
  for (const t of ['Steel against polystyrene: which keeps swinging longer? Does the period change?', 'Add the paper sail: what happens to the swings, and to the period?', 'Take the air away (vacuum): does it ever stop?']) ui.text(`• ${t}`, { size: 18 });
  if (s.energyRows.length) {
    ui.heading('Your results: swings to halve', { size: 20 });
    for (const r of s.energyRows.slice(-6)) ui.text(`${r.bob}, ${r.airName}: ${r.swings >= 200 ? '200+' : r.swings} swings`, { size: 17 });
  }
}

function drawWorld(ui, app) {
  const s = app.state;
  const w = app.world;
  if (s.world === 'clock') {
    const err = w.clockError;
    const L = w.clockPend.L;
    ui.title('Pendulum clock', { size: 28 });
    ui.text('A grandfather clock counts swings of its pendulum: one second each way. Adjust the length until it keeps time with the real clock (both dials run 600× faster so you can see them drift).', { size: 18, color: THEME.dim });
    ui.text(`Pendulum ${(L * 100).toFixed(1)} cm`, { size: 22, weight: 700 });
    ui.text(Math.abs(err) < 5 ? 'Keeping perfect time!' : `${err > 0 ? 'Gains' : 'Loses'} ${Math.abs(err) >= 120 ? `${(Math.abs(err) / 60).toFixed(1)} minutes` : `${Math.round(Math.abs(err))} seconds`} a day`, { size: 26, weight: 800, color: Math.abs(err) < 60 ? GOOD : WARN });
    ui.text(err < 0 ? 'Running slow: the pendulum is too long. Shorten it.' : err > 0 ? 'Running fast: the pendulum is too short. Lengthen it.' : '', { size: 18 });
    if (s.level === 'advanced') ui.text(`For a period of exactly 2 s: L = g ÷ π² = ${(SECONDS_L * 100).toFixed(2)} cm.`, { size: 17, color: THEME.dim });
  } else if (s.world === 'swing') {
    const p = w.swingPend;
    ui.title(w.ride === 'ship' ? 'Pirate ship' : 'Playground swing', { size: 28 });
    ui.text(`${p.L} m long, so each swing takes ${periodSmall(p.L).toFixed(1)} s whoever is on it.`, { size: 19, weight: 700 });
    ui.text('You stand behind and push forwards. Push just as it starts moving away from you and every push adds energy: it goes higher and higher (resonance). Push while it is coming back towards you and you take energy away.', { size: 18, color: THEME.dim });
    ui.text(`Highest swing: ${w.maxDeg.toFixed(0)}°`, { size: 24, weight: 800, color: THEME.accent });
  } else if (s.world === 'metronome') {
    ui.title('Metronome', { size: 28 });
    ui.text(`${w.bpm} beats a minute: a tick every ${(60 / w.bpm).toFixed(2)} s, a full swing every ${(120 / w.bpm).toFixed(2)} s.`, { size: 20, weight: 700 });
    ui.text('A metronome is an upside-down pendulum. Sliding the weight up the arm makes it act like a longer pendulum, so it swings more slowly and the beat slows down.', { size: 18, color: THEME.dim });
  } else {
    const pl = PLANETS[s.planet];
    ui.title(`On ${pl.name}`, { size: 28 });
    ui.text(`g = ${pl.g} m/s². The same ${app.rig.bench.L.toFixed(2)} m pendulum takes ${periodSmall(app.rig.bench.L, pl.g).toFixed(2)} s per swing (${periodSmall(app.rig.bench.L).toFixed(2)} s on Earth).`, { size: 19, weight: 700 });
    ui.text('Weaker gravity pulls it back to the middle more gently, so it swings more slowly. A pendulum clock taken to the Moon would run very slow.', { size: 18, color: THEME.dim });
  }
  ui.heading('Discuss', { size: 21 });
  for (const q of DISCUSS) ui.text(`• ${q}`, { size: 17 });
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text(e.kicker ?? 'PHYSICIST EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 26;
  ctx.font = font(size);
  while (size > 17 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 16) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
