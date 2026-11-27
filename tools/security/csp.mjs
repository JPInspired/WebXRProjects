// Writes the security rule (Content Security Policy) into every page of the site, and points every page's import
// map at the 3D engine kept inside the project (shared/vendor/three), not at an outside file host.
//
// The rule tells the browser what each page may load and talk to: scripts only from this site (plus the page's own
// small inline scripts, named by their fingerprint), the class sessions' relays, and nothing else. Code injected
// from anywhere else is refused.
//
// Run it again after changing any inline <script> in a page (its fingerprint changes), or after adding an outside
// service (add it below first):   node tools/security/csp.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// the class sessions' relays (shared/net/config.js relayUrls)
const RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://nostr.mom'];

const pages = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
};
walk(ROOT);

let changed = 0;
for (const file of pages) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  // the 3D engine from inside the project
  const rel = path.relative(path.dirname(file), path.join(ROOT, 'shared/vendor/three')).split(path.sep).join('/');
  html = html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.16[01]\.0\/build\/three\.module\.js/g, `${rel}/build/three.module.js`);
  html = html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.16[01]\.0\/examples\/jsm\//g, `${rel}/examples/jsm/`);
  // fingerprints of the page's inline scripts
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1].replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`);
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${[...new Set(hashes)].join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' data: blob: ${RELAYS.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  if (/<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html)) html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, meta);
  else html = html.replace(/(<meta charset="[^"]*">)/i, `$1\n  ${meta}`);
  if (html !== before) {
    fs.writeFileSync(file, html);
    changed++;
  }
}
console.log(`${changed} of ${pages.length} pages updated`);
