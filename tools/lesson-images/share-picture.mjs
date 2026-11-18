// The picture shown when the lessons page link is shared (Teams, email, WhatsApp…): assets/share.jpg, 1200×630.
// It renders the lessons page heart on a transparent background, then lays it out beside the headline.
// usage: node share-picture.mjs http://localhost:8080/   (with the project served, as for capture.mjs)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = process.argv[2];
const ASSETS = new URL('../../assets/', import.meta.url);
const out = new URL('share.jpg', ASSETS);
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await p.goto(root, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 6000));
await p.evaluate(() => { document.body.style.background = 'transparent'; document.documentElement.style.background = 'transparent'; for (const el of document.querySelectorAll('.hero, .hero *')) if (!el.closest('#stage')) el.style.visibility = 'hidden'; document.querySelector('#stage').style.visibility = 'visible'; document.querySelector('#stage figcaption').style.visibility = 'hidden'; document.querySelector('#stage-fallback') && (document.querySelector('#stage-fallback').style.visibility = 'hidden'); document.querySelector('.top').style.visibility = 'hidden'; });
const stage = await p.$('#stage');
const heart = 'data:image/png;base64,' + (await stage.screenshot({ omitBackground: true, encoding: 'base64' }));
const brand = fs.readFileSync(new URL('icon.svg', ASSETS), 'utf8');
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await p.setContent(`<!doctype html><html><head><style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: radial-gradient(120% 90% at 78% 45%, #ffffff 0%, #f6f5f1 55%, #ecebe5 100%); font-family: "Segoe UI", system-ui, sans-serif; color: #15171c; position: relative; }
  .l { position: absolute; left: 72px; top: 64px; width: 640px; }
  .brand { display: flex; align-items: center; gap: 14px; font: 600 30px "Palatino Linotype", Palatino, Georgia, serif; }
  .brand svg { width: 52px; height: 52px; }
  h1 { font: 500 92px/1.02 "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: -2px; margin: 70px 0 26px; }
  h1 em { color: #2f4bd8; }
  p { font-size: 27px; line-height: 1.4; color: #4a4f5c; margin: 0; }
  .chips { position: absolute; left: 72px; bottom: 58px; display: flex; gap: 12px; }
  .chips span { font-size: 19px; font-weight: 600; padding: 7px 16px; border-radius: 999px; border: 1.5px solid; }
  img { position: absolute; right: -50px; top: 50%; transform: translateY(-50%); height: 590px; }
</style></head><body>
  <img src="${heart}">
  <div class="l"><div class="brand">${brand}WebXR Library</div>
  <h1>Lessons you can <em>step into</em>.</h1>
  <p>20 mixed reality lessons that run in the headset’s browser, for one student or a whole class.</p></div>
  <div class="chips"><span style="color:#b45309">Chemistry</span><span style="color:#be185d">Physics</span><span style="color:#047857">Biology</span><span style="color:#1d4ed8">Computing</span><span style="color:#7c3aed">Museum</span></div>
</body></html>`, { waitUntil: 'load' });
await p.screenshot({ path: fileURLToPath(out), type: 'jpeg', quality: 88 });
await b.close();
console.log('ok');
