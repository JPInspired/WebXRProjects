import { STATIONS, HEIGHTS, DROP_OBJECTS, LENGTHS, BOBS, SPRINGS, SPRING_MASSES, ANGLES, TERMS, CHECKS, INSIGHTS, DISCUSS, QUESTIONS, G } from '../data/kinematics.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['lab', 'Experiment'], ['share', 'Share findings']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const PI2 = 4 * Math.PI * Math.PI;

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const b = app.bench;
  const adv = s.level === 'advanced';
  ui.header('Kinematics Lab', [app.settingsIcon()]);
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${adv ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.tabs(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 19, gap: 8 });
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
    ui.heading('Station', { size: 22 });
    ui.buttons(STATIONS.map(([id, label]) => ({ id: `st-${id}`, label, active: b.station === id, onClick: () => app.setStation(id) })), { cols: 2, height: 46, size: 19, gap: 8 });
    const st = b.s[b.station];
    if (b.station === 'drop') {
      ui.heading('Balcony height', { size: 20 });
      ui.buttons(HEIGHTS.map((h) => ({ id: `h-${h}`, label: `${h} m`, active: st.h === h, onClick: () => app.setting('h', h) })), { height: 44, size: 19, gap: 6 });
      ui.heading('Drop', { size: 20 });
      const objs = Object.entries(DROP_OBJECTS).filter(([, o]) => adv || !o.advanced);
      ui.buttons(objs.map(([id, o]) => ({ id: `o-${id}`, label: o.name, active: st.obj === id, onClick: () => app.setting('obj', id) })), { cols: 2, height: 42, size: 17, gap: 6 });
      ui.buttons([{ id: 'go', label: st.running ? 'Falling…' : 'Drop it', disabled: st.running, onClick: () => app.run() }, { id: 'life', label: s.life ? 'Life-size: on' : 'Watch it life-size', active: s.life, onClick: () => app.toggleLife() }], { height: 50, size: 19, gap: 8 });
    } else if (b.station === 'pendulum') {
      ui.heading('Length', { size: 20 });
      ui.buttons(LENGTHS.map((L) => ({ id: `L-${L}`, label: `${L.toFixed(1)} m`, active: st.L === L, onClick: () => app.setting('L', L) })), { height: 42, size: 17, gap: 5 });
      ui.heading('Bob', { size: 20 });
      ui.buttons(BOBS.map((m) => ({ id: `m-${m}`, label: `${m} g`, active: st.m === m, onClick: () => app.setting('m', m) })), { height: 42, size: 17, gap: 6 });
      ui.heading('Release angle', { size: 20 });
      ui.buttons([5, 10, 20, 30, 45, 60].map((d) => ({ id: `d-${d}`, label: `${d}°`, active: st.deg === d, onClick: () => app.setting('deg', d) })), { height: 42, size: 17, gap: 5 });
      ui.buttons([{ id: 'go', label: st.running ? 'Swinging…' : 'Release', disabled: st.running, onClick: () => app.run() }, { id: 'stop', label: 'Stop', onClick: () => app.stopRun() }], { height: 50, size: 19, gap: 8 });
    } else if (b.station === 'spring') {
      ui.heading('Spring', { size: 20 });
      ui.buttons(Object.entries(SPRINGS).map(([id, sp]) => ({ id: `sp-${id}`, label: sp.mystery ? 'Mystery' : `${sp.name.split(' ')[0]} (${sp.k} N/m)`, active: st.id === id, onClick: () => app.setting('id', id) })), { cols: 2, height: 42, size: 16, gap: 6 });
      ui.heading('Mass', { size: 20 });
      ui.buttons(SPRING_MASSES.map((m) => ({ id: `sm-${m}`, label: `${m} g`, active: st.m === m, onClick: () => app.setting('m', m) })), { height: 42, size: 17, gap: 5 });
      ui.buttons([{ id: 'go', label: st.running ? 'Bouncing…' : 'Pull down 4 cm, let go', disabled: st.running, onClick: () => app.run() }, { id: 'stop', label: 'Stop', onClick: () => app.stopRun() }], { height: 50, size: 18, gap: 8 });
    } else {
      ui.heading('Ramp angle', { size: 20 });
      ui.buttons(ANGLES.map((d) => ({ id: `a-${d}`, label: `${d}°`, active: st.deg === d, onClick: () => app.setting('deg', d) })), { height: 42, size: 17, gap: 5 });
      ui.buttons([{ id: 'go', label: st.running ? 'Rolling…' : 'Let it roll', disabled: st.running, onClick: () => app.run() }], { height: 50, size: 20 });
    }
    ui.heading('Chart shows', { size: 20 });
    ui.buttons([['s', 'Displacement'], ['v', 'Velocity'], ['a', 'Acceleration']].map(([id, label]) => ({ id: `q-${id}`, label, active: s.qty === id, onClick: () => app.setQty(id) })), { height: 44, size: 17, gap: 6 });
  } else {
    ui.text('In your group: which variable changed the motion, and which didn’t? Pick your key insight on the right; the class board counts them.', { size: 20, color: THEME.dim });
  }

}

// ───────────────────────── Right ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'predict') drawPredict(ui, app);
  else if (s.mode === 'lab') drawSheet(ui, app);
  else drawShare(ui, app);
  ui.gap(8);
  ui.buttons([app.askButton('Ask the physicist', (ui) => {
    const qs = [...QUESTIONS];
    if (window.WEBXR_CLASSES_CONFIG?.physicistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
    ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.phys.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 16, gap: 8 });
    if (s.phys.answer) ui.box(s.phys.answer, { size: 20 });
  })], { height: 56, size: 20 });
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
  ui.heading('Key terms', { size: 22 });
  for (const [t, d] of TERMS) ui.text(`${t}: ${d}`, { size: 18 });
}

const f2 = (x) => x.toFixed(2);

/** The calculation for a datasheet row, as lines of text. */
export function workings(r, adv) {
  if (r.station === 'drop') {
    const g = (2 * r.h) / (r.t * r.t);
    return [`h = ½ g t², so g = 2h ÷ t²`, `g = 2 × ${r.h} ÷ ${f2(r.t)}² = ${f2(g)} m/s²`, Math.abs(g - G) < 0.4 ? 'Close to 9.81 m/s²: almost no air resistance.' : 'Well below 9.81 m/s²: air resistance slowed it down.'];
  }
  if (r.station === 'pendulum') {
    const T = r.t10 / 10;
    const lines = [`Period T = time for 10 swings ÷ 10 = ${f2(r.t10)} ÷ 10 = ${T.toFixed(3)} s`];
    if (adv) lines.push(`T = 2π√(L/g), so g = 4π²L ÷ T² = 4π² × ${r.L} ÷ ${T.toFixed(3)}² = ${f2((PI2 * r.L) / (T * T))} m/s²`);
    else lines.push(`Compare: the formula T = 2π√(L/g) gives ${(2 * Math.PI * Math.sqrt(r.L / G)).toFixed(3)} s for ${r.L} m.`);
    return lines;
  }
  if (r.station === 'spring') {
    const T = r.t10 / 10;
    const m = r.m / 1000;
    const k1 = (m * G) / r.stretch;
    const lines = [`From the stretch: weight = mg = ${m} × 9.81 = ${f2(m * G)} N; k = force ÷ stretch = ${f2(m * G)} ÷ ${r.stretch.toFixed(3)} m = ${k1.toFixed(1)} N/m`, `Period T = ${f2(r.t10)} ÷ 10 = ${T.toFixed(3)} s`];
    if (adv) lines.push(`T = 2π√(m/k), so k = 4π²m ÷ T² = ${((PI2 * m) / (T * T)).toFixed(1)} N/m`);
    return lines;
  }
  const a = (2 * r.d) / (r.t * r.t);
  const lines = [`d = ½ a t², so a = 2d ÷ t² = 2 × ${r.d} ÷ ${f2(r.t)}² = ${f2(a)} m/s²`];
  if (adv) lines.push(`g sin θ = 9.81 × sin ${r.deg}° = ${f2(G * Math.sin((r.deg * Math.PI) / 180))} m/s²; a rolling ball gets 5/7 of that (the rest goes into spinning).`);
  return lines;
}

function rowText(r) {
  if (r.station === 'drop') return `${DROP_OBJECTS[r.obj].name}, ${r.h} m: ${f2(r.t)} s`;
  if (r.station === 'pendulum') return `L ${r.L} m, ${r.m} g, ${r.deg}°: 10 swings ${f2(r.t10)} s`;
  if (r.station === 'spring') return `${SPRINGS[r.id].mystery ? 'Mystery' : SPRINGS[r.id].name}, ${r.m} g: stretch ${(r.stretch * 100).toFixed(1)} cm, 10 bounces ${f2(r.t10)} s`;
  return `${r.deg}° ramp, ${r.d} m: ${f2(r.t)} s`;
}

function drawSheet(ui, app) {
  const s = app.state;
  const b = app.bench;
  const adv = s.level === 'advanced';
  const st = b.s[b.station];
  ui.title(`Datasheet: ${STATIONS.find(([id]) => id === b.station)[1].toLowerCase()}`, { size: 28 });
  // live status
  let status = '';
  if (b.station === 'drop') status = st.running ? `Falling: ${f2(st.t)} s, ${f2(Math.abs(st.v))} m/s` : 'Press “Drop it” (or tap the ball on the balcony). The timer starts and stops by itself.';
  else if (b.station === 'pendulum' || b.station === 'spring') status = st.running ? `${st.periods < 10 ? `Timing 10 ${b.station === 'spring' ? 'bounces' : 'swings'}: ${st.periods} done, ${f2(st.t)} s` : `10 done in ${f2(st.t10)} s`}` : b.station === 'spring' ? `At rest the ruler reads a stretch of ${(b.stretch() * 100).toFixed(1)} cm. Pull it down and let go: it times 10 bounces.` : 'Drag the bob out (or pick an angle) and release: it times 10 swings.';
  else status = st.running ? `Rolling: ${f2(st.t)} s` : 'Let it roll: the timer runs from the top to the bottom (0.7 m).';
  ui.text(status, { size: 19, weight: 700, color: st.running ? WARN : THEME.dim });

  const rows = s.rows.map((r, i) => ({ r, i })).filter(({ r }) => r.station === b.station).slice(-6);
  if (!rows.length) ui.text('Each run adds a row here.', { size: 18, color: THEME.dim });
  for (const { r, i } of rows) {
    ui.buttons([{ id: `row-${i}`, label: `${rowText(r)}   ${s.worked.includes(i) ? '▲' : '· Work it out'}`, active: s.worked.includes(i), onClick: () => app.toggleWorked(i) }], { height: 44, size: 15, gap: 4 });
    if (s.worked.includes(i)) for (const line of workings(r, adv)) ui.text(line, { size: 16, color: GOOD });
  }
  // the station's question
  const c = CHECKS[b.station];
  const a = s.checks[b.station];
  ui.heading('Question', { size: 20 });
  ui.text(c.q, { size: 18, weight: 700 });
  c.options.forEach((o, k) => {
    const right = a != null && k === c.answer;
    ui.buttons([{ id: `chk-${k}`, label: o, active: right, color: a === k && !right ? '#5a2f3a' : null, disabled: a != null && a !== k && !right, onClick: () => app.answerCheck(b.station, k) }], { height: 42, size: 16, gap: 5 });
  });
  if (a != null) ui.text(c.why, { size: 17, color: a === c.answer ? GOOD : WARN });
}

function drawShare(ui, app) {
  const s = app.state;
  ui.title('Your key insight', { size: 30 });
  for (const ins of INSIGHTS) ui.buttons([{ id: `ins-${ins.id}`, label: ins.text, active: s.insight === ins.id, onClick: () => app.chooseInsight(ins.id) }], { height: 52, size: 15, gap: 6 });
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
