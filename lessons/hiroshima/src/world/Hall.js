import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALL } from './layout.js';
import { hallWallTexture, stoneTexture } from './textures.js';

// The Hiroshima Prefectural Industrial Promotion Hall (1915, Jan Letzel), built in code at about its real size:
// a three-storey block facing the Motoyasu River, with an oval five-storey tower at the centre of its river front
// crowned by a green copper dome. After the bomb: the shell of the tower and its bare steel dome frame, broken
// walls and rubble inside (the Atomic Bomb Dome, as it is kept today).

const STOREY = 4;
const BLOCK_H = 3 * STOREY;
const TOWER_H = 5 * STOREY;
const TOWER = { x: HALL.tower[0], z: HALL.tower[1], rx: 5, rz: 6.5 };
const FRONT_X = 3; // the block's river front

/** A flat wall quad from (x0, z0) to (x1, z1), y0 to y1, with its texture repeating every `uw` metres and 4 m. */
function wallQuad(x0, z0, x1, z1, y0, y1, uw = 10) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.PlaneGeometry(len, y1 - y0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len / uw), uv.getY(i) * ((y1 - y0) / STOREY));
  g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** The oval tower's wall (open cylinder squashed to an ellipse). */
function towerWall(y0, y1, r = 1) {
  const g = new THREE.CylinderGeometry(1, 1, y1 - y0, 40, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.5, uv.getY(i) * ((y1 - y0) / STOREY));
  g.scale(TOWER.rx * r, 1, TOWER.rz * r);
  g.translate(TOWER.x, (y0 + y1) / 2, TOWER.z);
  return g;
}

function box(w, h, d, x, y, z) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

/** The steel frame of the dome: ribs from the ring at its base to the top, and three rings. */
function domeFrame(y0, h) {
  const parts = [];
  const ribs = 16;
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = (k / 10) * (Math.PI / 2);
      pts.push(new THREE.Vector3(TOWER.x + Math.cos(a) * TOWER.rx * 0.86 * Math.cos(t), y0 + h * Math.sin(t), TOWER.z + Math.sin(a) * TOWER.rz * 0.86 * Math.cos(t)));
    }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.09, 4, false));
  }
  for (const t of [0, 0.35, 0.7]) {
    const s = Math.cos(t * (Math.PI / 2)) * 0.86;
    const ring = new THREE.TorusGeometry(1, 0.08 / Math.min(TOWER.rx, TOWER.rz) / s, 4, 40);
    ring.rotateX(Math.PI / 2).scale(TOWER.rx * s, 1, TOWER.rz * s).translate(TOWER.x, y0 + h * Math.sin(t * (Math.PI / 2)), TOWER.z);
    parts.push(ring);
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()), false);
}

let shared = null;
function materials() {
  if (shared) return shared;
  const stone = stoneTexture();
  shared = {
    wall: new THREE.MeshLambertMaterial({ map: hallWallTexture(false), side: THREE.DoubleSide }),
    ruin: new THREE.MeshLambertMaterial({ map: hallWallTexture(true), alphaTest: 0.5, side: THREE.DoubleSide }),
    copper: new THREE.MeshStandardMaterial({ color: 0x5f9c86, roughness: 0.55, metalness: 0.35 }),
    roof: new THREE.MeshLambertMaterial({ color: 0x5a5550 }),
    trim: new THREE.MeshLambertMaterial({ color: 0xe8e0cd }),
    trimRuin: new THREE.MeshLambertMaterial({ color: 0x6d655c }),
    steel: new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.7, metalness: 0.5 }),
    rubble: new THREE.MeshLambertMaterial({ color: 0x6e655c, map: stone }),
    fence: new THREE.MeshLambertMaterial({ color: 0x2f3236 }),
  };
  return shared;
}

/** The hall as it stood on the morning of 6 August 1945. */
export function hallIntact() {
  const M = materials();
  const g = new THREE.Group();
  const { x1, z0, z1 } = HALL;
  const walls = [
    wallQuad(FRONT_X, z1, FRONT_X, z0, 0, BLOCK_H), // river front (faces west)
    wallQuad(x1, z0, x1, z1, 0, BLOCK_H), // back
    wallQuad(FRONT_X, z0, x1, z0, 0, BLOCK_H), // north side
    wallQuad(x1, z1, FRONT_X, z1, 0, BLOCK_H), // south side
    towerWall(0, TOWER_H),
  ];
  g.add(new THREE.Mesh(mergeGeometries(walls.map((w) => w.toNonIndexed()), false), M.wall));
  // cornices, the roof, the tower's cornice and the dome with its lantern
  const trim = [
    box(x1 - FRONT_X + 0.8, 0.6, z1 - z0 + 0.8, (FRONT_X + x1) / 2, BLOCK_H, (z0 + z1) / 2),
    box(x1 - FRONT_X + 0.4, 0.35, z1 - z0 + 0.4, (FRONT_X + x1) / 2, STOREY - 0.2, (z0 + z1) / 2),
  ];
  const corn = new THREE.CylinderGeometry(1.08, 1.08, 0.8, 40).scale(TOWER.rx, 1, TOWER.rz).translate(TOWER.x, TOWER_H + 0.4, TOWER.z);
  trim.push(corn);
  g.add(new THREE.Mesh(mergeGeometries(trim.map((w) => w.toNonIndexed()), false), M.trim));
  const roof = new THREE.CylinderGeometry(0.02, 1, 3, 4, 1).rotateY(Math.PI / 4).scale((x1 - FRONT_X) * 0.72, 1, (z1 - z0) * 0.72).translate((FRONT_X + x1) / 2 + 1, BLOCK_H + 0.6 + 1.5, (z0 + z1) / 2);
  g.add(new THREE.Mesh(roof, M.roof));
  const dome = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(TOWER.rx * 0.88, 6.5, TOWER.rz * 0.88).translate(TOWER.x, TOWER_H + 0.8, TOWER.z);
  const lantern = new THREE.CylinderGeometry(0.5, 0.7, 1.4, 12).translate(TOWER.x, TOWER_H + 0.8 + 6.5 + 0.5, TOWER.z);
  const tip = new THREE.ConeGeometry(0.35, 1.2, 12).translate(TOWER.x, TOWER_H + 0.8 + 6.5 + 1.8, TOWER.z);
  g.add(new THREE.Mesh(mergeGeometries([dome, lantern, tip].map((w) => w.toNonIndexed()), false), M.copper));
  return g;
}

/**
 * The ruin, as left on 6 August 1945 and kept ever since. `kept`: the park years (a low fence round it and the
 * rubble tidied into heaps inside).
 */
export function hallRuin(kept = false) {
  const M = materials();
  const g = new THREE.Group();
  const { x1, z0, z1 } = HALL;
  // standing walls: the river front in two pieces either side of the tower, short runs of the sides and back
  const walls = [
    wallQuad(FRONT_X, -1.5, FRONT_X, z0, 0, BLOCK_H - 1),
    wallQuad(FRONT_X, z1, FRONT_X, 9.5, 0, 8.5),
    wallQuad(FRONT_X, z0, 12, z0, 0, 9),
    wallQuad(16, z0, x1, z0, 0, 4.5),
    wallQuad(x1, z1, 14, z1, 0, 7),
    wallQuad(9, z1, FRONT_X, z1, 0, 10),
    wallQuad(x1, z0, x1, -2, 0, 5),
    wallQuad(x1, 8, x1, z1, 0, 3),
    towerWall(0, TOWER_H - 1),
  ];
  // the same walls a little inside, so they have a thickness
  const inner = [
    wallQuad(FRONT_X + 0.5, -1.5, FRONT_X + 0.5, z0 + 0.5, 0, BLOCK_H - 1),
    wallQuad(FRONT_X + 0.5, z1 - 0.5, FRONT_X + 0.5, 9.5, 0, 8.5),
    towerWall(0, TOWER_H - 1, 0.9),
  ];
  g.add(new THREE.Mesh(mergeGeometries([...walls, ...inner].map((w) => w.toNonIndexed()), false), M.ruin));
  // broken cornice stubs and the tower's ring at the base of the dome
  const stubs = [
    box(4, 0.5, 0.9, FRONT_X - 0.1, BLOCK_H - 1.5, z0 + 3),
    new THREE.CylinderGeometry(1.03, 1.03, 0.6, 40, 1, true).scale(TOWER.rx, 1, TOWER.rz).translate(TOWER.x, TOWER_H - 0.7, TOWER.z),
  ];
  g.add(new THREE.Mesh(mergeGeometries(stubs.map((w) => w.toNonIndexed()), false), M.trimRuin));
  g.add(new THREE.Mesh(domeFrame(TOWER_H - 0.5, 6.2), M.steel));
  // rubble heaps inside the walls
  const heaps = [];
  const rnd = mulberry(kept ? 4 : 3);
  for (let i = 0; i < (kept ? 10 : 26); i++) {
    const s = 1 + rnd() * 2.6;
    const geo = new THREE.DodecahedronGeometry(s, 0).scale(1, 0.45, 1).translate(FRONT_X + 2 + rnd() * (x1 - FRONT_X - 4), s * 0.2, z0 + 2 + rnd() * (z1 - z0 - 4));
    heaps.push(geo);
  }
  g.add(new THREE.Mesh(mergeGeometries(heaps.map((w) => w.toNonIndexed()), false), M.rubble));
  if (kept) {
    // a low iron fence round the ruin
    const fence = [];
    const fx0 = FRONT_X - 6, fx1 = x1 + 4, fz0 = z0 - 4, fz1 = z1 + 4;
    const run = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(len / 2.5);
      for (let i = 0; i <= n; i++) fence.push(box(0.08, 1.1, 0.08, ax + ((bx - ax) * i) / n, 0, az + ((bz - az) * i) / n));
      for (const y of [0.35, 1.0]) {
        const rail = new THREE.BoxGeometry(len, 0.05, 0.05).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, y, (az + bz) / 2);
        fence.push(rail);
      }
    };
    run(fx0, fz0, fx1, fz0);
    run(fx1, fz0, fx1, fz1);
    run(fx1, fz1, fx0, fz1);
    run(fx0, fz1, fx0, fz0);
    g.add(new THREE.Mesh(mergeGeometries(fence.map((w) => w.toNonIndexed()), false), M.fence));
  }
  return g;
}

/** The hall's footprint for walking (you cannot walk through it). */
export function hallFootprint(walk, ruin = false) {
  walk.block(FRONT_X, HALL.z0, HALL.x1, HALL.z1);
  walk.block(TOWER.x - TOWER.rx, TOWER.z - TOWER.rz, TOWER.x + TOWER.rx, TOWER.z + TOWER.rz);
  if (ruin) walk.block(FRONT_X - 6, HALL.z0 - 4, HALL.x1 + 4, HALL.z1 + 4, 0.2); // the fence (or the rubble)
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
