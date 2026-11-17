// Turn captured frames into the lessons page's images: assets/lessons/<lesson>.webp (a 960×600 still) and
// <lesson>-loop.webp (an animated loop, played on hover). usage: node build.mjs <frames folder> [lesson,lesson…]
import fs from 'node:fs';
import sharp from 'sharp';

const [, , dir, list] = process.argv;
const out = new URL('../../assets/lessons/', import.meta.url);
const lessons = list ? list.split(',') : [...new Set(fs.readdirSync(dir).filter((f) => /^[a-z-]+\.png$/.test(f)).map((f) => f.slice(0, -4)))];
for (const l of lessons) {
  await sharp(`${dir}/${l}.png`).resize(960, 600).webp({ quality: 80, effort: 5 }).toFile(new URL(`${l}.webp`, out).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const frames = fs.readdirSync(dir).filter((f) => f.startsWith(`${l}-f`) && f.endsWith('.jpg')).sort().map((f) => `${dir}/${f}`);
  if (frames.length) await sharp(frames, { join: { animated: true } }).webp({ quality: 70, effort: 5, delay: 100, loop: 0 }).toFile(new URL(`${l}-loop.webp`, out).pathname.replace(/^\/([A-Z]:)/, '$1'));
  console.log(l, frames.length ? `${frames.length} frames` : 'still only');
}
