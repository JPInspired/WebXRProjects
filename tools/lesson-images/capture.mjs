// Capture each lesson for the lessons page (index.html): a still and a sequence of frames for its hover loop.
// usage: node capture.mjs <site address> <frames folder> [lesson,lesson… | all] --frames 30
//   e.g. node capture.mjs http://localhost:8080/ frames all --frames 30   (then: node build.mjs frames)
// The site must be served (any static server); see README.md.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [, , root, out, list, ...rest] = process.argv;
const FRAMES = rest.includes('--frames') ? +rest[rest.indexOf('--frames') + 1] : 0;
fs.mkdirSync(out, { recursive: true });

// What to do in each lesson before capturing (runs in the page), and where to put the camera (world coordinates;
// the lab sits at (0, 1.2, 0) on a screen). keepBg: keep the lesson's own surroundings.
const SETUP = {
  'atomic-models': { js: `app.pickElement?.(6); app.set({ atomView: 'cloud' });`, cam: [0.06, 1.235, 0.3], tgt: [0, 1.2, 0] },
  'acid-lab': { js: `app.setMode?.('paper'); app.putGogglesOn?.();`, cam: [0.32, 1.22, 0.42], tgt: [0, 0.92, -0.02] },
  'lithium-lab': { js: `app.setMode('lab'); app.quickDrop?.('C');`, wait: 1500, cam: [0.3, 1.2, 0.45], tgt: [0.05, 0.93, -0.05] },
  'kinetics-lab': { js: `app.setMode('lab');`, cam: [0.34, 1.23, 0.52], tgt: [0.06, 0.93, -0.03] },
  'voltaic-lab': { js: `app.setMode('lab'); for (const [i,l,r,e] of [[0,'zn','cu','lemon'],[1,'mg','cu','salt'],[2,'zn','cu','acid'],[3,'fe','cu','salt']]) { app.selectCell(i); app.quickStrip('left', l); app.quickStrip('right', r); app.quickElectrolyte(e); } app.toggleSeries(); app.toggleParticles();`, cam: [0.36, 1.36, 0.72], tgt: [0, 1.06, -0.12] },
  'waves-lab': { js: `app.setMode('rope');`, wait: 1500, cam: [0.22, 1.22, 0.5], tgt: [0, 1.05, 0] },
  'bounce-lab': { js: `app.setMode?.('drop'); app.dropButton?.();`, wait: 300, cam: [0.45, 1.25, 0.75], tgt: [0, 0.55, -0.1] },
  'radiation-lab': { js: `app.setMode?.('test'); app.toggleXray?.();`, cam: [0.3, 1.22, 0.45], tgt: [0, 0.93, 0] },
  'circular-lab': { js: `app.setMode('lab'); app.kit.arrows = true; app.kit.holdSteady();`, wait: 4000, cam: [0.5, 1.45, 0.92], tgt: [0, 1.66, -0.12] },
  'kinematics-lab': { js: `app.setMode('lab'); app.setStation('spring', true); app.setting('id','soft'); app.setting('m',200); app.run();`, wait: 500, cam: [0.35, 1.3, 0.6], tgt: [-0.1, 1.15, -0.1] },
  'pendulum-lab': { js: `app.setMode('measure'); app.setLength(0.8); app.setAngle(30); app.release();`, wait: 500, cam: [0.45, 1.35, 0.9], tgt: [0, 1.4, -0.12] },
  'cell-explorer': { js: `app.toggleCut?.();`, cam: [0.25, 1.32, 0.72], tgt: [0, 1.2, -0.05] },
  'heart-lab': { js: ``, cam: [0.22, 1.33, 0.5], tgt: [0, 1.23, 0] },
  'enzyme-lab': { js: ``, cam: [0.3, 1.22, 0.45], tgt: [0, 0.95, 0] },
  'microscope-lab': { js: ``, cam: [0.3, 1.22, 0.45], tgt: [0, 0.97, 0] },
  'osmosis-lab': { js: `app.setMode('lab');`, cam: [0.3, 1.2, 0.45], tgt: [0, 0.92, 0] },
  'organs-lab': { js: `app.setMode('build'); const b = app.body; for (const p of b.active) { const s = b.grab(p.mesh, 'single', p.group.getWorldPosition(app.camera.position.clone())); s.move(b.homeWorld(p)); s.release(); } app.setMode('functions'); for (const k of b.activeCards) { const s = b.grabCard(k, k.group.getWorldPosition(app.camera.position.clone())); const w = b.homeWorld(b.cardPieces(k.id)[0]); s.move(w); s.release(w); }`, wait: 1200, cam: [0.6, 1.4, 0.95], tgt: [0.32, 1.15, -0.06] },
  'reef-dive': { js: ``, cam: null, keepBg: true },
  'pc-builder': { js: ``, cam: [0.4, 1.32, 0.78], tgt: [0, 1.04, 0] },
  'hintze-hall': { js: ``, cam: null, keepBg: true },
  // (the walking camera is held still, so the loop's gentle sway turns round the hall)
  'hiroshima': { js: `app.state.panels = false; app.set({ explain: null }); app.state.markers = false; app.walker.teleportDesk([-12, 0, -50], [5, 11, 4], false); app.walker.placeCamera(app.camera); app.updateDesk = () => {}; app.controls.target.set(6, 9, 4);`, cam: null, keepBg: true, wait: 2500 },
  'art-gallery': { js: `app.choose('starry');`, cam: [0.32, 1.42, 1.05], tgt: [0, 1.22, -0.1], keepBg: true },
};
const LESSONS = list && list !== 'all' ? list.split(',') : Object.keys(SETUP);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 600000, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const l of LESSONS) {
  const p = await browser.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.setViewport({ width: 1600, height: 1000 });
  await p.goto(new URL(`lessons/${l}/`, root).toString(), { waitUntil: 'load' });
  await p.waitForFunction(() => window.app, { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000)); // models load
  const S = SETUP[l] ?? {};
  await p.evaluate(async (js, cam, tgt, studio) => {
    document.getElementById('overlay').style.display = 'none';
    try { new Function(js)(); } catch (e) { console.error(e); }
    app.set?.({ explain: null, big: false });
    app.menusHidden = true; // the lesson keeps every panel hidden from now on
    if (studio) {
      // a soft studio backdrop instead of the dark room
      const THREE = await import('three');
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 256;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#e6ecf5');
      g.addColorStop(0.6, '#cdd7e6');
      g.addColorStop(1, '#a9b8cd');
      x.fillStyle = g;
      x.fillRect(0, 0, 4, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      app.background = t;
      app.scene.background = t;
      if (app.grid) app.grid.visible = false;
      app.scene.fog = null;
    }
    app.refresh?.();
    if (cam) {
      app.camera.position.set(...cam);
      app.controls.target.set(...tgt);
      app.controls.update();
    }
  }, S.js ?? '', S.cam ?? null, S.tgt ?? null, !S.keepBg);
  await new Promise((r) => setTimeout(r, S.wait ?? 800));
  await p.screenshot({ path: `${out}/${l}.png` });
  if (FRAMES) {
    await p.setViewport({ width: 560, height: 350 }); // card size: renders much faster, so the loop is smoother
    await new Promise((r) => setTimeout(r, 400));
    const t0 = Date.now();
    // a gentle camera sway, there and back, so every loop moves and joins up seamlessly
    const orbit = (i) => p.evaluate((ang) => {
      app.__base ??= { pos: app.camera.position.clone(), tgt: app.controls.target.clone() };
      const b = app.__base;
      const off = b.pos.clone().sub(b.tgt);
      const c = Math.cos(ang), sn = Math.sin(ang);
      app.camera.position.set(b.tgt.x + off.x * c + off.z * sn, b.pos.y, b.tgt.z - off.x * sn + off.z * c);
      app.camera.lookAt(b.tgt);
    }, 0.13 * Math.sin((2 * Math.PI * i) / FRAMES));
    for (let i = 0; i < FRAMES; i++) await orbit(i), await p.screenshot({ path: `${out}/${l}-f${String(i).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 88, optimizeForSpeed: true });
    fs.writeFileSync(`${out}/${l}-timing.json`, JSON.stringify({ frames: FRAMES, ms: Math.round((Date.now() - t0) / FRAMES) }));
  }
  console.log(l, errs.length ? errs.join(' | ').slice(0, 300) : 'ok');
  await p.close();
}
await browser.close();
