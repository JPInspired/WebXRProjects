import * as THREE from 'three';
import { rng } from './layout.js';

// Pictures drawn once in code (no image files): house fronts, roof tiles, concrete facades, the hall's walls,
// stone, and soft puffs for smoke and cloud.

/** A photo texture from lessons/hiroshima/textures/ (CC0, Poly Haven: see CREDITS.md), repeating. */
const loader = new THREE.TextureLoader();
export function photo(name, rx = 1, ry = rx) {
  const t = loader.load(new URL(`../../textures/${name}.jpg`, import.meta.url).toString());
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = false, srgb = true, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (!mip) t.generateMipmaps = false;
  return t;
}

/** Speckle: a little grain over a filled area, so nothing looks like flat plastic. */
function grain(g, w, h, amount = 0.08, rand = Math.random, size = 2) {
  const n = Math.floor((w * h) / 18);
  for (let i = 0; i < n; i++) {
    const v = rand();
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${amount * rand()})` : `rgba(0,0,0,${amount * rand()})`;
    g.fillRect(rand() * w, rand() * h, size, size);
  }
}

/**
 * A wooden town-house front (machiya), read left to right in four panels the house geometry picks from:
 * u 0–0.25 a shop front (wooden lattice, a cloth curtain), 0.25–0.5 a home (lattice windows, a sliding door),
 * 0.5–0.75 a plain side wall (dark boards below, pale plaster above), 0.75–1 an upper floor (plaster, a small
 * lattice window). Burnt = the same, charred.
 */
export function houseTexture(burnt = false) {
  const W = 1024, H = 256;
  // drawn at twice the size (sharper up close), in the same 1024 × 256 layout
  const [c, g] = canvas(W * 2, H * 2);
  g.scale(2, 2);
  const r = rng(burnt ? 7 : 3);
  const board = (x, w, y, h, base) => {
    g.fillStyle = base;
    g.fillRect(x, y, w, h);
    for (let i = x; i < x + w; i += 6 + r() * 3) {
      g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.2})`;
      g.fillRect(i, y, 1.5, h);
    }
  };
  const lattice = (x, w, y, h, bar, gap, color) => {
    g.fillStyle = 'rgba(15,10,8,0.85)';
    g.fillRect(x, y, w, h);
    g.fillStyle = color;
    for (let i = x; i < x + w; i += gap) g.fillRect(i, y, bar, h);
    g.fillRect(x, y, w, 4);
    g.fillRect(x, y + h - 4, w, 4);
  };
  const wood = burnt ? '#1c1714' : '#5a4232';
  const woodLight = burnt ? '#2a221d' : '#7a5c44';
  const plaster = burnt ? '#3a3431' : '#d9d0bd';
  // 1. shop front
  board(0, 256, 0, H, wood);
  g.fillStyle = plaster;
  g.fillRect(0, 0, 256, 70);
  lattice(20, 100, 110, 130, 5, 11, woodLight);
  g.fillStyle = burnt ? '#2b2522' : '#2f3f5a'; // noren curtain over the doorway
  g.fillRect(140, 100, 96, 50);
  g.fillStyle = burnt ? '#120f0d' : '#1b1510';
  g.fillRect(140, 150, 96, 106);
  g.fillStyle = burnt ? 'rgba(0,0,0,0)' : '#e8e1cf';
  if (!burnt) for (let i = 0; i < 3; i++) g.fillRect(152 + i * 30, 112, 18, 26);
  g.fillStyle = burnt ? '#2a2420' : '#3d2c22';
  g.fillRect(10, 74, 236, 20); // sign board
  if (!burnt) {
    g.fillStyle = '#e9e1cc';
    g.font = 'bold 15px serif';
    for (let i = 0; i < 6; i++) g.fillText(['米', '茶', '酒', '店', '屋', '堂'][Math.floor(r() * 6)], 40 + i * 32, 90);
  }
  // 2. home
  board(256, 256, 0, H, wood);
  g.fillStyle = plaster;
  g.fillRect(256, 0, 256, 80);
  lattice(276, 110, 110, 90, 4, 9, woodLight);
  lattice(400, 92, 96, 160, 4, 14, woodLight);
  // 3. side wall
  board(512, 256, 120, 136, wood);
  g.fillStyle = plaster;
  g.fillRect(512, 0, 256, 120);
  // 4. upper floor
  g.fillStyle = plaster;
  g.fillRect(768, 0, 256, H);
  board(768, 256, 200, 56, wood);
  lattice(820, 150, 70, 80, 4, 10, woodLight);
  // the timber frame showing through the plaster: posts at the corners and a beam under each plaster band
  const post = burnt ? '#141110' : '#3b2b20';
  g.fillStyle = post;
  for (const [x, y, w, h] of [[0, 0, 7, H], [249, 0, 7, H], [256, 0, 7, H], [505, 0, 7, H], [512, 0, 7, H], [761, 0, 7, H], [768, 0, 7, H], [1017, 0, 7, H], [0, 66, 256, 6], [256, 76, 256, 6], [512, 116, 256, 6], [768, 196, 256, 6], [884, 0, 6, 200]]) g.fillRect(x, y, w, h);
  // a small paper-screen window (shoji) high in the side wall
  g.fillStyle = burnt ? '#1a1513' : '#4a3628';
  g.fillRect(588, 28, 104, 62);
  g.fillStyle = burnt ? '#2b2420' : '#ebe4d2';
  g.fillRect(594, 34, 92, 50);
  g.fillStyle = burnt ? '#1a1513' : '#6b5040';
  for (let i = 1; i < 4; i++) g.fillRect(594 + i * 23, 34, 2, 50);
  g.fillRect(594, 58, 92, 2);
  if (!burnt) {
    // a paper lantern (chochin) by the shop's doorway, and a potted plant by the home's door
    const lg = g.createRadialGradient(128, 112, 2, 128, 112, 16);
    lg.addColorStop(0, '#f4e3b8');
    lg.addColorStop(1, '#c9452f');
    g.fillStyle = lg;
    g.beginPath();
    g.ellipse(128, 114, 11, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a1d16';
    g.fillRect(122, 96, 12, 4);
    g.fillRect(122, 128, 12, 4);
    g.fillStyle = '#6f4a32';
    g.fillRect(374, 228, 20, 22);
    g.fillStyle = '#3f5a2f';
    g.beginPath();
    g.ellipse(384, 220, 16, 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  // shade under the eaves at the top, and the splash of dust and mud along the foot of every wall
  for (const x of [0, 256, 512, 768]) {
    const top = g.createLinearGradient(0, 0, 0, 34);
    top.addColorStop(0, 'rgba(20,14,10,0.45)');
    top.addColorStop(1, 'rgba(20,14,10,0)');
    g.fillStyle = top;
    g.fillRect(x, 0, 256, 34);
    const foot = g.createLinearGradient(0, H - 26, 0, H);
    foot.addColorStop(0, 'rgba(70,55,40,0)');
    foot.addColorStop(1, burnt ? 'rgba(10,8,7,0.6)' : 'rgba(70,55,40,0.55)');
    g.fillStyle = foot;
    g.fillRect(x, H - 26, 256, 26);
  }
  // faint rain streaks down the plaster
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    g.fillStyle = `rgba(60,50,40,${0.04 + r() * 0.06})`;
    g.fillRect(x, r() * 40, 1 + r() * 2, 30 + r() * 80);
  }
  grain(g, W, H, burnt ? 0.2 : 0.12, r);
  const t0 = tex(c);
  // real weathered wood (CC0, Poly Haven) laid over the boarded parts, once it has loaded
  const img = new Image();
  img.onload = () => {
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = burnt ? 0.35 : 0.7;
    for (const [x, y, w, h] of [[0, 94, 256, 162], [256, 80, 256, 176], [512, 120, 256, 136], [768, 200, 256, 56]]) g.drawImage(img, 0, 0, img.width * (w / 256), img.height * (h / 256) * 0.5, x, y, w, h);
    g.restore();
    t0.needsUpdate = true;
  };
  img.src = new URL('../../textures/dark_wooden_planks.jpg', import.meta.url).toString();
  if (burnt) {
    // soot streaks rising from the openings
    for (let i = 0; i < 60; i++) {
      const x = r() * W;
      const grad = g.createLinearGradient(x, H, x, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 10 + r() * 30, H);
    }
  }
  return t0;
}

/** Grey-blue roof tiles (kawara) in rows; 1 tile row ≈ 1/16 of the texture. */
export function roofTexture(tone = '#4b5260') {
  const [c, g] = canvas(256, 256);
  const r = rng(11);
  g.fillStyle = tone;
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    const grad = g.createLinearGradient(0, y, 0, y + 16);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.75, 'rgba(0,0,0,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = grad;
    g.fillRect(0, y, 256, 16);
    for (let x = (y / 16) % 2 ? 8 : 0; x < 256; x += 16) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x, y, 1.5, 16);
    }
  }
  grain(g, 256, 256, 0.1, r);
  return tex(c, { repeat: true });
}

/** A concrete building's facade: rows of windows. `style`: 'old' (1930s), 'burnt' (gutted), 'new' (1950s), 'modern'. */
export function facadeTexture(style = 'old') {
  const [c, g] = canvas(256, 256);
  const r = rng(style.length * 13);
  const base = { old: '#bdb5a6', burnt: '#57514d', new: '#cfcac0', modern: '#d8dade' }[style];
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  grain(g, 256, 256, 0.1, r);
  const cols = style === 'modern' ? 4 : 4;
  const rows = 4; // one texture repeat = 4 storeys
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = 14 + i * 62, y = 16 + j * 64;
      if (style === 'modern') {
        g.fillStyle = r() > 0.3 ? '#6f8ba3' : '#9fb6c8';
        g.fillRect(x - 10, y, 58, 40);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x - 10, y, 58, 6);
        continue;
      }
      g.fillStyle = style === 'burnt' ? '#0c0a09' : style === 'new' ? '#4d5f70' : '#3b4450';
      g.fillRect(x, y, 34, 40);
      if (style !== 'burnt') {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x + 16, y, 2, 40);
        g.fillRect(x, y + 19, 34, 2);
      } else {
        const grad = g.createLinearGradient(0, y, 0, y - 30);
        grad.addColorStop(0, 'rgba(0,0,0,0.6)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(x - 4, y - 30, 42, 30);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x - 3, y + 40, 40, 4); // sill shadow
    }
  }
  return tex(c, { repeat: true });
}

/**
 * The hall's outer walls: pale render with rows of tall arched windows, and a cornice line. One repeat is one
 * storey and three windows. Ruined: the windows are holes (alpha), and the top edge is broken.
 */
export function hallWallTexture(ruin = false) {
  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  const r = rng(ruin ? 21 : 19);
  g.fillStyle = ruin ? '#8d8276' : '#d9cfbc';
  g.fillRect(0, 0, W, H);
  grain(g, W, H, ruin ? 0.22 : 0.1, r, 3);
  // horizontal bands (string courses)
  g.fillStyle = ruin ? 'rgba(40,30,25,0.35)' : 'rgba(120,100,80,0.35)';
  g.fillRect(0, 0, W, 14);
  g.fillRect(0, H - 10, W, 10);
  for (let i = 0; i < 3; i++) {
    const x = 50 + i * 160, y = 52, w = 64, h = 160;
    if (ruin) {
      g.clearRect(x, y + 32, w, h - 32);
      g.save();
      g.beginPath();
      g.arc(x + w / 2, y + 32, w / 2, Math.PI, 0);
      g.closePath();
      g.globalCompositeOperation = 'destination-out';
      g.fill();
      g.restore();
      // scorch round the holes
      g.strokeStyle = 'rgba(20,15,12,0.5)';
      g.lineWidth = 10;
      g.strokeRect(x - 4, y + 30, w + 8, h - 26);
    } else {
      g.fillStyle = '#e9e2d2';
      g.fillRect(x - 8, y - 8, w + 16, h + 14);
      g.fillStyle = '#34404c';
      g.beginPath();
      g.moveTo(x, y + h);
      g.lineTo(x, y + 32);
      g.arc(x + w / 2, y + 32, w / 2, Math.PI, 0);
      g.lineTo(x + w, y + h);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(x + w / 2 - 1.5, y, 3, h);
      for (let k = 1; k < 4; k++) g.fillRect(x, y + 32 + k * 32, w, 2);
    }
  }
  if (ruin) {
    // a broken top edge, and holes knocked through
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, 4 + r() * 26);
    g.lineTo(W, 0);
    g.closePath();
    g.fill();
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(r() * W, 60 + r() * 150, 6 + r() * 16, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  return tex(c, { repeat: true });
}

/** Dressed stone for the river embankments and the bridge. */
export function stoneTexture() {
  const [c, g] = canvas(256, 256);
  const r = rng(5);
  g.fillStyle = '#8b8a84';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const off = (y / 32) % 2 ? 24 : 0;
    for (let x = -off; x < 256; x += 48) {
      const v = 120 + r() * 40;
      g.fillStyle = `rgb(${v},${v - 2},${v - 8})`;
      g.fillRect(x + 2, y + 2, 44, 28);
    }
  }
  grain(g, 256, 256, 0.15, r);
  return tex(c, { repeat: true });
}

/** A soft round puff for smoke, dust and the cloud (white; tinted by the material). */
export function puffTexture() {
  const [c, g] = canvas(128, 128);
  const r = rng(9);
  for (let i = 0; i < 22; i++) {
    const x = 64 + (r() - 0.5) * 56, y = 64 + (r() - 0.5) * 56, rad = 16 + r() * 34;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.26)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  // fade to nothing at the edge so no square shows
  g.globalCompositeOperation = 'destination-in';
  const edge = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = edge;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}

/** Bark for tree trunks (and charred bark). */
export function barkTexture(burnt = false) {
  const [c, g] = canvas(64, 128);
  const r = rng(burnt ? 33 : 31);
  g.fillStyle = burnt ? '#1d1916' : '#5b4a3c';
  g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.3})`;
    g.fillRect(r() * 64, 0, 1 + r() * 2, 128);
  }
  grain(g, 64, 128, 0.2, r);
  return tex(c, { repeat: true });
}

/** Leaves (a canopy's speckled light and shade). */
export function leafTexture(tint = '#4a6b3c') {
  const [c, g] = canvas(128, 128);
  const r = rng(41);
  g.fillStyle = tint;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = r();
    g.fillStyle = v > 0.55 ? `rgba(220,255,170,${0.15 + r() * 0.2})` : `rgba(0,20,0,${0.2 + r() * 0.3})`;
    g.beginPath();
    g.arc(r() * 128, r() * 128, 1 + r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, { repeat: true });
}
