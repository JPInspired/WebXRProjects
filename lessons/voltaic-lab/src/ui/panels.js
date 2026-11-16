import { LEVELS, METALS, METAL_IDS, ELECTROLYTES, ELECTROLYTE_IDS, QUESTIONS, DISCUSS, BATTERIES, idealV } from '../data/voltaic.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['lab', 'Experiment'], ['batteries', 'Real batteries']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const b = app.bench;
  const adv = s.level === 'advanced';
  ui.header('Voltaic Lab', [app.settingsIcon()]);
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${adv ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.tabs(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 20, gap: 8 });
  }

  if (s.mode === 'predict') {
    if (app.soloTeacher) {
      const ch = app.challenge();
      ui.text('Read the question out and let everyone pick, then reveal the answer.', { size: 21, color: THEME.dim });
      ui.buttons(app.predictions().map((p, i) => ({ id: `round-${i}`, label: `${i + 1}. ${p.name}`, active: s.round === i, onClick: () => app.setRound(i) })), { cols: 2, height: 50, size: 20, gap: 8 });
      ui.buttons([{ id: 'reveal', label: ch.revealed ? 'Hide the answer' : 'Reveal the answer', active: ch.revealed, onClick: () => app.reveal() }], { height: 58, size: 24 });
      const t = app.tally(ch);
      ui.text(`${t.votes} answer${t.votes === 1 ? '' : 's'} in so far.`, { size: 22, weight: 700 });
    } else ui.text('Read the question on the class board and pick your answer on the right. Your teacher will reveal it.', { size: 22, color: THEME.dim });
  } else if (s.mode === 'lab') {
    const c = b.cell;
    ui.heading(adv ? 'Cells (two beakers each)' : 'Cells', { size: 22 });
    ui.buttons(b.cells.map((x) => ({ id: `cell-${x.i}`, label: `Cell ${x.i + 1}`, active: !b.series && b.selected === x.i, onClick: () => app.selectCell(x.i) })), { height: 44, size: 18, gap: 6 });
    ui.buttons([{ id: 'series', label: b.series ? 'Linked in series ✓' : 'Link the cells in series', active: b.series, onClick: () => app.toggleSeries() }], { height: 44, size: 18 });
    ui.heading(`Cell ${c.i + 1}: ${adv ? 'left beaker (black lead)' : 'left strip (black lead)'}`, { size: 19 });
    ui.buttons(METAL_IDS.map((id) => ({ id: `l-${id}`, label: METALS[id].sym, active: c.left === id, onClick: () => app.quickStrip('left', id) })), { height: 40, size: 18, gap: 5 });
    ui.heading(adv ? 'Right beaker (red lead)' : 'Right strip (red lead)', { size: 19 });
    ui.buttons(METAL_IDS.map((id) => ({ id: `r-${id}`, label: METALS[id].sym, active: c.right === id, onClick: () => app.quickStrip('right', id) })), { height: 40, size: 18, gap: 5 });
    if (adv) {
      ui.buttons([{ id: 'bridge', label: c.bridge ? 'Salt bridge in ✓ (take it out)' : 'Put the salt bridge in', active: c.bridge, onClick: () => app.quickBridge() }], { height: 44, size: 18 });
    } else {
      ui.heading('Electrolyte', { size: 19 });
      ui.buttons(ELECTROLYTE_IDS.map((id) => ({ id: `e-${id}`, label: ELECTROLYTES[id].short, active: c.electrolyte === id, onClick: () => app.quickElectrolyte(id) })), { cols: 3, height: 40, size: 15, gap: 5 });
    }
    ui.buttons([{ id: 'empty', label: 'Empty this cell', onClick: () => app.emptyCell() }], { height: 40, size: 17 });
    ui.heading('Extras', { size: 19 });
    ui.buttons([
      { id: 'particles', label: s.particles ? 'Particles: shown' : 'Zoom into the particles', active: s.particles, onClick: () => app.toggleParticles() },
      { id: 'rundown', label: s.run ? 'Running…' : 'Run it down (24 h)', active: !!s.run, disabled: !!s.run, onClick: () => app.runDown() },
    ], { height: 46, size: 17, gap: 6 });
    if (adv) ui.buttons([{ id: 'mode-meter', label: b.mode === 'V' ? 'Meter: volts (switch to mA)' : 'Meter: milliamps (switch to V)', onClick: () => app.toggleMeterMode() }], { height: 42, size: 17 });
  } else {
    ui.text('Tap each battery on the bench to read about it. How is each one like the cells you built?', { size: 21, color: THEME.dim });
  }

}

// ───────────────────────── Right ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'predict') drawPredict(ui, app);
  else if (s.mode === 'lab') drawLab(ui, app);
  else drawBatteries(ui, app);
  ui.gap(8);
  ui.buttons([app.askButton('Ask the chemist', (ui) => {
    const qs = [...QUESTIONS];
    if (window.WEBXR_CLASSES_CONFIG?.chemistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
    ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.chem.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 16, gap: 8 });
    if (s.chem.answer) ui.box(s.chem.answer, { size: 20 });
  })], { height: 56, size: 20 });
}

function drawPredict(ui, app) {
  const ch = app.challenge();
  const mine = app.myVote(ch);
  ui.title(ch.title, { size: 30 });
  ui.text(ch.q, { size: 22 });
  ui.gap(4);
  if (!ch.revealed) {
    ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCD'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 54, size: 17, gap: 8 }));
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
  const b = app.bench;
  const s = app.state;
  const adv = s.level === 'advanced';
  const r = b.reading();
  ui.title(b.series ? `In series: ${b.chain().length} cells` : `Cell ${b.cell.i + 1}`, { size: 28 });
  ui.text(app.chainLabel(), { size: 18, color: THEME.dim });
  if (r.ok) {
    ui.text(b.mode === 'V' ? `${r.V.toFixed(2)} V` : `${(r.I * 1000).toFixed(r.I * 1000 < 10 ? 2 : 1)} mA`, { size: 60, weight: 800, color: r.V < 0 ? BAD : THEME.accent });
    if (r.V < -0.02) ui.text('A minus sign: the black lead is on the positive strip. The more reactive metal is the negative one.', { size: 18, color: WARN });
  } else ui.text(r.why, { size: 20, weight: 700, color: WARN });
  ui.buttons([{ id: 'record', label: 'Record this reading', disabled: !r.ok, onClick: () => app.record() }], { height: 52, size: 21 });

  if (s.curve?.length > 1) drawCurve(ui, s.curve);

  if (adv) {
    ui.heading('Standard electrode potentials, E°', { size: 20 });
    for (const id of [...METAL_IDS].sort((a, b2) => METALS[a].E - METALS[b2].E)) ui.text(`${METALS[id].ion} / ${METALS[id].sym}:  ${METALS[id].E > 0 ? '+' : ''}${METALS[id].E.toFixed(2)} V`, { size: 17, color: THEME.dim });
    const c = b.cell;
    if (c.left && c.right && !b.series) ui.text(`Predicted E°cell = E°(right) − E°(left) = ${idealV(c.left, c.right).toFixed(2)} V`, { size: 18, weight: 700, color: GOOD });
  } else {
    ui.heading('Reactivity series', { size: 20 });
    ui.text([...METAL_IDS].sort((a, b2) => METALS[a].E - METALS[b2].E).map((id) => METALS[id].name).join(' › '), { size: 17, color: THEME.dim });
    ui.text('Most reactive first. The further apart two metals are, the bigger the voltage.', { size: 16, color: THEME.dim });
  }
  drawTable(ui, app);
}

function drawCurve(ui, curve) {
  const { ctx } = ui;
  ui.heading('Running down', { size: 20 });
  const x = ui.pad + 40;
  const y = ui.y + 4;
  const w = ui.contentWidth - 50;
  const h = 120;
  const vMax = Math.max(0.2, ...curve.map((p) => Math.abs(p[1])));
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  curve.forEach(([t, v], i) => {
    const px = x + (t / 24) * w;
    const py = y + h - (Math.abs(v) / vMax) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.font = font(15);
  ctx.fillStyle = THEME.dim;
  ctx.textBaseline = 'top';
  ctx.fillText(`${vMax.toFixed(2)} V`, ui.pad - 6, y);
  ctx.fillText('0', ui.pad + 20, y + h - 14);
  ctx.fillText('hours →  24', x + w - 90, y + h + 4);
  ui.y = y + h + 26;
}

function drawTable(ui, app) {
  const runs = app.state.runs;
  ui.heading('Your results', { size: 20 });
  if (!runs.length) {
    ui.text('Press “Record this reading” to add a row.', { size: 17, color: THEME.dim });
    return;
  }
  const { ctx } = ui;
  for (const r of runs.slice(-8)) {
    ctx.font = font(16, 600);
    ui.text(`${r.label}  →  ${r.V.toFixed(2)} V${r.I != null ? `, ${(r.I * 1000).toFixed(1)} mA` : ''}`, { size: 16, color: r.V < 0 ? BAD : THEME.text });
  }
}

function drawBatteries(ui, app) {
  const s = app.state;
  ui.title('Real batteries', { size: 30 });
  const b = BATTERIES.find((x) => x.id === s.battery);
  if (b) {
    ui.text(`${b.name}: ${b.volts}`, { size: 21, weight: 700 });
    ui.text(`Negative: ${b.neg}. Positive: ${b.pos}. Electrolyte: ${b.electrolyte}. Rechargeable: ${b.recharge}.`, { size: 18, color: THEME.dim });
    ui.box(b.note, { size: 19 });
  } else ui.text('Tap a battery on the bench.', { size: 20, color: THEME.dim });
  ui.heading('Discuss', { size: 22 });
  for (const q of DISCUSS) ui.text(`• ${q}`, { size: 18 });
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text(e.kicker ?? 'CHEMIST EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 26;
  ctx.font = font(size);
  while (size > 17 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 16) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
