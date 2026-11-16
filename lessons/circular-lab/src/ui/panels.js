import { LEVELS, BALLS, LENGTHS, HANGING, QUESTIONS, DISCUSS, EXAMPLES, G } from '../data/circular.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['lab', 'Experiment'], ['world', 'Real world']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const k = app.kit;
  const adv = s.level === 'advanced';
  ui.title('Circular Motion', { size: 40 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${adv ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 21, gap: 8 });
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
  } else if (s.mode === 'lab') {
    ui.heading('Spin', { size: 22 });
    ui.buttons([
      { id: 'slower', label: 'Slower', onClick: () => app.spin('slower') },
      { id: 'faster', label: 'Faster', onClick: () => app.spin('faster') },
      { id: 'stop', label: 'Stop', onClick: () => app.spin('stop') },
    ], { height: 48, size: 20, gap: 8 });
    ui.buttons([{ id: 'steady', label: k.motor === 'steady' ? 'Holding the clip in place ✓' : 'Hold steady (keep the clip in place)', active: k.motor === 'steady', onClick: () => app.spin('steady') }], { height: 48, size: 19 });
    ui.heading('Ball', { size: 22 });
    ui.buttons(BALLS.map((g) => ({ id: `ball-${g}`, label: `${g} g`, active: k.m === g, onClick: () => app.chooseBall(g) })), { height: 44, size: 18, gap: 6 });
    ui.heading('String length (radius)', { size: 22 });
    ui.buttons(LENGTHS.map((L) => ({ id: `len-${L}`, label: `${L.toFixed(1)} m`, active: k.L === L, onClick: () => app.chooseLength(L) })), { height: 44, size: 18, gap: 6 });
    if (adv) {
      ui.heading('Hanging weight (the pull)', { size: 22 });
      ui.buttons(HANGING.map((M) => ({ id: `hang-${M}`, label: `${M} g`, active: k.M === M, onClick: () => app.chooseHanging(M) })), { height: 44, size: 18, gap: 6 });
    }
    ui.buttons([
      { id: 'gate', label: k.gate.on ? 'Light gate: on' : 'Light gate: off', active: k.gate.on, onClick: () => app.toggleGate() },
      { id: 'arrows', label: k.arrows ? 'Arrows: on' : 'Arrows: off', active: k.arrows, onClick: () => app.toggleArrows() },
    ], { height: 46, size: 19, gap: 8 });
  } else {
    ui.heading('Take the force away', { size: 22 });
    ui.buttons([{ id: 'cut', label: k.cut ? 'Tie on a new string' : 'Cut the string', active: !!k.cut, onClick: () => app.cutOrRetie() }], { height: 52, size: 21 });
    ui.buttons([
      { id: 'gravity', label: 'Switch off gravity', onClick: () => app.gravityOff() },
      { id: 'ice', label: 'Ice on the road', onClick: () => app.iceRoad() },
    ], { height: 50, size: 19, gap: 8 });
    ui.buttons([{ id: 'arrows', label: app.plenary.arrows ? 'Arrows: on' : 'Arrows: off', active: app.plenary.arrows, onClick: () => app.toggleArrows() }], { height: 46, size: 19 });
    if (!k.cut && Math.abs(k.omega) < 2) ui.text('Get the ball spinning first (Faster, or swirl it), then cut the string.', { size: 19, color: WARN });
  }

  if (!app.followsAdmin) {
    ui.heading('Level', { size: 22 });
    ui.buttons(LEVELS.map(([id, label]) => ({ id: `level-${id}`, label, active: s.level === id, onClick: () => app.setLevel(id) })), { height: 46, size: 20, gap: 8 });
  }
  if (app.controlsBoard) ui.buttons([{ id: 'board', label: s.big ? 'Class board: shown' : 'Class board: hidden', active: s.big, onClick: () => app.toggleBoard() }], { height: 46, size: 20 });
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

// ───────────────────────── Right ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'predict') drawPredict(ui, app);
  else if (s.mode === 'lab') drawLab(ui, app);
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
    ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCD'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 54, size: 18, gap: 8 }));
    ui.text(mine == null ? 'Pick your answer.' : 'Saved. You can change it until the answer is revealed.', { size: 20, color: mine == null ? WARN : GOOD });
  } else {
    ch.options.forEach((o, i) => {
      const right = i === ch.answer;
      ui.text(`${right ? '✓' : mine === i ? '✗' : '  '}  ${'ABCD'[i]}   ${o}${mine === i ? '   (you)' : ''}`, { size: 19, weight: right || mine === i ? 700 : 400, color: right ? GOOD : mine === i ? BAD : THEME.dim });
    });
    ui.gap(6);
    ui.box(ch.why, { size: 20 });
  }
}

function drawLab(ui, app) {
  const k = app.kit;
  const s = app.state;
  const adv = s.level === 'advanced';
  const spinning = Math.abs(k.omega) > 1;
  const z = k.zone;
  ui.title('Measure it', { size: 30 });
  ui.text(!spinning ? 'Get it spinning: swirl the tube (or drag round in circles), or press Faster.' : z === 'steady' ? '● Clip in place: steady. Time it now.' : z === 'fast' ? '● Too fast: the clip is pulled up against the tube.' : '● Too slow: the clip has dropped away from the tube.', { size: 20, weight: 700, color: !spinning ? THEME.dim : z === 'steady' ? GOOD : z === 'fast' ? WARN : '#7cc4ff' });
  ui.text(`${k.m} g ball · ${k.L.toFixed(1)} m string · pull ${k.F.toFixed(2)} N (${k.M} g hanging)`, { size: 18, color: THEME.dim });
  ui.buttons([
    { id: 'watch', label: k.watch.running ? 'Stop the stopwatch' : 'Start the stopwatch', active: k.watch.running, onClick: () => app.pressStartStop() },
    { id: 'count', label: `Count a turn (${k.watch.n})`, disabled: !k.watch.running, onClick: () => app.pressCount() },
  ], { height: 54, size: 19, gap: 8 });
  ui.text(`Stopwatch ${k.watch.t.toFixed(2)} s · tap “Count a turn” each time the ball passes you. Time at least 10 turns.`, { size: 17, color: THEME.dim });
  drawTable(ui, app, adv);
}

function drawTable(ui, app, adv) {
  const runs = app.state.runs;
  if (!runs.length) {
    ui.text('Your results appear here.', { size: 19, color: THEME.dim });
    return;
  }
  const { ctx } = ui;
  ui.gap(4);
  const heads = adv ? ['Ball', 'r (m)', 'Pull', 'turns/s', 'gate', 'mω²r', 'Mg'] : ['Ball', 'r (m)', 'Turns', 'Time', 'turns/s', 'Gate'];
  const cols = adv ? [0, 64, 122, 182, 256, 322, 390] : [0, 70, 136, 200, 270, 350];
  ctx.font = font(16, 700);
  ctx.fillStyle = THEME.accent;
  ctx.textBaseline = 'top';
  heads.forEach((h, i) => ctx.fillText(h, ui.pad + cols[i], ui.y));
  ui.y += 24;
  for (const r of runs.slice(-8)) {
    const fUse = r.gate ?? r.f;
    const cells = adv
      ? [`${r.m} g`, r.L.toFixed(1), `${((r.M / 1000) * G).toFixed(2)} N`, r.f.toFixed(2), r.gate ? r.gate.toFixed(2) : '–', `${((r.m / 1000) * (2 * Math.PI * fUse) ** 2 * r.L).toFixed(2)} N`, `${((r.M / 1000) * G).toFixed(2)} N`]
      : [`${r.m} g`, r.L.toFixed(1), String(r.n), `${r.t.toFixed(1)} s`, r.f.toFixed(2), r.gate ? r.gate.toFixed(2) : '–'];
    ctx.font = font(17, 600);
    cells.forEach((cell, i) => {
      ctx.fillStyle = r.steady < 0.7 && (cells.length - i <= 3) ? WARN : THEME.text;
      ctx.fillText(cell, ui.pad + cols[i], ui.y + 4);
    });
    ui.y += 28;
  }
  if (runs.some((r) => r.steady < 0.7)) ui.text('Yellow: the clip wasn’t in place for much of that timing, so the radius wasn’t what you set.', { size: 16, color: WARN });
  if (adv) ui.text('If F = mω²r, the last two columns should match: the hanging weight’s pull is the centripetal force. (ω = 2π × turns per second.)', { size: 16, color: THEME.dim });
}

function drawWorld(ui, app) {
  ui.title('In the real world', { size: 30 });
  for (const e of EXAMPLES) {
    ui.text(`${e.name}: ${e.force.toLowerCase()}`, { size: 20, weight: 700, color: app.state.done.includes(e.id) ? GOOD : THEME.text });
    ui.text(e.what, { size: 17, color: THEME.dim });
  }
  ui.heading('Discuss', { size: 22 });
  for (const q of DISCUSS) ui.text(`• ${q}`, { size: 18 });
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
