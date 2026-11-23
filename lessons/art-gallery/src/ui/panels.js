import { PAINTINGS, EVENTS, TIME } from '../data/paintings.js';
import { THEME, font, roundRect } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['gallery', 'Gallery'], ['guess', 'Guess the Painting']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const short = (t) => t.replace('A Sunday on ', '').replace(' off Kanagawa', '').replace('Girl with a ', '').replace('The Third of May 1808', 'The Third of May');

// ───────────────────────── Left: the gallery and the game ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.header('Art Gallery', [app.settingsIcon()]);
  if (app.teacherShow) {
    ui.text('Your teacher is showing everyone this painting.', { size: 22, weight: 700, color: THEME.accent });
    return;
  }
  ui.tabs(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 20, gap: 8 });
  if (s.mode === 'gallery') {
    const p = app.painting;
    ui.buttons([
      { id: 'prev', label: '‹ Previous', onClick: () => app.step(-1) },
      { id: 'next', label: 'Next ›', onClick: () => app.step(1) },
    ], { height: 52, size: 21, gap: 8 });
    const k = app.gallery.fitted(p).scale;
    if (k < 1) ui.buttons([{ id: 'true-size', label: app.state.trueSize ? 'True Size: Shown (Tap to Hide)' : `See It at True Size (${Math.round(p.w)} × ${Math.round(p.h)} cm)`, active: app.state.trueSize, onClick: () => app.toggleTrueSize() }], { height: 50, size: 19 });
    else ui.text(`Shown at its real size: ${p.w} × ${p.h} cm.`, { size: 19, color: THEME.dim });
    ui.heading('The paintings', { size: 22 });
    ui.buttons(PAINTINGS.map((x) => ({ id: `p-${x.id}`, label: short(x.title), active: x.id === p.id, onClick: () => app.choose(x.id) })), { cols: 2, height: 42, size: 17, gap: 6 });
    ui.text(`${app.presenting ? 'Pinch' : 'Click'} a glowing ring on the painting to look closer.`, { size: 19, color: THEME.dim });
  } else {
    const g = app.state.game;
    ui.text(`Score: ${g.score} of ${g.played}`, { size: 28, weight: 700 });
    ui.text('A tiny part of a painting slowly zooms out. Pick its name on the right as soon as you know it: the sooner, the more points.', { size: 20, color: THEME.dim });
    ui.buttons([{ id: 'game-next', label: g.answer == null && g.round ? 'Skip This One' : 'Next Painting', onClick: () => app.newRound() }], { height: 52, size: 21 });
  }
}

// ───────────────────────── Right: the painting's story and the timeline ─────────────────────────

export function drawInfo(ui, app) {
  if (app.state.mode === 'guess' && !app.teacherShow) return drawGuess(ui, app);
  const p = app.painting;
  ui.title(p.title, { size: 32 });
  ui.text(`${p.artist} · ${p.yearText}`, { size: 22, weight: 700, color: THEME.accent });
  ui.kv('Where it hangs', p.place.length > 34 ? 'several museums' : p.place, { size: 19 });
  ui.kv('Made with', p.medium, { size: 19 });
  ui.kv('Real size', `${p.w} × ${p.h} cm`, { size: 19 });
  ui.text(p.story, { size: 20 });
  ui.heading('On the timeline', { size: 22 });
  drawTimeline(ui, p);
}

/** The timeline: the twelve paintings above the line, world events below; the current painting highlighted. */
function drawTimeline(ui, p) {
  const { ctx } = ui;
  const x0 = ui.pad + 10, x1 = ui.right - 10;
  const y = ui.y + 70;
  const X = (yr) => x0 + ((yr - TIME[0]) / (TIME[1] - TIME[0])) * (x1 - x0);
  ctx.strokeStyle = 'rgba(200, 210, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.font = font(15, 600);
  ctx.fillStyle = THEME.dim;
  ctx.textAlign = 'center';
  for (const yr of [1500, 1600, 1700, 1800, 1900]) {
    ctx.fillRect(X(yr) - 1, y - 6, 2, 12);
    ctx.fillText(String(yr), X(yr), y + 10);
  }
  // the paintings: dots above the line
  for (const q of PAINTINGS) {
    const on = q.id === p.id;
    ctx.fillStyle = on ? '#ffd166' : 'rgba(154, 168, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(X(q.year), y - 14, on ? 9 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = font(18, 700);
  ctx.fillStyle = '#ffd166';
  const lx = Math.max(x0 + 80, Math.min(x1 - 80, X(p.year)));
  ctx.fillText(`${short(p.title)} · ${p.year}`, lx, y - 52);
  ctx.textAlign = 'left';
  ui.y = y + 34;
  // the world around it: the nearest events
  const near = [...EVENTS].sort((a, b) => Math.abs(a[0] - p.year) - Math.abs(b[0] - p.year)).slice(0, 3).sort((a, b) => a[0] - b[0]);
  for (const [yr, text] of near) {
    ctx.fillStyle = 'rgba(126, 226, 168, 0.85)';
    ctx.beginPath();
    ctx.arc(X(yr), y + 30, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ui.text('Around the same time:', { size: 18, color: THEME.dim });
  for (const [yr, text] of near) ui.text(`${yr}  ${text}`, { size: 19, color: GOOD });
  void roundRect;
}

function drawGuess(ui, app) {
  const g = app.state.game;
  ui.title('Guess the Painting', { size: 30 });
  if (!g.round) {
    ui.text('Press Next Painting on the left to start.', { size: 21, color: THEME.dim });
    return;
  }
  if (g.answer == null) {
    ui.text('What is it? Pick one:', { size: 21 });
    ui.buttons(g.options.map((id) => ({ id: `guess-${id}`, label: PAINTINGS.find((x) => x.id === id).title, onClick: () => app.guess(id) })), { cols: 1, height: 52, size: 20, gap: 8 });
    return;
  }
  const right = g.answer === g.id;
  const p = PAINTINGS.find((x) => x.id === g.id);
  ui.text(right ? `Correct: ${g.points} points` : 'Not this time', { size: 28, weight: 700, color: right ? GOOD : BAD });
  ui.text(`It is ${p.title}, by ${p.artist} (${p.yearText}).`, { size: 21 });
  ui.text(p.story, { size: 19, color: THEME.dim });
}

// ───────────────────────── The card above the easel ─────────────────────────

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  ui.header(e.title, [{ id: 'card-close', label: '×', onClick: () => app.set({ explain: null }) || app.refresh() }], { size: 34 });
  ui.text(e.text, { size: 24 });
}
