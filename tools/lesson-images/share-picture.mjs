// The previews shown when a link is shared (Teams, email, WhatsApp…):
//   assets/share.jpg            the lessons page: the page's heart beside the headline
//   assets/share/<lesson>.jpg   each lesson: its picture beside its subject and title
// and the preview tags in index.html and every lesson's index.html (between the "link preview" comments).
// Previews need the site's full address. Run this again after moving the site, with the new address.
//
// usage: node share-picture.mjs <served project> [site address]
//   e.g. node share-picture.mjs http://localhost:8080/ https://<owner>.github.io/webxr-classes/
//   (serve the project as for capture.mjs; the site address defaults to the one already in index.html)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = process.argv[2];
const PROJECT = new URL('../../', import.meta.url);
const file = (rel) => fileURLToPath(new URL(rel, PROJECT));
const home = fs.readFileSync(file('index.html'), 'utf8');
let SITE = process.argv[3] ?? home.match(/<meta property="og:url" content="([^"]+)">/)?.[1];
if (!root || !SITE) throw new Error('usage: node share-picture.mjs <served project> <site address>');
if (!SITE.endsWith('/')) SITE += '/';

const SUBJECT = { chemistry: ['Chemistry', '#b45309'], physics: ['Physics', '#be185d'], biology: ['Biology', '#047857'], computing: ['Computing', '#1d4ed8'], art: ['Art', '#a21caf'], humanities: ['Humanities', '#475569'] };
const brand = fs.readFileSync(file('assets/icon.svg'), 'utf8');
const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const BASE = `body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: radial-gradient(120% 90% at 78% 45%, #ffffff 0%, #f6f5f1 55%, #ecebe5 100%); font-family: "Segoe UI", system-ui, sans-serif; color: #15171c; position: relative; }
  .brand { display: flex; align-items: center; gap: 14px; font: 600 30px "Palatino Linotype", Palatino, Georgia, serif; }
  .brand svg { width: 52px; height: 52px; }
  h1 { font-family: "Palatino Linotype", Palatino, Georgia, serif; font-weight: 500; margin: 0; }
  h1 em { color: #2f4bd8; }
  p { font-size: 27px; line-height: 1.4; color: #4a4f5c; margin: 0; }`;

const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();

// ── the lessons page: its heart on a transparent background, beside the headline ──
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await p.goto(root, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 6000));
await p.evaluate(() => {
  document.documentElement.classList.remove('reveal-on');
  document.body.style.background = 'transparent';
  document.documentElement.style.background = 'transparent';
  for (const el of document.querySelectorAll('.hero, .hero *')) if (!el.closest('#stage')) el.style.visibility = 'hidden';
  document.querySelector('#stage').style.visibility = 'visible';
  document.querySelector('#stage figcaption').style.visibility = 'hidden';
  const still = document.querySelector('#stage-fallback');
  if (still) still.style.visibility = 'hidden';
  document.querySelector('.top').style.visibility = 'hidden';
});
const heart = 'data:image/png;base64,' + (await (await p.$('#stage')).screenshot({ omitBackground: true, encoding: 'base64' }));
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await p.setContent(`<!doctype html><html><head><style>${BASE}
  .l { position: absolute; left: 72px; top: 64px; width: 640px; }
  h1 { font-size: 92px; line-height: 1.02; letter-spacing: -2px; margin: 70px 0 26px; }
  .chips { position: absolute; left: 72px; bottom: 58px; display: flex; gap: 12px; }
  .chips span { font-size: 19px; font-weight: 600; padding: 7px 16px; border-radius: 999px; border: 1.5px solid; }
  img { position: absolute; right: -50px; top: 50%; transform: translateY(-50%); height: 590px; }
</style></head><body>
  <img src="${heart}">
  <div class="l"><div class="brand">${brand}WebXR Library</div>
  <h1>Lessons you can <em>step into</em>.</h1>
  <p>${document_count()} mixed reality lessons that run in the headset’s browser, for one student or a whole class.</p></div>
  <div class="chips">${Object.entries(SUBJECT).map(([, [n, c]]) => `<span style="color:${c}">${n.replace(' visit', '')}</span>`).join('')}</div>
</body></html>`, { waitUntil: 'load' });
await p.screenshot({ path: file('assets/share.jpg'), type: 'jpeg', quality: 88 });
function document_count() { return (home.match(/<button class="card"/g) ?? []).length; }

// ── each lesson: its picture beside its subject and title ──
fs.mkdirSync(file('assets/share'), { recursive: true });
const lessons = fs.readdirSync(file('lessons')).filter((l) => fs.existsSync(file(`lessons/${l}/index.html`)));
for (const l of lessons) {
  const html = fs.readFileSync(file(`lessons/${l}/index.html`), 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  const subject = html.match(/class="eyebrow" data-subject="(\w+)"/)?.[1];
  const [label, colour] = SUBJECT[subject] ?? ['Lesson', '#4a4f5c'];
  const pic = file(`assets/lessons/${l}.webp`);
  const img = fs.existsSync(pic) ? `data:image/webp;base64,${fs.readFileSync(pic).toString('base64')}` : '';
  await p.setContent(`<!doctype html><html><head><style>${BASE}
    .l { position: absolute; left: 64px; top: 60px; bottom: 60px; width: 470px; display: flex; flex-direction: column; }
    .eyebrow { margin-top: auto; display: flex; align-items: center; gap: 12px; font-size: 21px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: ${colour}; }
    .eyebrow::before { content: ""; width: 13px; height: 13px; border-radius: 50%; background: currentColor; }
    h1 { font-size: ${title.length > 16 ? 64 : 76}px; line-height: 1.04; letter-spacing: -1.5px; margin: 14px 0 22px; }
    p { font-size: 23px; margin-bottom: auto; }
    .pic { position: absolute; right: 40px; top: 40px; bottom: 40px; width: 610px; border-radius: 26px; overflow: hidden; background: #c9d3e2; box-shadow: 0 2px 6px rgba(20,24,40,.08), 0 24px 60px rgba(20,24,40,.16); }
    .pic img { width: 100%; height: 100%; object-fit: cover; }
  </style></head><body>
    <div class="l"><div class="brand">${brand}WebXR Library</div>
      <div class="eyebrow">${label}</div><h1>${esc(title)}</h1>
      <p>Runs straight in the headset’s browser, with nothing to install.</p></div>
    <div class="pic">${img ? `<img src="${img}">` : ''}</div>
  </body></html>`, { waitUntil: 'load' });
  await p.screenshot({ path: file(`assets/share/${l}.jpg`), type: 'jpeg', quality: 86 });
}
await b.close();

// ── the preview tags ──
const tags = ({ url, image, title, description, alt }, nl) => [
  '<!-- link preview: written by tools/lesson-images/share-picture.mjs (run it again if the site moves) -->',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="WebXR Library">',
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(description)}">`,
  `<meta property="og:url" content="${url}">`,
  `<meta property="og:image" content="${image}">`,
  '<meta property="og:image:type" content="image/jpeg">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  `<meta property="og:image:alt" content="${esc(alt)}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  '<!-- /link preview -->',
].map((t) => '  ' + t).join(nl) + nl;
const write = (rel, info, after) => {
  let h = fs.readFileSync(file(rel), 'utf8');
  const nl = h.includes('\r\n') ? '\r\n' : '\n';
  // drop the previous preview tags: the "link preview" comments (and an older two-line note) and every og:/twitter: line
  h = h
    .replace(/  <!-- the preview shown when the link is shared[^\n]*\n[^\n]*-->\r?\n/g, '')
    .replace(/  <!-- \/?link preview[^\n]*-->\r?\n/g, '')
    .replace(/  <meta (property="og:[^"]+"|name="twitter:card") content="[^"]*">\r?\n/g, '');
  const anchor = h.match(after);
  if (!anchor) throw new Error(`${rel}: nowhere to put the preview tags`);
  h = h.replace(anchor[0], anchor[0] + tags(info, nl));
  fs.writeFileSync(file(rel), h);
};
const homeDesc = home.match(/<meta name="description" content="([^"]+)">/)[1];
write('index.html', { url: SITE, image: `${SITE}assets/share.jpg`, title: 'WebXR Library: lessons you can step into', description: homeDesc, alt: 'WebXR Library: lessons you can step into, with the Heart Lab’s anatomical heart' }, /  <meta name="theme-color"[^\n]*\n/);
for (const l of lessons) {
  const rel = `lessons/${l}/index.html`;
  const html = fs.readFileSync(file(rel), 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1] ?? `${title}, a mixed reality lesson.`;
  write(rel, { url: `${SITE}lessons/${l}/`, image: `${SITE}assets/share/${l}.jpg`, title: `${title} · WebXR Library`, description, alt: `${title}: a picture from the lesson` }, /  <meta name="description"[^\n]*\n/);
}
console.log(`previews for the lessons page and ${lessons.length} lessons, for ${SITE}`);
