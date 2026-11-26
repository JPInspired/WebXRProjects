import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  WATER_Y, FORK_Z, OTA, MOTOYASU, HONKAWA, ISLAND, BRIDGE, HALL, HYPO, PARK, AIOI_ST, EAST_STREETS, ISLAND_STREETS,
  BOUNDS, inWater, onStreet, rng, WalkMap,
} from './layout.js';
import { houseTexture, roofTexture, facadeTexture, stoneTexture, barkTexture, leafTexture } from './textures.js';
import { hallIntact, hallRuin, hallFootprint } from './Hall.js';

// The city around the hall, built in code, once per moment:
//   before   the wooden city of 1945: about 2,700 houses and shops near you, thousands more further out
//   after    the same streets as rubble, charred posts, burnt trees, the gutted concrete buildings and the ruin
//   rebuilt  1958: new low houses on the east bank, the island turned into the Peace Memorial Park
//   today    a modern city of offices and flats, the park's trees grown, the Flame of Peace and the Peace Bell
// Everything that repeats (houses, roofs, trees, posts) is instanced, so the whole city is a few dozen draw calls.

const NEAR = { x0: BOUNDS.x0 - 70, x1: BOUNDS.x1 + 70, z0: BOUNDS.z0 - 70, z1: BOUNDS.z1 + 70 };
const FAR_R = 950; // houses (as larger clusters) reach this far from the hall
const HALL_AREA = { x0: -6, x1: 30, z0: -24, z1: 28 }; // the hall and its garden: no houses
const HYPO_SITE = { x0: 98, x1: 126, z0: 94, z1: 117 }; // Shima Hospital's plot

// ───────────── shared materials ─────────────

let M = null;
function mats() {
  if (M) return M;
  const roof = roofTexture();
  M = {
    house: new THREE.MeshLambertMaterial({ map: houseTexture(false) }),
    roof: new THREE.MeshLambertMaterial({ map: roof }),
    concrete: new THREE.MeshLambertMaterial({ map: facadeTexture('old') }),
    concreteBurnt: new THREE.MeshLambertMaterial({ map: facadeTexture('burnt') }),
    concreteNew: new THREE.MeshLambertMaterial({ map: facadeTexture('new') }),
    modern: new THREE.MeshLambertMaterial({ map: facadeTexture('modern') }),
    flatRoof: new THREE.MeshLambertMaterial({ color: 0x77736c }),
    rubble: new THREE.MeshLambertMaterial({ color: 0x5b534b }),
    char: new THREE.MeshLambertMaterial({ color: 0x1c1816 }),
    bark: new THREE.MeshLambertMaterial({ map: barkTexture(false) }),
    barkBurnt: new THREE.MeshLambertMaterial({ map: barkTexture(true) }),
    leaves: new THREE.MeshLambertMaterial({ map: leafTexture('#4f7a3c') }),
    stone: new THREE.MeshLambertMaterial({ map: stoneTexture() }),
    deck: new THREE.MeshLambertMaterial({ color: 0x8f8a80 }),
    rail: new THREE.MeshLambertMaterial({ color: 0xbdb7aa }),
    pole: new THREE.MeshLambertMaterial({ color: 0x4a443e }),
    wire: new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 }),
    track: new THREE.MeshLambertMaterial({ color: 0x3d3a36 }),
    white: new THREE.MeshLambertMaterial({ color: 0xe6e2d8 }),
    concreteLight: new THREE.MeshLambertMaterial({ color: 0xd2cdc2 }),
    darkStone: new THREE.MeshLambertMaterial({ color: 0x5f5d58 }),
    granite: new THREE.MeshStandardMaterial({ color: 0x9a958d, roughness: 0.6 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.45, metalness: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xb89a4e, roughness: 0.35, metalness: 0.8 }),
    flower: new THREE.MeshLambertMaterial({ color: 0xd8485f }),
  };
  return M;
}

// ───────────── unit shapes (1 m, scaled per instance) ─────────────

/** A quad from four corners with its own UV rectangle. */
function quad(a, b, c, d, u0, v0, u1, v1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  g.computeVertexNormals();
  return g;
}

/**
 * A house's walls: 1 m cube, base at 0, front facing +z. `front`: the u range of the street front in the house
 * texture (shop or home). Two storeys: the upper half of the front uses the upper-floor panel.
 */
function houseBody(front, storeys) {
  const [f0, f1] = front;
  const qs = [];
  if (storeys === 1) qs.push(quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5], f0, 0, f1, 1));
  else {
    qs.push(quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], f0, 0, f1, 1));
    qs.push(quad([-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5], 0.76, 0, 0.99, 1));
  }
  qs.push(quad([0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5], 0.51, 0, 0.74, 1)); // back
  qs.push(quad([0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], 0.51, 0, 0.74, 1)); // sides
  qs.push(quad([-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5], 0.51, 0, 0.74, 1));
  return mergeGeometries(qs, false);
}

/** A gable roof: ridge along x, 1 m wide, 1 m deep, 1 m high, its base at 0. */
function gableRoof() {
  const qs = [
    quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 1, 0], 0, 0, 1, 1),
    quad([0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 1, 0], 0, 0, 1, 1),
  ];
  // the gable ends (triangles), as dark boards
  const tri = (a, b, c) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0.52, 0.6, 0.6, 0.6, 0.56, 0.95], 2));
    g.computeVertexNormals();
    return g;
  };
  qs.push(tri([0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, 0]), tri([-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0]));
  return mergeGeometries(qs, false);
}

/** A little sloping eave over a two-storey house's ground floor (hisashi), on its street front. */
function eave() {
  return quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0.25, 0], [-0.5, 0.25, 0], 0, 0, 1, 0.25);
}

/** A rubble heap: a lumpy low mound, 1 m across, 1 m high at most. */
function rubbleHeap() {
  const g = new THREE.SphereGeometry(0.5, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  const r = rng(77);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = 0.75 + r() * 0.5;
    p.setXYZ(i, p.getX(i) * (1 + (r() - 0.5) * 0.3), y * 2 * k, p.getZ(i) * (1 + (r() - 0.5) * 0.3));
  }
  g.computeVertexNormals();
  return g;
}

// ───────────── instancing helpers ─────────────

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function instanced(geo, mat, list, { color = null } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  mesh.count = list.length;
  const anyColour = !!color || list.some((it) => it.c != null);
  list.forEach((it, i) => {
    _q.setFromAxisAngle(UP, it.ry ?? 0);
    if (it.tilt) _q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(it.tilt[0], 0, it.tilt[1])));
    mesh.setMatrixAt(i, _m.compose(_p.set(it.x, it.y ?? 0, it.z), _q, _s.set(it.sx, it.sy, it.sz)));
    if (anyColour) mesh.setColorAt(i, new THREE.Color(it.c ?? color ?? 0xffffff));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false; // spread over the whole city: never culled as one
  return mesh;
}

// ───────────── where the buildings go ─────────────

/**
 * Plots for buildings, on a lattice that is finer near you and coarser further out, kept off the streets, the
 * rivers, the hall's garden and anything else in `skip(x, z)`. Each plot faces its nearest street.
 */
function plots(seed, skip) {
  const r = rng(seed);
  const out = [];
  const lattice = (x0, x1, z0, z1, sx, sz, far) => {
    for (let z = z0; z < z1; z += sz) {
      for (let x = x0; x < x1; x += sx) {
        const px = x + (r() - 0.5) * 1.2, pz = z + (r() - 0.5) * 1.2;
        if (far) {
          const d = Math.hypot(px - 40, pz - 80);
          if (d > FAR_R || (px > NEAR.x0 && px < NEAR.x1 && pz > NEAR.z0 && pz < NEAR.z1)) continue;
          if (r() < 0.12) continue;
        } else if (r() < 0.03) continue; // the odd gap: a yard, a lot being cleared
        const half = far ? 9 : 5;
        if (inWater(px, pz) || inWater(px + half, pz) || inWater(px - half, pz) || inWater(px, pz + half) || inWater(px, pz - half)) continue;
        if (onStreet(px, pz) || onStreet(px + 2.6, pz) || onStreet(px - 2.6, pz) || onStreet(px, pz + 3.2) || onStreet(px, pz - 3.2)) continue;
        if (skip(px, pz)) continue;
        out.push({ x: px, z: pz, far, facing: facing(px, pz), r: r() });
      }
    }
  };
  lattice(NEAR.x0, NEAR.x1, NEAR.z0, NEAR.z1, 7.6, 9.4, false);
  lattice(-FAR_R + 40, FAR_R + 40, -FAR_R + 80, FAR_R + 80, 19, 23, true);
  return out;
}

/** Which way a plot faces: towards the nearest street (0 = south, π = north, ±π/2 = east / west). */
function facing(x, z) {
  const island = x < MOTOYASU.x0 && x > HONKAWA.x1 && z > FORK_Z;
  const S = island ? ISLAND_STREETS : EAST_STREETS;
  let best = Infinity, ry = 0;
  for (const sx of S.ns) { const d = Math.abs(x - sx); if (d < best) { best = d; ry = x < sx ? Math.PI / 2 : -Math.PI / 2; } }
  for (const sz of [...S.ew, AIOI_ST.z]) { const d = Math.abs(z - sz); if (d < best) { best = d; ry = z < sz ? 0 : Math.PI; } }
  return best < 30 ? ry : (Math.floor(x / 7 + z / 13) % 2 ? 0 : Math.PI);
}

const inRect = (x, z, R, m = 0) => x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m;
const onIsland = (x, z) => x > ISLAND.x0 && x < ISLAND.x1 && z > ISLAND.z0;
const PARK_AREA = { x0: ISLAND.x0, x1: ISLAND.x1, z0: FORK_Z, z1: 360 };

// ───────────── the city ─────────────

export class City {
  constructor(app) {
    this.app = app;
    this.root = new THREE.Group();
    app.scene.add(this.root);
    mats();
    this.geo = {
      body: [[0, 0.25], [0.25, 0.5]].flatMap((front) => [1, 2].map((st) => houseBody(front, st))), // shop 1F, shop 2F, home 1F, home 2F
      roof: gableRoof(),
      eave: eave(),
      box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      heap: rubbleHeap(),
      trunk: new THREE.CylinderGeometry(0.6, 1, 1, 7, 1).translate(0, 0.5, 0),
      canopy: new THREE.IcosahedronGeometry(1, 1),
    };
    this.buildStatic();
    this.eras = {};
    this.current = null;
  }

  // ───────────── what never changes: rivers, embankments, hills ─────────────

  buildStatic() {
    const g = new THREE.Group();
    this.root.add(g);
    // the rivers' water: a gently moving surface (see water())
    this.water = water();
    for (const [x0, x1, z0, z1] of [[OTA.x0, OTA.x1, -2500, FORK_Z], [MOTOYASU.x0, MOTOYASU.x1, FORK_Z, 2500], [HONKAWA.x0, HONKAWA.x1, FORK_Z, 2500]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, WATER_Y, (z0 + z1) / 2), this.water);
      g.add(p);
    }
    // the stone embankments down to the water, with a coping along the top
    const walls = [];
    const coping = [];
    const bank = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const h = -WATER_Y + 1.2;
      const w = new THREE.PlaneGeometry(len, h);
      const uv = w.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 4, uv.getY(i) * h / 4);
      w.rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, WATER_Y - 1.2 + h / 2, (z0 + z1) / 2);
      walls.push(w);
      coping.push(new THREE.BoxGeometry(len, 0.25, 0.6).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, 0.02, (z0 + z1) / 2));
    };
    // (each wall faces the water: the plane's front is to the left of the direction drawn)
    bank(OTA.x1, FORK_Z, OTA.x1, -2500); // east bank, north of the fork
    bank(MOTOYASU.x1, 2500, MOTOYASU.x1, FORK_Z); // east bank, south
    bank(MOTOYASU.x0, FORK_Z, MOTOYASU.x0, 2500); // island, east side
    bank(HONKAWA.x1, 2500, HONKAWA.x1, FORK_Z); // island, west side
    bank(HONKAWA.x1, FORK_Z, MOTOYASU.x0, FORK_Z); // the island's tip
    bank(HONKAWA.x0, FORK_Z, HONKAWA.x0, 2500); // west bank, south
    bank(OTA.x0, -2500, OTA.x0, FORK_Z); // west bank, north
    bank(OTA.x0, FORK_Z, HONKAWA.x0, FORK_Z);
    const wm = M.stone.clone();
    wm.side = THREE.DoubleSide;
    g.add(new THREE.Mesh(mergeGeometries(walls.map((x) => x.toNonIndexed()), false), wm));
    g.add(new THREE.Mesh(mergeGeometries(coping.map((x) => x.toNonIndexed()), false), M.concreteLight));
    // the mountains round the city (Hiroshima sits in a bowl of hills, open to the sea in the south)
    g.add(hills());
    // the bridge's piers stand in every moment
    const piers = [];
    for (let x = BRIDGE.x0 + 18; x < BRIDGE.x1 - 6; x += 22) for (const dz of [-7, 7]) piers.push(new THREE.CylinderGeometry(1.2, 1.4, 6, 10).translate(x, WATER_Y - 1, BRIDGE.z + dz));
    for (let z = BRIDGE.stem.z0 + 6; z < BRIDGE.stem.z1; z += 10) piers.push(new THREE.CylinderGeometry(1.1, 1.3, 6, 10).translate(BRIDGE.stem.x, WATER_Y - 1, z));
    g.add(new THREE.Mesh(mergeGeometries(piers.map((x) => x.toNonIndexed()), false), M.darkStone));
    this.static = g;
  }

  // ───────────── one moment ─────────────

  /** Show one moment (building it the first time). Returns its walk map. */
  show(era) {
    for (const [k, e] of Object.entries(this.eras)) e.group.visible = k === era;
    const e = (this.eras[era] ??= this.build(era));
    e.group.visible = true;
    this.current = e;
    return e;
  }

  build(era) {
    const group = new THREE.Group();
    this.root.add(group);
    const walk = new WalkMap();
    const e = { era, group, walk, ground: null, trams: [], fires: [], update: null };
    e.ground = ground(era);
    group.add(e.ground);
    group.add(this.bridge(era));
    if (era === 'before' || era === 'blast') this.buildBefore(e);
    else if (era === 'after') this.buildAfter(e);
    else this.buildPeace(e, era);
    return e;
  }

  // ───────────── 1945, the morning ─────────────

  buildBefore(e) {
    const { group, walk } = e;
    const hall = hallIntact();
    group.add(hall);
    e.hall = hall;
    e.hallRuin = hallRuin(false); // (shown when the blast reaches it)
    e.hallRuin.visible = false;
    group.add(e.hallRuin);
    hallFootprint(walk, false);
    const list = plots(1, (x, z) => inRect(x, z, HALL_AREA) || inRect(x, z, HYPO_SITE, 4));
    const bodies = [[], [], [], []];
    const roofs = [], eaves = [], concrete = [], flat = [];
    const r = rng(2);
    for (const p of list) {
      const conc = !p.far && (Math.abs(p.z - AIOI_ST.z) < 30 || (p.x > 60 && p.x < 180 && p.z > 20 && p.z < 140)) && p.r < 0.12;
      const turned = Math.abs(Math.sin(p.facing)) > 0.5;
      if (conc) {
        const w = 7 + r() * 0.5, d = 8.6 + r() * 0.5, h = 8 + Math.floor(r() * 3) * 4;
        concrete.push({ x: p.x, z: p.z, sx: w, sy: h, sz: d, ry: p.facing });
        flat.push({ x: p.x, y: h, z: p.z, sx: w + 0.4, sy: 0.4, sz: d + 0.4, ry: p.facing });
        walk.block(p.x - (turned ? d : w) / 2, p.z - (turned ? w : d) / 2, p.x + (turned ? d : w) / 2, p.z + (turned ? w : d) / 2);
        continue;
      }
      const w = p.far ? 15 + r() * 3 : 5.6 + r() * 1.6;
      const d = p.far ? 18 + r() * 4 : (turned ? 6.0 : 7.2) + r() * 1.6;
      const st = p.far ? 1 + (r() < 0.3) : r() < 0.45 ? 2 : 1;
      const h = st === 2 ? 5.6 + r() * 0.6 : 3.1 + r() * 0.4;
      const shop = !p.far && (onStreet(p.x, p.z + 7) || onStreet(p.x, p.z - 7) || onStreet(p.x + 7, p.z) || onStreet(p.x - 7, p.z)) && r() < 0.6;
      const tone = new THREE.Color().setHSL(0.07 + r() * 0.03, 0.18 + r() * 0.12, 0.62 + r() * 0.25);
      bodies[(shop ? 0 : 2) + (st - 1)].push({ x: p.x, z: p.z, sx: w, sy: h, sz: d, ry: p.facing, c: tone, dist: Math.hypot(p.x - HYPO.x, p.z - HYPO.z) });
      const rt = new THREE.Color().setHSL(0.6, 0.06 + r() * 0.06, 0.55 + r() * 0.25);
      roofs.push({ x: p.x, y: h, z: p.z, sx: w + 0.7, sy: 1.6 + d * 0.12, sz: d + 0.9, ry: p.facing, c: rt, dist: Math.hypot(p.x - HYPO.x, p.z - HYPO.z) });
      if (st === 2 && !p.far) {
        const off = new THREE.Vector3(0, 0, d / 2 + 0.35).applyAxisAngle(UP, p.facing);
        eaves.push({ x: p.x + off.x, y: 2.7, z: p.z + off.z, sx: w + 0.3, sy: 1, sz: 1.4, ry: p.facing, c: rt, dist: Math.hypot(p.x - HYPO.x, p.z - HYPO.z) });
      }
      if (!p.far) walk.block(p.x - (turned ? d : w) / 2, p.z - (turned ? w : d) / 2, p.x + (turned ? d : w) / 2, p.z + (turned ? w : d) / 2);
    }
    // Shima Hospital: a two-storey brick building in its own plot
    concrete.push({ x: 112, z: 106, sx: 22, sy: 8, sz: 16, ry: 0, c: 0xd9b9a0 });
    flat.push({ x: 112, y: 8, z: 106, sx: 22.6, sy: 0.5, sz: 16.6, ry: 0 });
    walk.block(101, 98, 123, 114);
    const houses = [];
    bodies.forEach((b, i) => { if (b.length) houses.push({ mesh: instanced(this.geo.body[i], M.house, b), list: b }); });
    houses.push({ mesh: instanced(this.geo.roof, M.roof, roofs), list: roofs, roof: true });
    houses.push({ mesh: instanced(this.geo.eave, M.roof, eaves), list: eaves, roof: true });
    houses.push({ mesh: instanced(this.geo.box, M.concrete, concrete), list: concrete, concrete: true });
    houses.push({ mesh: instanced(this.geo.box, M.flatRoof, flat), list: flat, concrete: true });
    for (const h of houses) group.add(h.mesh);
    e.houses = houses; // (the blast moves these: see Blast.js)
    e.trees = this.trees(e, 'before');
    this.trams(e, 'before');
    this.wires(e);
  }

  // ───────────── 1945, the afternoon ─────────────

  buildAfter(e) {
    const { group, walk } = e;
    group.add(hallRuin(false));
    hallFootprint(walk, true);
    const list = plots(1, (x, z) => inRect(x, z, HALL_AREA) || inRect(x, z, HYPO_SITE, 4));
    const heaps = [], posts = [], shells = [];
    const r = rng(2);
    for (const p of list) {
      const conc = !p.far && (Math.abs(p.z - AIOI_ST.z) < 30 || (p.x > 60 && p.x < 180 && p.z > 20 && p.z < 140)) && p.r < 0.12;
      const turned = Math.abs(Math.sin(p.facing)) > 0.5;
      if (conc) {
        // concrete buildings: many stood as gutted shells
        const w = 7 + r() * 0.5, d = 8.6 + r() * 0.5, h = 8 + Math.floor(r() * 3) * 4;
        shells.push({ x: p.x, z: p.z, sx: w, sy: h * (0.6 + r() * 0.4), sz: d, ry: p.facing });
        walk.block(p.x - (turned ? d : w) / 2, p.z - (turned ? w : d) / 2, p.x + (turned ? d : w) / 2, p.z + (turned ? w : d) / 2);
        continue;
      }
      const w = p.far ? 15 + r() * 3 : 5.6 + r() * 1.6;
      const d = p.far ? 18 + r() * 4 : 7 + r() * 1.6;
      const tone = new THREE.Color().setHSL(0.06, 0.08 + r() * 0.1, 0.18 + r() * 0.22);
      heaps.push({ x: p.x, z: p.z, sx: w * 1.1, sy: 0.6 + r() * 1.1, sz: d * 1.05, ry: p.facing + (r() - 0.5) * 0.4, c: tone });
      if (!p.far && r() < 0.35) {
        for (let k = 0; k < 2; k++) posts.push({ x: p.x + (r() - 0.5) * w * 0.7, z: p.z + (r() - 0.5) * d * 0.7, sx: 0.16, sy: 1.5 + r() * 2.2, sz: 0.16, ry: r() * 3, tilt: [(r() - 0.5) * 0.7, (r() - 0.5) * 0.7] });
      }
      if (!p.far) walk.block(p.x - (turned ? d : w) / 2 + 0.8, p.z - (turned ? w : d) / 2 + 0.8, p.x + (turned ? d : w) / 2 - 0.8, p.z + (turned ? w : d) / 2 - 0.8);
    }
    shells.push({ x: 112, z: 106, sx: 22, sy: 4.5, sz: 16, ry: 0 });
    walk.block(101, 98, 123, 114);
    group.add(instanced(this.geo.heap, M.rubble, heaps));
    group.add(instanced(this.geo.box, M.char, posts));
    group.add(instanced(this.geo.box, M.concreteBurnt, shells));
    e.trees = this.trees(e, 'after');
    this.trams(e, 'after');
    // fires still burning here and there, and their smoke (drawn by Smoke.js, placed here)
    const fr = rng(12);
    for (let i = 0; i < 46; i++) {
      const p = list[Math.floor(fr() * list.length)];
      if (Math.hypot(p.x, p.z) > 600) continue;
      e.fires.push({ x: p.x, z: p.z, size: p.far ? 3 : 1.5 + fr() * 1.5 });
    }
  }

  // ───────────── 1958 and today ─────────────

  buildPeace(e, era) {
    const { group, walk } = e;
    const today = era === 'today';
    group.add(hallRuin(true));
    hallFootprint(walk, true);
    // the east bank and the far city: new houses in 1958; offices and flats today
    const list = plots(today ? 5 : 4, (x, z) => inRect(x, z, HALL_AREA, 6) || inRect(x, z, PARK_AREA) || (onIsland(x, z) && z < 1400 && z > FORK_Z && x > ISLAND.x0 && x < ISLAND.x1 && z < 420));
    const r = rng(today ? 6 : 3);
    const bodies = [[], [], [], []], roofs = [], blocks = [], flat = [];
    for (const p of list) {
      const turned = Math.abs(Math.sin(p.facing)) > 0.5;
      const big = today ? r() < (p.far ? 0.5 : 0.55) : r() < (Math.abs(p.z - AIOI_ST.z) < 40 ? 0.45 : 0.12);
      if (big) {
        const storeys = today ? 4 + Math.floor(r() * r() * 12) : 3 + Math.floor(r() * 2);
        const w = p.far ? 17 : 7 + r() * 0.8, d = p.far ? 19 : 8.6 + r() * 0.6, h = storeys * 3.4;
        blocks.push({ x: p.x, z: p.z, sx: w, sy: h, sz: d, ry: p.facing, c: today ? new THREE.Color().setHSL([0.08, 0.1, 0.58, 0.0][Math.floor(r() * 4)], 0.08 + r() * 0.12, 0.62 + r() * 0.3) : new THREE.Color().setHSL(0.1, 0.1, 0.78 + r() * 0.15) });
        flat.push({ x: p.x, y: h, z: p.z, sx: w + 0.3, sy: 0.3, sz: d + 0.3, ry: p.facing });
        if (!p.far) walk.block(p.x - (turned ? d : w) / 2, p.z - (turned ? w : d) / 2, p.x + (turned ? d : w) / 2, p.z + (turned ? w : d) / 2);
        continue;
      }
      const w = p.far ? 15 : 5.8 + r() * 1.6, d = p.far ? 18 : 7 + r() * 1.6;
      const st = r() < 0.5 ? 2 : 1;
      const h = st === 2 ? 5.8 : 3.3;
      const tone = new THREE.Color().setHSL(0.08, 0.15, today ? 0.85 : 0.75 + r() * 0.2);
      bodies[(r() < 0.4 ? 0 : 2) + (st - 1)].push({ x: p.x, z: p.z, sx: w, sy: h, sz: d, ry: p.facing, c: tone });
      roofs.push({ x: p.x, y: h, z: p.z, sx: w + 0.6, sy: 1.5 + d * 0.1, sz: d + 0.8, ry: p.facing, c: new THREE.Color().setHSL(0.6, 0.1, today ? 0.5 : 0.62 + r() * 0.2) });
      if (!p.far) walk.block(p.x - (turned ? d : w) / 2, p.z - (turned ? w : d) / 2, p.x + (turned ? d : w) / 2, p.z + (turned ? w : d) / 2);
    }
    bodies.forEach((b, i) => { if (b.length) group.add(instanced(this.geo.body[i], M.house, b)); });
    group.add(instanced(this.geo.roof, M.roof, roofs));
    group.add(instanced(this.geo.box, today ? M.modern : M.concreteNew, blocks));
    group.add(instanced(this.geo.box, M.flatRoof, flat));
    group.add(this.park(walk, era));
    e.trees = this.trees(e, era);
    this.trams(e, era);
    this.wires(e);
  }

  /** The Peace Memorial Park on the island: museum, Cenotaph, the Children's Peace Monument, and (from 1964) the Flame and the Bell. */
  park(walk, era) {
    const today = era === 'today';
    const g = new THREE.Group();
    const axis = new THREE.Vector2(HALL.tower[0] - PARK.cenotaph[0], HALL.tower[1] - PARK.cenotaph[1]).normalize();
    const ry = Math.atan2(-axis.x, -axis.y); // turns −z (forward) to look along the axis towards the Dome
    const place = (obj, [x, z], rot = ry) => { obj.position.set(x, 0, z); obj.rotation.y = rot; g.add(obj); return obj; };
    // the museum: a long building raised on pillars, across the axis
    const museum = new THREE.Group();
    const L = 82, D = 18, Y0 = 6.5, H = 7;
    museum.add(new THREE.Mesh(new THREE.BoxGeometry(L, H, D).translate(0, Y0 + H / 2, 0), new THREE.MeshLambertMaterial({ map: facadeTexture(today ? 'modern' : 'new') })));
    museum.add(new THREE.Mesh(new THREE.BoxGeometry(L + 1, 0.5, D + 1).translate(0, Y0 + H, 0), M.concreteLight));
    const pillars = [];
    for (let i = 0; i < 10; i++) for (const dz of [-6, 6]) pillars.push(new THREE.BoxGeometry(1.2, Y0, 1.6).translate(-L / 2 + 4 + i * ((L - 8) / 9), Y0 / 2, dz));
    museum.add(new THREE.Mesh(mergeGeometries(pillars, false), M.concreteLight));
    place(museum, PARK.museum);
    walk.block(PARK.museum[0] - 6, PARK.museum[1] - 6, PARK.museum[0] + 6, PARK.museum[1] + 6); // (only its middle: the pillars are open between)
    // the Cenotaph: a low saddle-shaped arch over a stone chest
    const cen = new THREE.Group();
    // (a saddle: the arch is wide and low, and thicker where it meets the ground)
    const arch = new THREE.TorusGeometry(4.2, 0.6, 10, 32, Math.PI).scale(1, 0.78, 1.8);
    cen.add(new THREE.Mesh(arch, M.concreteLight));
    cen.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.0).translate(0, 0.5, 0), M.darkStone));
    cen.add(new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 5).translate(0, 0.07, 0), M.granite));
    place(cen, PARK.cenotaph, ry); // (you look through it along the axis, to the Dome)
    walk.block(PARK.cenotaph[0] - 4.5, PARK.cenotaph[1] - 2.5, PARK.cenotaph[0] + 4.5, PARK.cenotaph[1] + 2.5);
    // the pond on the axis between the Cenotaph and the Flame
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(9, 22).rotateX(-Math.PI / 2), this.water);
    pond.position.set((PARK.cenotaph[0] + PARK.flame[0]) / 2, 0.03, (PARK.cenotaph[1] + PARK.flame[1]) / 2);
    pond.rotation.y = ry;
    g.add(pond);
    // the Children's Peace Monument: three legs, the girl holding up a golden crane, the crane booths beside it
    const mon = new THREE.Group();
    // three slender legs arching up from a wide stance to meet under the statue (an open, bell-like frame)
    const legs = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const rad = 2.7 * Math.cos(t * Math.PI * 0.5) ** 0.8 + 0.25;
        pts.push(new THREE.Vector3(Math.cos(a) * rad, 1.2 + t * 6.0, Math.sin(a) * rad));
      }
      legs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.32, 8, false));
    }
    mon.add(new THREE.Mesh(mergeGeometries(legs.map((g) => g.toNonIndexed()), false), M.granite));
    // the small bronze bell hanging inside (with the crane-shaped gong), and the two children on the legs
    mon.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.6, 14).translate(0, 4.4, 0), M.bronze));
    mon.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 8).translate(0, 7.9, 0), M.bronze));
    mon.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6).translate(0, 9.0, 0), M.bronze)); // her arms raised
    mon.add(new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.25, 4).rotateX(Math.PI / 2).translate(0, 9.55, 0), M.gold)); // the golden crane
    mon.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 1.2, 16).translate(0, 0.6, 0), M.granite));
    place(mon, PARK.monument, 0);
    walk.block(PARK.monument[0] - 3.3, PARK.monument[1] - 3.3, PARK.monument[0] + 3.3, PARK.monument[1] + 3.3);
    // glass booths for the paper cranes, behind the monument
    const booths = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 1.2).translate(0, 1.2, 0), new THREE.MeshLambertMaterial({ color: 0xb9c7cf, transparent: true, opacity: 0.35 }));
      b.position.set(-6 + i * 3, 0, -7);
      booths.add(b);
    }
    booths.position.set(PARK.monument[0], 0, PARK.monument[1]);
    g.add(booths);
    walk.block(PARK.monument[0] - 7.5, PARK.monument[1] - 8, PARK.monument[0] + 7.5, PARK.monument[1] - 6);
    this.craneAnchor = new THREE.Vector3(PARK.monument[0], 0, PARK.monument[1] - 7); // the booths' middle
    if (today) {
      // the Flame of Peace: a stone basin like two hands held open
      const flame = new THREE.Group();
      flame.add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 0.8, 1.3, 16, 1, true).translate(0, 1.1, 0), M.granite));
      flame.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 0.5, 16).translate(0, 0.25, 0), M.granite));
      place(flame, PARK.flame, 0);
      walk.block(PARK.flame[0] - 2, PARK.flame[1] - 2, PARK.flame[0] + 2, PARK.flame[1] + 2);
      // the Peace Bell under its little dome roof, with the log to ring it
      const bell = new THREE.Group();
      bell.add(new THREE.Mesh(new THREE.SphereGeometry(3, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(0, 4.4, 0), M.concreteLight));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        bell.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.4, 0.4).translate(Math.cos(a) * 2.3, 2.2, Math.sin(a) * 2.3), M.concreteLight));
      }
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.7, 20).translate(0, 2.55, 0), M.bronze);
      bell.add(b);
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 10).rotateZ(Math.PI / 2).translate(-1.9, 2.2, 0), M.bark);
      log.userData.bell = true;
      bell.add(log);
      place(bell, PARK.bell, 0);
      walk.block(PARK.bell[0] - 2.6, PARK.bell[1] - 2.6, PARK.bell[0] + 2.6, PARK.bell[1] + 2.6);
      this.bellLog = log;
      this.bellBody = b;
    }
    // oleanders in flower along the riverside
    const flowers = [];
    const fr = rng(today ? 8 : 9);
    for (let z = FORK_Z + 20; z < 330; z += 7) {
      for (const x of [ISLAND.x1 - 4, ISLAND.x0 + 4]) {
        if (fr() < 0.35) continue;
        flowers.push({ x: x + (fr() - 0.5) * 2, y: 0.9, z, sx: 1.2 + fr() * 0.6, sy: 1, sz: 1.2 + fr() * 0.6, c: fr() < 0.5 ? 0xd8485f : 0xe98aa0 });
      }
    }
    g.add(instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), flowers));
    return g;
  }

  // ───────────── trees ─────────────

  trees(e, era) {
    const r = rng(era === 'today' ? 15 : 14);
    const list = [];
    // willows and pines along the riverside paths, a few in the hall's garden and in the streets
    for (let z = -140; z < 330; z += 20 + r() * 10) list.push({ x: -16.2 + r() * 0.8, z, kind: 'willow' });
    for (let x = -4; x < 26; x += 7) list.push({ x, z: -20 + r() * 2, kind: 'pine' }), list.push({ x, z: 25 + r() * 2, kind: 'pine' });
    for (let i = 0; i < 140; i++) {
      const x = -10 + r() * 260, z = -140 + r() * 460;
      if (onStreet(x, z) || inWater(x, z) || r() < 0.6) continue;
      list.push({ x, z, kind: r() < 0.4 ? 'pine' : 'leafy' });
    }
    if (era === 'rebuilt' || era === 'today') {
      // the park's trees (young in 1958, grown today)
      for (let i = 0; i < 260; i++) {
        const x = ISLAND.x0 + 6 + r() * (ISLAND.x1 - ISLAND.x0 - 12), z = FORK_Z + 10 + r() * 330;
        const nearAxis = Math.abs((x - PARK.cenotaph[0]) * 0.92 + (z - PARK.cenotaph[1]) * 0.39) < 22;
        if (nearAxis || r() < 0.3 || Math.hypot(x - PARK.monument[0], z - PARK.monument[1]) < 14 || Math.hypot(x - PARK.bell[0], z - PARK.bell[1]) < 8) continue;
        list.push({ x, z, kind: r() < 0.3 ? 'pine' : 'leafy', park: true });
      }
    }
    const trunks = [], crowns = [];
    const burnt = era === 'after';
    for (const t of list) {
      const young = era === 'rebuilt' && t.park;
      const s = (young ? 0.45 : 1) * (0.8 + r() * 0.5);
      const h = (t.kind === 'pine' ? 7 : t.kind === 'willow' ? 6 : 8) * s;
      if (burnt) {
        // the blast stripped and charred the trees; many were snapped
        trunks.push({ x: t.x, z: t.z, sx: 0.28 * s, sy: h * (0.35 + r() * 0.5), sz: 0.28 * s, ry: r() * 6, tilt: [(r() - 0.5) * 0.3, (r() - 0.5) * 0.3] });
        continue;
      }
      trunks.push({ x: t.x, z: t.z, sx: 0.25 * s, sy: h * 0.7, sz: 0.25 * s, ry: r() * 6 });
      const tone = () => new THREE.Color().setHSL(t.kind === 'pine' ? 0.3 : t.kind === 'willow' ? 0.2 : 0.26, 0.28 + r() * 0.1, (era === 'today' ? 0.42 : 0.38) + r() * 0.14);
      const clumps = t.kind === 'pine' ? 4 : 3;
      for (let k = 0; k < clumps; k++) {
        const a = r() * Math.PI * 2, o = (k === 0 ? 0 : 0.9 + r() * 0.5) * s;
        if (t.kind === 'willow') crowns.push({ x: t.x + Math.cos(a) * o, y: h * (0.45 + r() * 0.2), z: t.z + Math.sin(a) * o, sx: 1.8 * s, sy: 2.6 * s, sz: 1.8 * s, ry: r() * 6, c: tone() });
        else if (t.kind === 'pine') crowns.push({ x: t.x + Math.cos(a) * o * 1.6, y: h * (0.62 + k * 0.1), z: t.z + Math.sin(a) * o * 1.6, sx: 1.7 * s, sy: 0.7 * s, sz: 1.5 * s, ry: r() * 6, c: tone() });
        else crowns.push({ x: t.x + Math.cos(a) * o, y: h * (0.68 + r() * 0.15), z: t.z + Math.sin(a) * o, sx: 2.3 * s, sy: 1.9 * s, sz: 2.3 * s, ry: r() * 6, c: tone() });
      }
      e.walk.block(t.x - 0.3, t.z - 0.3, t.x + 0.3, t.z + 0.3, 0.1);
    }
    const dist = (it) => (it.dist = Math.hypot(it.x - HYPO.x, it.z - HYPO.z));
    trunks.forEach(dist);
    crowns.forEach(dist);
    const trunkMesh = instanced(this.geo.trunk, burnt ? M.barkBurnt : M.bark, trunks);
    e.group.add(trunkMesh);
    e.treeMeshes = [{ mesh: trunkMesh, list: trunks, tree: true }];
    if (crowns.length) {
      const crownMesh = instanced(this.geo.canopy, M.leaves, crowns);
      e.group.add(crownMesh);
      e.treeMeshes.push({ mesh: crownMesh, list: crowns, crown: true });
    }
    return list;
  }

  // ───────────── the bridge, the trams and their wires ─────────────

  bridge(era) {
    const g = new THREE.Group();
    const broken = era === 'after';
    const z = BRIDGE.z, w = BRIDGE.w, s = BRIDGE.stem;
    const deck = [new THREE.BoxGeometry(BRIDGE.x1 - BRIDGE.x0, 1.4, w).translate((BRIDGE.x0 + BRIDGE.x1) / 2, -0.72, z), new THREE.BoxGeometry(s.w, 1.4, s.z1 - s.z0 - w / 2).translate(s.x, -0.72, (s.z0 + w / 2 + s.z1) / 2)];
    g.add(new THREE.Mesh(mergeGeometries(deck, false), M.deck));
    // the tram tracks down the middle
    const tracks = [];
    for (const dz of [-2.4, 2.4]) tracks.push(new THREE.BoxGeometry(BRIDGE.x1 - BRIDGE.x0 + 520, 0.02, 1.6).translate((BRIDGE.x0 + BRIDGE.x1 + 520) / 2, 0.01, z + dz));
    g.add(new THREE.Mesh(mergeGeometries(tracks, false), M.track));
    // the balustrades (the blast tore long stretches of them away)
    const rails = [];
    const r = rng(era.length);
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.floor(len / 2.2);
      const ry = -Math.atan2(z1 - z0, x1 - x0);
      for (let i = 0; i < n; i++) {
        if (broken && r() < 0.45) continue;
        const t = (i + 0.5) / n;
        rails.push(new THREE.BoxGeometry(2.1, 0.95, 0.3).translate(0, 0.475, 0).rotateY(ry).translate(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t));
      }
    };
    run(BRIDGE.x0, z - w / 2 + 0.2, BRIDGE.x1, z - w / 2 + 0.2);
    run(BRIDGE.x0, z + w / 2 - 0.2, s.x - s.w / 2, z + w / 2 - 0.2);
    run(s.x + s.w / 2, z + w / 2 - 0.2, BRIDGE.x1, z + w / 2 - 0.2);
    run(s.x - s.w / 2 + 0.2, z + w / 2, s.x - s.w / 2 + 0.2, s.z1);
    run(s.x + s.w / 2 - 0.2, z + w / 2, s.x + s.w / 2 - 0.2, s.z1);
    g.add(new THREE.Mesh(mergeGeometries(rails, false), M.rail));
    return g;
  }

  /** Trams along Aioi-dori and over the bridge: running in the morning, a burnt-out one after, running again later. */
  trams(e, era) {
    const body = era === 'today' ? 0xd9dde3 : era === 'rebuilt' ? 0x3f7a57 : era === 'after' ? 0x231d1a : 0x4c6b4f;
    const top = era === 'today' ? 0x2f6fb0 : era === 'after' ? 0x2b2522 : 0xd9cfb0;
    const make = () => {
      const t = new THREE.Group();
      const L = era === 'today' ? 26 : 12;
      t.add(new THREE.Mesh(new THREE.BoxGeometry(L, 1.6, 2.3).translate(0, 0.9, 0), new THREE.MeshLambertMaterial({ color: body })));
      t.add(new THREE.Mesh(new THREE.BoxGeometry(L, 1.2, 2.3).translate(0, 2.3, 0), new THREE.MeshLambertMaterial({ color: top })));
      const win = new THREE.MeshLambertMaterial({ color: era === 'after' ? 0x050505 : 0x2a3846 });
      for (const dz of [-1.16, 1.16]) t.add(new THREE.Mesh(new THREE.BoxGeometry(L - 1.2, 0.8, 0.02).translate(0, 2.3, dz), win));
      t.add(new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.2, 2.5).translate(0, 3.0, 0), new THREE.MeshLambertMaterial({ color: 0x555049 })));
      if (era !== 'after') t.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.6).rotateX(0.5).translate(-L / 4, 4.0, 0).rotateY(Math.PI / 2), M.pole));
      return t;
    };
    if (era === 'after') {
      const t = make();
      t.position.set(-70, 0, BRIDGE.z + 2.4);
      t.rotation.z = 0.02;
      e.group.add(t);
      e.walk.block(-77, BRIDGE.z + 1, -63, BRIDGE.z + 3.8);
      return;
    }
    for (const [x, dir, lane] of [[-200, 1, 2.4], [140, -1, -2.4]]) {
      const t = make();
      t.position.set(x, 0, BRIDGE.z + lane);
      e.group.add(t);
      e.trams.push({ mesh: t, dir, lane, speed: 5 + Math.random() * 2, wait: 0 });
    }
  }

  /** Tram poles and overhead wires along Aioi-dori and the bridge. */
  wires(e) {
    const poles = [];
    const pts = [];
    for (let x = BRIDGE.x0; x < 520; x += 25) {
      for (const dz of [-BRIDGE.w / 2 + 0.6, BRIDGE.w / 2 - 0.6]) poles.push(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 6).translate(x, 3.75, BRIDGE.z + dz));
      for (const dz of [-2.4, 2.4]) pts.push(x, 6.4, BRIDGE.z + dz, x + 25, 6.4, BRIDGE.z + dz);
      pts.push(x, 6.9, BRIDGE.z - BRIDGE.w / 2 + 0.6, x, 6.9, BRIDGE.z + BRIDGE.w / 2 - 0.6);
    }
    e.group.add(new THREE.Mesh(mergeGeometries(poles, false), M.pole));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    e.group.add(new THREE.LineSegments(lg, M.wire));
  }

  /** Every frame: the water moves, the trams run. */
  update(dt, t) {
    this.water.uniforms.time.value = t;
    const e = this.current;
    if (!e) return;
    for (const tr of e.trams) {
      if (tr.wait > 0) { tr.wait -= dt; continue; }
      tr.mesh.position.x += tr.dir * tr.speed * dt;
      if (tr.mesh.position.x > 520) tr.mesh.position.x = BRIDGE.x0 - 20;
      if (tr.mesh.position.x < BRIDGE.x0 - 20) tr.mesh.position.x = 520;
      // stop for a moment at the stops along the street
      const x = tr.mesh.position.x;
      if (Math.abs(((x + 1000) % 160) - 80) < tr.speed * dt && Math.random() < 0.7) tr.wait = 6;
    }
  }
}

// ───────────── the ground ─────────────

/**
 * The ground for a moment: one big flat area with the streets, gardens and park drawn onto it (a picture of the
 * near city, 1 px ≈ 0.35 m), fading into a coarser picture of the far city and the fields. Rivers are cut out.
 */
function ground(era) {
  const R = { x0: -320, x1: 420, z0: -220, z1: 520 };
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const k = S / (R.x1 - R.x0);
  const X = (x) => (x - R.x0) * k, Z = (z) => (z - R.z0) * k;
  const r = rng(era.length + 3);
  const base = { before: '#8d8576', blast: '#8d8576', after: '#5a514a', rebuilt: '#8f8a80', today: '#8a8984' }[era];
  const street = { before: '#a79a84', blast: '#a79a84', after: '#6e655c', rebuilt: '#76756f', today: '#57595e' }[era];
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  // streets
  g.fillStyle = street;
  for (const sx of EAST_STREETS.ns) g.fillRect(X(sx - EAST_STREETS.width / 2), Z(-2000), EAST_STREETS.width * k, S);
  for (const sz of EAST_STREETS.ew) g.fillRect(X(-18), Z(sz - EAST_STREETS.width / 2), S, EAST_STREETS.width * k);
  g.fillRect(0, Z(AIOI_ST.z - AIOI_ST.w / 2), S, AIOI_ST.w * k);
  const park = era === 'rebuilt' || era === 'today';
  if (!park) {
    for (const sx of ISLAND_STREETS.ns) g.fillRect(X(sx - ISLAND_STREETS.width / 2), Z(FORK_Z), ISLAND_STREETS.width * k, S);
    for (const sz of ISLAND_STREETS.ew) g.fillRect(X(ISLAND.x0), Z(sz - ISLAND_STREETS.width / 2), (ISLAND.x1 - ISLAND.x0) * k, ISLAND_STREETS.width * k);
  } else {
    // the park: lawns, gravel paths, the wide plaza along the axis
    g.fillStyle = era === 'today' ? '#6f8f4e' : '#7f8f58';
    g.fillRect(X(ISLAND.x0), Z(FORK_Z), (ISLAND.x1 - ISLAND.x0) * k, (360 - FORK_Z) * k);
    g.strokeStyle = '#c9bfa6';
    g.lineWidth = 6 * k;
    g.beginPath();
    g.moveTo(X(PARK.museum[0]), Z(PARK.museum[1]));
    g.lineTo(X(PARK.cenotaph[0]), Z(PARK.cenotaph[1]));
    g.lineTo(X(-72), Z(171));
    g.stroke();
    g.fillStyle = '#c9bfa6';
    g.beginPath();
    g.ellipse(X(PARK.cenotaph[0]), Z(PARK.cenotaph[1]), 22 * k, 16 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 3.5 * k;
    for (const [a, b] of [[[-180, FORK_Z + 10], PARK.monument], [PARK.monument, PARK.bell], [PARK.bell, [-80, 150]], [PARK.monument, [-150, 230]], [[-215, 100], [-140, 300]]]) {
      g.beginPath();
      g.moveTo(X(a[0]), Z(a[1]));
      g.lineTo(X(b[0]), Z(b[1]));
      g.stroke();
    }
    for (const [x, z, rad] of [[...PARK.monument, 16], [...PARK.bell, 7]]) {
      g.beginPath();
      g.arc(X(x), Z(z), rad * k, 0, Math.PI * 2);
      g.fill();
    }
  }
  // the riverside path on the east bank, and the hall's garden
  g.fillStyle = era === 'after' ? '#62584f' : '#a99d86';
  g.fillRect(X(-18), 0, 6 * k, S);
  g.fillStyle = era === 'after' ? '#4d453f' : park ? '#7f8f58' : '#8b8d62';
  g.fillRect(X(-5), Z(-22), 32 * k, 50 * k);
  // grain, and scorch marks after the bomb
  for (let i = 0; i < 90000; i++) {
    const v = r();
    g.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    g.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 3);
  }
  if (era === 'after') {
    for (let i = 0; i < 400; i++) {
      const x = r() * S, z = r() * S, rad = 10 + r() * 60;
      const grad = g.createRadialGradient(x, z, 0, x, z, rad);
      grad.addColorStop(0, 'rgba(10,8,6,0.35)');
      grad.addColorStop(1, 'rgba(10,8,6,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, z - rad, rad * 2, rad * 2);
    }
  }
  const near = new THREE.CanvasTexture(c);
  near.colorSpace = THREE.SRGBColorSpace;
  near.anisotropy = 8;

  // the far city and fields: one shader over a big disc, so the edge of the near picture never shows
  const far = { before: [0.55, 0.5, 0.43], blast: [0.55, 0.5, 0.43], after: [0.3, 0.27, 0.24], rebuilt: [0.56, 0.54, 0.5], today: [0.55, 0.55, 0.55] }[era];
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      near: { value: near },
      region: { value: new THREE.Vector4(R.x0, R.z0, R.x1 - R.x0, R.z1 - R.z0) },
      farColor: { value: new THREE.Color(...far) },
      fieldColor: { value: new THREE.Color(era === 'after' ? 0x3d3a30 : 0x5d7040) },
      light: { value: new THREE.Color(1, 1, 1) },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0 },
    },
    vertexShader: `varying vec3 vW; varying float vD;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D near; uniform vec4 region; uniform vec3 farColor; uniform vec3 fieldColor; uniform vec3 light;
      uniform vec3 fogColor; uniform float fogDensity; varying vec3 vW; varying float vD;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        vec2 uv = (vW.xz - region.xy) / region.zw;
        // the far city: blocks of roofs, a little lighter or darker each
        vec2 cell = floor(vW.xz / 14.0);
        vec3 city = farColor * (0.82 + 0.3 * hash(cell));
        float r = length(vW.xz - vec2(60.0, 150.0));
        vec3 col = mix(city, fieldColor, smoothstep(2200.0, 3600.0, r));
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float edge = inside * smoothstep(0.0, 0.04, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
        col = mix(col, texture2D(near, uv).rgb, edge);
        float n = vnoise(vW.xz * 1.7) * 0.4 + vnoise(vW.xz * 0.35) * 0.4 + vnoise(vW.xz * 0.06) * 0.2;
        col *= 0.9 + 0.2 * n;
        col *= light;
        float f = 1.0 - exp(-fogDensity * fogDensity * vD * vD);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  // the land between the rivers (the rivers themselves are left open)
  const parts = [];
  const rect = (x0, x1, z0, z1) => parts.push(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2));
  rect(OTA.x1, 9000, -9000, 9000); // east bank
  rect(ISLAND.x0, ISLAND.x1, FORK_Z, 9000); // the island
  rect(-9000, HONKAWA.x0, FORK_Z, 9000); // west bank, south of the fork
  rect(-9000, OTA.x0, -9000, FORK_Z); // west bank, north
  rect(HONKAWA.x0, OTA.x0, FORK_Z - 0.01, FORK_Z); // (closes the corner)
  const mesh = new THREE.Mesh(mergeGeometries(parts, false), mat);
  mesh.userData.ground = true;
  return mesh;
}

// ───────────── water ─────────────

let waterMat = null;
function water() {
  if (waterMat) return waterMat;
  waterMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      deep: { value: new THREE.Color(0x2c4a52) },
      sky: { value: new THREE.Color(0x9fbfd6) },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0 },
    },
    vertexShader: `varying vec3 vW; varying float vD;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float time; uniform vec3 deep; uniform vec3 sky; uniform vec3 fogColor; uniform float fogDensity;
      varying vec3 vW; varying float vD;
      void main(){
        vec2 p = vW.xz * 0.35;
        float w = sin(p.x + time * 0.7) * cos(p.y * 1.3 - time * 0.5) + 0.5 * sin(p.x * 2.7 - p.y * 1.9 + time * 1.1);
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(v.y, 0.0), 3.0);
        vec3 col = mix(deep, sky, clamp(0.25 + fres * 0.7 + w * 0.05, 0.0, 1.0));
        col += vec3(0.9, 0.95, 1.0) * pow(max(w, 0.0), 8.0) * 0.025;
        float f = 1.0 - exp(-fogDensity * fogDensity * vD * vD);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return waterMat;
}

// ───────────── the hills ─────────────

function hills() {
  // a ring of hills 4–8 km out round the delta: highest to the north, low and broken to the south, where the bay is
  const r = rng(21);
  const SEG = 160, ROWS = 7, R0 = 4200, R1 = 8200;
  const peaks = [];
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const north = Math.max(0, -Math.sin(a));
    const south = Math.max(0, Math.sin(a));
    peaks.push((180 + 420 * north + 140 * Math.sin(a * 6 + 1.3) ** 2 + 110 * r()) * (1 - 0.8 * south ** 3));
  }
  peaks[SEG] = peaks[0];
  const pos = [], idx = [];
  for (let j = 0; j <= ROWS; j++) {
    const t = j / ROWS;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const rad = R0 + (R1 - R0) * t + 300 * Math.sin(a * 5 + j);
      const h = peaks[i] * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25)), 0.7) * (0.8 + 0.4 * r());
      pos.push(60 + Math.cos(a) * rad, j === 0 ? -6 : Math.max(-6, h), 150 + Math.sin(a) * rad);
    }
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < SEG; i++) {
    const a = j * (SEG + 1) + i, b = a + SEG + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x5e7350, side: THREE.DoubleSide }));
  m.userData.hills = true;
  return m;
}

export { M as cityMaterials };
