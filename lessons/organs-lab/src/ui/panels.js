import { CARDS, SYSTEMS, QUIZ, QUESTIONS, DISCUSS, NOTES_TASK, MISSING_IDS } from '../data/organs.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['notes', 'Sticky notes'], ['build', 'Build the body'], ['functions', 'Functions'], ['systems', 'Body systems'], ['quiz', 'Quiz']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const b = app.body;
  ui.header('Identifying Organs', [app.settingsIcon()]);
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.tabs(MODES.slice(0, 3).map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 50, size: 18, gap: 8 });
    ui.buttons(MODES.slice(3).map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 50, size: 18, gap: 8 });
  }

  if (!b) {
    ui.text('Loading the skeleton…', { size: 22, color: WARN });
  } else if (s.mode === 'notes') {
    ui.text('Pick an organ and what it does on the right, then stick the pair on the class board.', { size: 20, color: THEME.dim });
  } else if (s.mode === 'build') {
    ui.heading('Skeleton', { size: 22 });
    ui.buttons([['solid', 'Ribs solid'], ['clear', 'See-through'], ['hidden', 'Ribs hidden']].map(([id, label]) => ({ id: `ribs-${id}`, label, active: b.ribs === id, onClick: () => app.setRibs(id) })), { height: 46, size: 17, gap: 6 });
    ui.buttons([{ id: 'cap', label: b.capOpen ? 'Close the Skull Cap' : 'Open the Skull Cap', onClick: () => app.toggleCap() }], { height: 46, size: 19 });
    if (s.level === 'advanced') {
      const placed = b.active.filter((p) => p.where === 'body' && !p.ok).length;
      ui.buttons([{ id: 'check', label: placed ? `Check my body (${placed} to mark)` : 'Check my body', disabled: !placed, onClick: () => app.checkBody() }], { height: 58, size: 22 });
    }
    ui.buttons([{ id: 'restart', label: 'Start Again', onClick: () => app.restart() }], { height: 46, size: 19 });
  } else if (s.mode === 'functions') {
    ui.text('Drag each card onto the dashed spot whose line points to the organ that does that job. Right: it sticks. Wrong: it goes back.', { size: 20, color: THEME.dim });
    ui.buttons([{ id: 'cards-reset', label: 'Take All the Cards Back', onClick: () => app.resetCards() }], { height: 46, size: 19 });
  } else if (s.mode === 'systems') {
    if (app.controlsSystem) {
      ui.heading('Show a system', { size: 22 });
      ui.buttons([{ id: 'sys-all', label: 'All of Them', active: !s.system, onClick: () => app.setSystem(null) }], { height: 46, size: 19 });
      ui.buttons(SYSTEMS.map((x) => ({ id: `sys-${x.id}`, label: x.name.replace(' (excretory)', '').replace(' system', ''), active: s.system === x.id, onClick: () => app.setSystem(x.id) })), { cols: 2, height: 46, size: 18, gap: 8 });
      // take an organ out and watch what fails (the info panel tells the story)
      ui.heading('What if it was missing?', { size: 22 });
      ui.buttons(MISSING_IDS.map(([id, label]) => ({ id: `miss-${id}`, label, active: s.missing === id, onClick: () => app.setMissing(id) })), { cols: 2, height: 46, size: 18, gap: 8 });
      if (s.missing) ui.buttons([{ id: 'miss-back', label: 'Put It Back', onClick: () => app.setMissing(null) }], { height: 46, size: 19 });
    } else ui.text('Your teacher picks the system, or takes an organ out to show what would happen. Watch your skeleton.', { size: 20, color: THEME.dim });
  } else if (s.mode === 'quiz') {
    const done = s.quiz.filter((a) => a != null).length;
    ui.text(`${done} of ${QUIZ.length} answered`, { size: 24, weight: 700 });
    ui.buttons([{ id: 'quiz-restart', label: 'Start the Quiz Again', disabled: !done, onClick: () => app.quizRestart() }], { height: 46, size: 19 });
  }

  if (app.soloTeacher) drawTeacher(ui, app);
}

/** The teacher's own controls: in the Teacher menu in a session, or here when on your own. */
export function drawTeacher(ui, app) {
  const s = app.state;
  if (s.mode !== 'quiz' && s.mode !== 'notes') return;
  ui.heading(s.mode === 'quiz' ? 'Quiz' : 'Sticky notes', { size: 22 });
  ui.buttons([{ id: 'reveal', label: s.revealed ? 'Hide the answers' : s.mode === 'quiz' ? 'Show the class results' : 'Mark the sticky notes', active: s.revealed, onClick: () => app.reveal() }], { height: 52, size: 20 });
}

// ───────────────────────── Right ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'notes') drawNotes(ui, app);
  else if (s.mode === 'build') drawBuild(ui, app);
  else if (s.mode === 'functions') drawFunctions(ui, app);
  else if (s.mode === 'systems') drawSystems(ui, app);
  else drawQuiz(ui, app);
  ui.gap(8);
  ui.buttons([app.askButton('Ask the doctor', (ui) => {
    const qs = [...QUESTIONS];
    if (window.WEBXR_CLASSES_CONFIG?.doctorEndpoint) qs.push({ id: 'ai', label: 'Ask AI About This' });
    ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.doc.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 16, gap: 8 });
    if (s.doc.answer) ui.box(s.doc.answer, { size: 20 });
  })], { height: 56, size: 20 });
}

function drawNotes(ui, app) {
  const n = app.state.note;
  ui.title('Sticky Notes', { size: 30 });
  ui.text(NOTES_TASK, { size: 20, color: THEME.dim });
  ui.heading('Note 1: the organ', { size: 22 });
  ui.buttons(CARDS.slice(0, 9).map((c) => ({ id: `no-${c.id}`, label: c.name, active: n.organ === c.id, onClick: () => app.noteOrgan(c.id) })), { cols: 3, height: 44, size: 16, gap: 6 });
  ui.heading('Note 2: what it does', { size: 22 });
  for (const c of app.noteFunctions()) ui.buttons([{ id: `nf-${c.id}`, label: c.text, active: n.fn === c.id, onClick: () => app.noteFunction(c.id) }], { height: 40, size: 15, gap: 5 });
  ui.buttons([{ id: 'stick', label: n.stuck ? 'Stuck on the Board ✓ (Stick a New Pair)' : 'Stick Them on the Board', disabled: !n.organ || !n.fn, active: !!n.stuck, onClick: () => app.stickNote() }], { height: 50, size: 19 });
}

function drawBuild(ui, app) {
  const b = app.body;
  const adv = app.state.level === 'advanced';
  const list = b.active;
  ui.title(`In place: ${b.placed} of ${list.length}`, { size: 30 });
  ui.text(`Mistakes: ${b.wrong}${adv ? '' : `   ·   Hints: ${b.hints}`}`, { size: 20, color: b.wrong ? WARN : THEME.dim });
  if (adv) ui.text('No names on the desk at this level: work out each organ from its shape. Organs stay where you put them until you press “Check my body”.', { size: 18, color: THEME.dim });
  ui.gap(4);
  const { ctx } = ui;
  for (const p of list) {
    const known = !adv || p.ok;
    const name = known ? p.o.name : '?';
    const status = p.ok ? '✓' : p.where === 'body' ? '…' : ' ';
    if (!adv && !p.ok) {
      ui.buttons([{ id: `hint-${p.id}`, label: `${name}   ·   hint`, active: b.hint === p.id, onClick: () => app.giveHint(p.id) }], { height: 38, size: 17, gap: 4 });
    } else {
      ctx.font = font(19, p.ok ? 700 : 400);
      ui.text(`${status}  ${name}`, { size: 19, weight: p.ok ? 700 : 400, color: p.ok ? GOOD : THEME.dim });
    }
  }
  if (!adv && b.hint) {
    const p = b.piece(b.hint);
    ui.box(`${p.o.name}: ${p.o.where}`, { size: 19 });
  }
  if (b.placed === list.length) ui.text('Every organ is in place. Next: the function cards.', { size: 21, weight: 700, color: GOOD });
}

function drawFunctions(ui, app) {
  const b = app.body;
  const list = b.activeCards;
  ui.title(`Cards matched: ${b.matched} of ${list.length}`, { size: 30 });
  ui.text(`Wrong tries: ${b.cardWrong}`, { size: 20, color: b.cardWrong ? WARN : THEME.dim });
  for (const k of list) ui.text(`${k.matched ? '✓' : '·'}  ${k.matched ? `${k.c.name}: ` : ''}${k.c.text}`, { size: 18, weight: k.matched ? 700 : 400, color: k.matched ? GOOD : THEME.dim });
  if (b.matched === list.length) ui.text('All matched: your skeleton is now a labelled diagram.', { size: 21, weight: 700, color: GOOD });
}

function drawSystems(ui, app) {
  const miss = app.missingNow();
  if (miss) {
    // what if it was missing: each step as it happens, then the verdict
    const { def, t } = miss;
    ui.title(`What If There Was No ${def.name.replace('the ', '').replace(/^./, (c) => c.toUpperCase())}?`, { size: 28 });
    ui.text(`Take out ${def.name} and watch your skeleton: the organs that depend on it fail, one after another.`, { size: 19, color: THEME.dim });
    for (const [at, , when, text] of def.steps) if (t >= at) ui.box(`${when}: ${text}`, { size: 19 });
    if (t >= def.steps[def.steps.length - 1][0] + 1.6) ui.text(def.verdict, { size: 20, weight: 700, color: '#ffd166' });
    return;
  }
  const sys = SYSTEMS.find((x) => x.id === app.demo.sys);
  if (sys) {
    ui.title(sys.name, { size: 30 });
    ui.text(sys.job, { size: 20 });
    ui.box(sys.needs, { size: 19 });
  } else {
    ui.title('Body Systems', { size: 30 });
    ui.text('Organs work in teams called organ systems, and the systems depend on each other. Pick one to light up its organs.', { size: 20 });
  }
  ui.heading('Discuss', { size: 22 });
  for (const q of DISCUSS) ui.text(`• ${q}`, { size: 18 });
}

function drawQuiz(ui, app) {
  const s = app.state;
  const i = s.quizAt;
  const done = s.quiz.filter((a) => a != null).length;
  if (i >= QUIZ.length) {
    const score = app.quizScore();
    ui.title(`Score: ${score} / ${QUIZ.length}`, { size: 34 });
    ui.text(score === QUIZ.length ? 'Full marks' : score >= 7 ? 'Well done.' : 'Have another look at the organs you missed.', { size: 21, color: score >= 7 ? GOOD : WARN });
    QUIZ.forEach((q, k) => ui.text(`${s.quiz[k] === q.answer ? '✓' : '✗'} ${k + 1}. ${q.options[q.answer]}`, { size: 17, color: s.quiz[k] === q.answer ? GOOD : BAD }));
    return;
  }
  const q = QUIZ[i];
  const a = s.quiz[i];
  ui.title(`Question ${i + 1} of ${QUIZ.length}`, { size: 28 });
  ui.text(q.q, { size: 22, weight: 700 });
  ui.gap(4);
  q.options.forEach((o, k) => {
    const right = a != null && k === q.answer;
    ui.buttons([{ id: `qa-${k}`, label: `${'ABCD'[k]}   ${o}`, active: right, color: a === k && !right ? '#5a2f3a' : null, disabled: a != null && a !== k && !right, onClick: () => app.quizAnswer(k) }], { height: 52, size: 18, gap: 6 });
  });
  if (a != null) {
    ui.text(a === q.answer ? '✓ Right' : `✗ The answer is ${'ABCD'[q.answer]}: ${q.options[q.answer]}.`, { size: 20, color: a === q.answer ? GOOD : BAD });
    ui.buttons([{ id: 'quiz-next', label: i + 1 < QUIZ.length ? 'Next Question' : 'See My Score', onClick: () => app.quizNext() }], { height: 52, size: 21 });
  }
  ui.text(`${done} answered`, { size: 17, color: THEME.dim });
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text(e.kicker ?? 'THE DOCTOR EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 26;
  ctx.font = font(size);
  while (size > 17 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 16) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
