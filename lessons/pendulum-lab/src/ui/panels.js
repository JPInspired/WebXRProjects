import { LENGTHS, GIANT_LENGTHS, ANGLES, BOBS, AIR, PLANETS, WORLD, FACTORS, DISCUSS, QUESTIONS, SECONDS_L, periodSmall } from '../data/pendulum.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

// The side menus, kept short: the left menu has a tab per activity, and inside it a tab per step; the right
// menu shows only results. Settings (level, class board, the headset's own buttons) and "Ask the physicist"
// open in a pop-up card.

export const MODES = [['predict', 'Predict'], ['measure', 'Measure'], ['energy', 'Energy'], ['world', 'Real world']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const BIG = { height: 66, size: 24, gap: 10 };
const MID = { height: 50, size: 19, gap: 8 };

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const r = app.rig;
  ui.header('Pendulum Lab', [{ id: 'settings', label: '⚙', onClick: () => app.openLessonSettings(), active: app.popupOpen === 'Settings' }]);
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  chosen by ${app.adminName}`, { size: 22, weight: 700, color: THEME.accent });
    ui.gap(6);
  } else ui.tabs(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 56, size: 19 });

  if (s.mode === 'predict') {
    if (app.soloTeacher) {
      const ch = app.challenge();
      ui.text('Question on the class board:', { size: 20, color: THEME.dim });
      ui.buttons(app.predictions().map((p, i) => ({ id: `round-${i}`, label: `${i + 1}. ${p.name}`, active: s.round === i, onClick: () => app.setRound(i) })), { cols: 2, ...MID });
      ui.buttons([{ id: 'reveal', label: ch.revealed ? 'Hide the Answer' : 'Reveal the Answer', active: ch.revealed, onClick: () => app.reveal() }], BIG);
      const t = app.tally(ch);
      ui.text(`${t.votes} answer${t.votes === 1 ? '' : 's'} in so far.`, { size: 21, weight: 700 });
    } else ui.text('Answer the question on the right. Your teacher will reveal it.', { size: 22, color: THEME.dim });
    return;
  }

  if (s.mode === 'measure') {
    const sub = s.sub.measure;
    ui.tabs([['setup', '1  Set up'], ['time', '2  Time it']].map(([id, label]) => ({ id: `sub-${id}`, label, active: sub === id, onClick: () => app.setSub('measure', id) })), { height: 50, size: 19 });
    if (sub === 'setup') {
      ui.buttons([['bench', 'Bench'], ['giant', 'Giant']].map(([id, label]) => ({ id: `t-${id}`, label, active: r.target === id, onClick: () => app.setTarget(id) })), MID);
      ui.heading('Length', { size: 20 });
      if (r.target === 'giant') ui.buttons(GIANT_LENGTHS.map((L) => ({ id: `gl-${L}`, label: `${L.toFixed(1)} m`, active: r.giant.L === L, onClick: () => app.setLength(L) })), MID);
      else ui.buttons(LENGTHS.map((L) => ({ id: `l-${L}`, label: `${L.toFixed(1)}`, active: Math.abs(r.bench.L - L) < 1e-6, onClick: () => app.setLength(L) })), { cols: 4, ...MID });
      drawAngles(ui, app);
      ui.buttons([{ id: 'next', label: 'Next: Time It  ›', onClick: () => app.setSub('measure', 'time') }], MID);
    } else {
      drawRelease(ui, app);
      const w = r.watch;
      ui.heading('Stopwatch', { size: 20 });
      ui.buttons([
        { id: 'watch', label: w.running ? 'Stop' : 'Start', active: w.running, onClick: () => app.pressStartStop() },
        { id: 'count', label: `Count  (${w.n})`, disabled: !w.running, onClick: () => app.pressCount() },
      ], BIG);
      ui.text('Start as you let go · count each swing · stop after 10.', { size: 18, color: THEME.dim });
    }
    return;
  }

  if (s.mode === 'energy') {
    const sub = s.sub.energy;
    ui.tabs([['bob', '1  Bob & air'], ['run', '2  Swing it']].map(([id, label]) => ({ id: `sub-${id}`, label, active: sub === id, onClick: () => app.setSub('energy', id) })), { height: 50, size: 19 });
    if (sub === 'bob') {
      ui.heading('Bob', { size: 20 });
      ui.buttons(Object.entries(BOBS).map(([id, b]) => ({ id: `b-${id}`, label: b.name, active: r.bench.bob === id, onClick: () => app.setBob(id) })), { cols: 2, ...MID });
      ui.heading('Air', { size: 20 });
      ui.buttons(AIR.map(([id, label, f]) => ({ id: `a-${id}`, label, active: r.bench.air === f, onClick: () => app.setAir(f) })), { cols: 2, ...MID });
      ui.buttons([{ id: 'next', label: 'Next: Swing It  ›', onClick: () => app.setSub('energy', 'run') }], MID);
    } else {
      drawAngles(ui, app);
      drawRelease(ui, app);
    }
    return;
  }

  // real world: a tab per model
  ui.tabs(WORLD.map(([id, label]) => ({ id: `w-${id}`, label: label.replace(' & pirate ship', ''), active: s.world === id, onClick: () => app.setWorld(id) })), { height: 50, size: 18, cols: 2 });
  const w = app.world;
  if (s.world === 'clock') {
    ui.text('Shorten or lengthen the pendulum until the clock keeps time.', { size: 19, color: THEME.dim });
    ui.buttons([['-0.01', '− 1 cm'], ['0.01', '+ 1 cm']].map(([d, label]) => ({ id: `c${d}`, label, onClick: () => app.adjustClock(+d) })), BIG);
    ui.buttons([['-0.001', '− 1 mm'], ['0.001', '+ 1 mm']].map(([d, label]) => ({ id: `c${d}`, label, onClick: () => app.adjustClock(+d) })), BIG);
  } else if (s.world === 'swing') {
    ui.buttons([['swing', 'Swing'], ['ship', 'Pirate ship']].map(([id, label]) => ({ id: `ride-${id}`, label, active: w.ride === id, onClick: () => app.setRide(id) })), MID);
    ui.buttons([{ id: 'push', label: 'Push', onClick: () => app.pushSwing() }], { height: 90, size: 32 });
  } else if (s.world === 'metronome') {
    ui.heading('Beats per minute', { size: 20 });
    ui.buttons([40, 60, 80, 100, 120, 144, 176, 208].map((b) => ({ id: `bpm-${b}`, label: String(b), active: w.bpm === b, onClick: () => app.setBpm(b) })), { cols: 4, ...MID });
  } else {
    ui.buttons(Object.entries(PLANETS).map(([id, p]) => ({ id: `p-${id}`, label: p.name, active: s.planet === id, onClick: () => app.setPlanet(id) })), { cols: 2, ...MID });
    drawRelease(ui, app);
  }
}

function drawAngles(ui, app) {
  const r = app.rig;
  ui.heading('Release angle', { size: 20 });
  ui.buttons(ANGLES.map((d) => ({ id: `d-${d}`, label: `${d}°`, active: r.deg === d, onClick: () => app.setAngle(d) })), { cols: 4, ...MID });
}

function drawRelease(ui, app) {
  const r = app.rig;
  ui.buttons([{ id: 'release', label: r.active.running ? 'Swinging…' : 'Let Go', disabled: r.active.running, onClick: () => app.release() }, { id: 'stop', label: 'Stop', onClick: () => app.stopSwing() }], BIG);
}

/** The lesson's own part of the settings pop-up (after the level and class board). */
export function drawSettings(ui, app) {
  const s = app.state;
  if (s.mode === 'measure') {
    ui.heading('Light gate', { size: 22 });
    ui.buttons([{ id: 'gate', label: s.gateShown ? 'Reading Shown' : 'Reading Hidden', active: s.gateShown, onClick: () => app.toggleGate() }], { height: 56, size: 21 });
  }
}

/** "Ask the physicist" pop-up. */
export function drawAsk(ui, app) {
  const s = app.state;
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.physicistEndpoint) qs.push({ id: 'ai', label: 'Ask AI About This' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.phys.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 54, size: 18, gap: 8 });
  if (s.phys.answer) ui.box(s.phys.answer, { size: 21 });
}

/** Discussion prompts pop-up. */
export function drawDiscuss(ui) {
  for (const q of DISCUSS) ui.text(`• ${q}`, { size: 22 });
}

// ───────────────────────── Right: results only ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'predict') drawPredict(ui, app);
  else if (s.mode === 'measure') drawMeasure(ui, app);
  else if (s.mode === 'energy') drawEnergy(ui, app);
  else drawWorld(ui, app);
  ui.gap(8);
  const row = [{ id: 'ask', label: 'Ask the Physicist', active: app.popupOpen === 'Ask the physicist', onClick: () => app.openAsk() }];
  if (s.mode === 'world' || s.mode === 'energy') row.push({ id: 'discuss', label: 'Discuss', active: app.popupOpen === 'Discuss', onClick: () => app.openDiscuss() });
  ui.buttons(row, { height: 56, size: 20, gap: 10 });
}

function drawPredict(ui, app) {
  const ch = app.challenge();
  const mine = app.myVote(ch);
  ui.title(ch.title, { size: 28 });
  ui.text(ch.q, { size: 22 });
  ui.gap(4);
  if (!ch.revealed) {
    ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCD'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 54, size: 18, gap: 8 }));
    ui.text(mine == null ? 'Pick your answer.' : 'Saved: you can change it until it is revealed.', { size: 19, color: mine == null ? WARN : GOOD });
  } else {
    ch.options.forEach((o, i) => {
      const right = i === ch.answer;
      ui.text(`${right ? '✓' : mine === i ? '✗' : '  '}  ${'ABCD'[i]}   ${o}`, { size: 19, weight: right || mine === i ? 700 : 400, color: right ? GOOD : mine === i ? BAD : THEME.dim });
    });
    ui.gap(4);
    ui.box(ch.why, { size: 19 });
  }
  if (!ch.revealed && ch.id === 'p0') ui.text(`Think about: ${FACTORS.join(', ').toLowerCase()}.`, { size: 17, color: THEME.dim });
}

function drawMeasure(ui, app) {
  const s = app.state;
  const r = app.rig;
  const adv = s.level === 'advanced';
  const p = r.active;
  const w = r.watch;
  ui.text(`${r.target === 'giant' ? 'Giant' : 'Bench'} pendulum · ${p.L.toFixed(2)} m`, { size: 22, weight: 700, color: THEME.dim });
  // the one big number
  ui.text(w.running || w.t ? `${w.t.toFixed(2)} s  ·  ${w.n} swing${w.n === 1 ? '' : 's'}` : 'Stopwatch ready', { size: 40, weight: 800, color: w.running ? WARN : THEME.text });
  const gp = p.gatePeriod();
  if (s.gateShown) ui.text(`Light gate: ${gp ? `${gp.toFixed(3)} s per swing` : '…'}`, { size: 21, weight: 700, color: '#ff8080' });
  const runs = s.runs;
  if (!runs.length) {
    ui.text('Your results appear here.', { size: 19, color: THEME.dim });
    return;
  }
  const { ctx } = ui;
  ui.gap(6);
  const cols = adv ? [0, 80, 175, 275, 370] : [0, 90, 200, 320];
  ctx.font = font(18, 700);
  ctx.fillStyle = THEME.accent;
  ctx.textBaseline = 'top';
  (adv ? ['L (m)', 'T (s)', 'T² (s²)', 'Gate'] : ['L (m)', 'Swings', 'T (s)', 'Gate']).forEach((h, i) => ctx.fillText(h, ui.pad + cols[i], ui.y));
  ui.y += 28;
  for (const x of runs.slice(-5)) {
    const cells = adv ? [x.L.toFixed(2), x.T.toFixed(3), (x.T * x.T).toFixed(2), x.gate ? x.gate.toFixed(3) : '–'] : [x.L.toFixed(2), String(x.n), x.T.toFixed(3), x.gate ? x.gate.toFixed(3) : '–'];
    ctx.font = font(19, 600);
    cells.forEach((c, i) => {
      ctx.fillStyle = THEME.text;
      ctx.fillText(c, ui.pad + cols[i], ui.y + 4);
    });
    ui.y += 30;
  }
  drawGraph(ui, runs, adv);
  if (adv && runs.length >= 2) {
    const pts = runs.filter((x) => x.g === 9.81);
    const slope = pts.reduce((a, x) => a + x.T * x.T * x.L, 0) / pts.reduce((a, x) => a + x.L * x.L, 0);
    ui.text(`T² = ${slope.toFixed(2)} × L  →  g = 4π² ÷ ${slope.toFixed(2)} = ${((4 * Math.PI * Math.PI) / slope).toFixed(2)} m/s²`, { size: 18, weight: 700, color: GOOD });
  }
}

function drawEnergy(ui, app) {
  const s = app.state;
  const p = app.rig.bench;
  const b = BOBS[p.bob];
  ui.text(`${b.name} · ${(b.m * 1000).toFixed(b.m < 0.01 ? 1 : 0)} g · ${AIR.find(([, , f]) => f === p.air)[1].toLowerCase()}`, { size: 22, weight: 700, color: THEME.dim });
  if (p.running || p.peaks.length) {
    const v = p.L * p.w;
    ui.kv('Speed', `${Math.abs(v).toFixed(2)} m/s`, { size: 24 });
    ui.kv('Momentum', `${(p.m * Math.abs(v)).toFixed(3)} kg m/s`, { size: 24 });
    ui.kv('Period', `${p.gatePeriod()?.toFixed(3) ?? '…'} s`, { size: 24 });
  } else ui.text('Let it go to see its energy and momentum.', { size: 19, color: THEME.dim });
  if (s.energyRows.length) {
    ui.heading('Swings to halve', { size: 20 });
    for (const r of s.energyRows.slice(-5)) ui.kv(`${r.bob}, ${r.airName.toLowerCase()}`, r.swings >= 200 ? '200+' : String(r.swings), { size: 20 });
  }
}

function drawWorld(ui, app) {
  const s = app.state;
  const w = app.world;
  if (s.world === 'clock') {
    const err = w.clockError;
    ui.text('Pendulum clock', { size: 22, weight: 700, color: THEME.dim });
    ui.text(`${(w.clockPend.L * 100).toFixed(1)} cm`, { size: 44, weight: 800 });
    ui.text(Math.abs(err) < 5 ? 'Keeping perfect time' : `${err > 0 ? 'Gains' : 'Loses'} ${Math.abs(err) >= 120 ? `${(Math.abs(err) / 60).toFixed(1)} min` : `${Math.round(Math.abs(err))} s`} a day`, { size: 28, weight: 800, color: Math.abs(err) < 60 ? GOOD : WARN });
    ui.text(err < -5 ? 'Running slow: shorten it.' : err > 5 ? 'Running fast: lengthen it.' : '', { size: 19 });
    if (s.level === 'advanced') ui.text(`A 2 s period needs L = g ÷ π² = ${(SECONDS_L * 100).toFixed(2)} cm.`, { size: 17, color: THEME.dim });
  } else if (s.world === 'swing') {
    const p = w.swingPend;
    ui.text(w.ride === 'ship' ? 'Pirate ship' : 'Playground swing', { size: 22, weight: 700, color: THEME.dim });
    ui.text(`${w.maxDeg.toFixed(0)}° highest swing`, { size: 40, weight: 800, color: THEME.accent });
    ui.text(`${p.L} m long: ${periodSmall(p.L).toFixed(1)} s per swing, whoever is on it.`, { size: 19 });
    ui.text('Push as it starts moving away from you.', { size: 19, color: THEME.dim });
  } else if (s.world === 'metronome') {
    ui.text('Metronome', { size: 22, weight: 700, color: THEME.dim });
    ui.text(`${w.bpm} beats a minute`, { size: 40, weight: 800, color: THEME.accent });
    ui.text(`A tick every ${(60 / w.bpm).toFixed(2)} s. Weight higher up the arm = slower beat.`, { size: 19 });
  } else {
    const pl = PLANETS[s.planet];
    ui.text(`On ${pl.name} (g = ${pl.g} m/s²)`, { size: 22, weight: 700, color: THEME.dim });
    ui.text(`${periodSmall(app.rig.bench.L, pl.g).toFixed(2)} s per swing`, { size: 40, weight: 800, color: THEME.accent });
    ui.text(`${periodSmall(app.rig.bench.L).toFixed(2)} s on Earth, for the same ${app.rig.bench.L.toFixed(2)} m pendulum.`, { size: 19 });
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
