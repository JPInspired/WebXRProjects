import { THEME } from '../../../../shared/ui/CanvasPanel.js';
import { ERAS, ERA, MARKERS, PLACES, QUIZ, TEXT_QUESTIONS, UI } from '../data/text.js';

// The panels: moments, places, the text, the quiz and moving on the left; what you are looking at on the right;
// a short guide card above. Every word comes from src/data/text.js in the chosen language.

export function drawControls(ui, app) {
  const s = app.state;
  const L = UI[s.lang];
  ui.header(L.lesson, [{ id: 'lang', label: s.lang === 'en' ? 'ΕΛ' : 'EN', onClick: () => app.toggleLanguage() }, app.settingsIcon()]);
  const tab = app.menuTab ?? 'moments';
  ui.tabs([['moments', L.moments], ['places', L.places], ['text', L.text], ['quiz', L.quiz], ['moving', L.moving]].map(([id, label]) => ({ id: `tab-${id}`, label, active: tab === id, onClick: () => app.setTab(id) })), { height: 52, size: tabSize(s.lang), cols: 5, gap: 6 });
  if (tab === 'moments') {
    const locked = app.followsTeacherMoment;
    ui.buttons(ERAS.map((id) => ({ id: `era-${id}`, label: ERA[id][s.lang].label, active: s.era === id, disabled: locked, onClick: () => app.chooseEra(id) })), { cols: 2, height: 54, size: 21, gap: 8 });
    if (s.era === 'blast') {
      ui.buttons([
        { id: 'play', label: app.blast.running ? L.again : L.play815, disabled: locked, onClick: () => app.playBlast() },
        { id: 'skip', label: L.skip, disabled: locked, onClick: () => app.chooseEra('after') },
      ], { height: 52, size: 20, gap: 8 });
    }
    if (s.era === 'rebuilt' || s.era === 'today') {
      ui.buttons([{ id: 'crane', label: L.crane, onClick: () => app.leaveCrane() }], { height: 52, size: 20 });
      ui.text(L.cranesLeft(app.craneCount()), { size: 19, color: THEME.dim });
    }
    if (locked) ui.text(UI[s.lang].lookTogetherText, { size: 19, color: THEME.dim });
  } else if (tab === 'places') {
    ui.buttons(PLACES.map((p) => ({ id: `place-${p.id}`, label: L.places_[p.id], onClick: () => app.goToPlace(p) })), { cols: 2, height: 52, size: 20, gap: 8 });
    const here = MARKERS.filter((m) => m.eras.includes(s.era === 'blast' ? 'before' : s.era));
    if (here.length) {
      ui.gap(4);
      ui.buttons(here.map((m) => ({ id: `go-${m.id}`, label: `ⓘ ${m[s.lang].title}`, active: s.selected === m.id, onClick: () => app.goToMarker(m.id) })), { cols: 1, height: 46, size: 19, gap: 6 });
    }
  } else if (tab === 'moving') {
    ui.text(app.presenting ? L.moveXR : L.moveDesk, { size: 20, color: THEME.dim });
    ui.buttons([
      { id: 'turn', label: L.turn(app.turnLabel()), onClick: () => app.cycleTurn() },
      { id: 'markers', label: L.markers(s.markers), active: s.markers, onClick: () => app.toggleMarkers() },
      { id: 'flash', label: L.flash(s.flash), active: s.flash, onClick: () => app.toggleFlash() },
    ], { cols: 2, height: 50, size: 19, gap: 8 });
  } else if (tab === 'text') {
    ui.text(L.textIntro, { size: 21, color: THEME.dim });
  } else if (tab === 'quiz') {
    ui.text(L.question(Math.min(s.quiz.i + 1, QUIZ.length), QUIZ.length), { size: 21, color: THEME.dim });
    ui.buttons([{ id: 'quiz-restart', label: L.restart, onClick: () => app.restartQuiz() }], { height: 48, size: 19 });
  }
}

const tabSize = (lang) => (lang === 'el' ? 15 : 17);

export function drawInfo(ui, app) {
  const s = app.state;
  const L = UI[s.lang];
  const tab = app.menuTab ?? 'moments';
  if (tab === 'text') {
    ui.title(L.text, { size: 34 });
    TEXT_QUESTIONS[s.lang].forEach((q, i) => {
      ui.text(`${i + 1}. ${q}`, { size: 21 });
      ui.gap(6);
    });
    return;
  }
  if (tab === 'quiz') {
    const q = s.quiz;
    if (q.i >= QUIZ.length) {
      ui.title(L.quizDone(q.score, QUIZ.length), { size: 32 });
      ui.text(L.quizClose, { size: 22 });
      ui.buttons([{ id: 'quiz-again', label: L.restart, onClick: () => app.restartQuiz() }], { height: 52, size: 20 });
      return;
    }
    const item = QUIZ[q.i];
    const Q = item[s.lang];
    ui.text(Q.q, { size: 24, weight: 700 });
    ui.gap(4);
    ui.buttons(Q.a.map((a, i) => ({
      id: `ans-${i}`, label: a,
      active: q.picked === i,
      color: q.picked == null ? null : i === item.answer ? '#2f7a4a' : q.picked === i ? '#8a3a3a' : null,
      onClick: () => app.answer(i),
    })), { cols: 1, height: 54, size: 19, gap: 8 });
    if (q.picked != null) {
      ui.text(q.picked === item.answer ? L.right : L.wrong(Q.a[item.answer]), { size: 20, color: q.picked === item.answer ? '#7fd69a' : '#ffb4a8' });
      ui.buttons([{ id: 'quiz-next', label: q.i + 1 < QUIZ.length ? L.next : L.finish, onClick: () => app.nextQuestion() }], { height: 50, size: 20 });
    }
    return;
  }
  const m = MARKERS.find((x) => x.id === s.selected);
  if (!m) {
    const era = ERA[s.era === 'blast' ? 'blast' : s.era][s.lang];
    ui.title(era.title, { size: 34 });
    ui.text(era.text, { size: 22 });
    ui.gap(6);
    for (const p of L.welcomeText) ui.text(p, { size: 20, color: THEME.dim });
    return;
  }
  const t = m[s.lang];
  ui.title(t.title, { size: 32 });
  ui.text(t.kind, { size: 20, color: THEME.dim });
  ui.gap(4);
  for (const f of t.facts) ui.text(`• ${f}`, { size: 21 });
}

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  ui.y = 26;
  ui.text(UI[app.state.lang].guide, { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 31, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(2);
  ui.text(e.text, { size: 25, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
