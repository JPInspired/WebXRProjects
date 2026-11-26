// The map of the lesson, in metres: x to the east, z to the south (so −z is north), y up; the ground is at y = 0.
// Simplified from the real city around the Atomic Bomb Dome, keeping its main features where they are:
//  • the Ota River coming from the north and dividing at the tip of Nakajima island into the Motoyasu River
//    (east) and the Honkawa River (west);
//  • the T-shaped Aioi Bridge across the river just above the fork, its third arm reaching the island's tip;
//  • the Industrial Promotion Hall on the east bank of the Motoyasu River;
//  • Shima Hospital about 150 m to the south-east of the hall: the hypocentre, 600 m below the explosion;
//  • Nakajima island: a busy district in 1945, the Peace Memorial Park from the 1950s, its museum, Cenotaph and
//    the hall lined up along one axis.

export const WATER_Y = -2.4; // the river's surface
export const BANK_Y = 0; // the top of the embankments

// rivers (x ranges, north of and south of the fork)
export const FORK_Z = -60; // the island's northern tip
export const OTA = { x0: -240, x1: -18 }; // the single channel north of the fork
export const MOTOYASU = { x0: -72, x1: -18 }; // east branch
export const HONKAWA = { x0: -290, x1: -230 }; // west branch
export const ISLAND = { x0: -230, x1: -72, z0: FORK_Z, z1: 1400 };

// the Aioi Bridge: a long crossbar over the channel, and a short stem south to the island's tip
export const BRIDGE = { z: -78, w: 24, x0: -246, x1: -12, stem: { x: -150, w: 18, z0: -78, z1: FORK_Z + 6 } };

// the hall (its central tower and dome face the river) and the hypocentre
export const HALL = { x0: 0, x1: 24, z0: -12, z1: 20, tower: [5, 4] };
export const HYPO = { x: 112, z: 108, height: 600 };

// the Peace Memorial Park axis: museum → Flame of Peace → Cenotaph → (across the river) the Dome
export const PARK = {
  cenotaph: [-100, 230],
  flame: [-89, 207],
  museum: [-132, 298],
  monument: [-140, 110], // Children's Peace Monument
  bell: [-95, 95],
};

// streets on the east bank (a grid, as Hiroshima's was) and on the island
export const AIOI_ST = { z: -78, w: 22 }; // Aioi-dori, with the tram, running east from the bridge
export const EAST_STREETS = {
  ns: [-10, 32, 72, 115, 160, 205, 250], // north–south streets (x of their centre); -10 is the riverside path
  ew: [-112, -78, -32, 32, 72, 120, 165, 210, 255, 300], // east–west streets (z of their centre)
  width: 9,
};
export const ISLAND_STREETS = { ns: [-200, -150, -100], ew: [-20, 30, 80, 130, 180, 230, 280], width: 8 };

// where you can walk (anything outside is a gentle invisible wall)
export const BOUNDS = { x0: -236, x1: 230, z0: -150, z1: 330 };

export const inWater = (x, z) => {
  if (z < FORK_Z) return x > OTA.x0 && x < OTA.x1; // north of the fork: one wide river
  return (x > MOTOYASU.x0 && x < MOTOYASU.x1) || (x > HONKAWA.x0 && x < HONKAWA.x1);
};

export const onBridge = (x, z) => {
  if (Math.abs(z - BRIDGE.z) < BRIDGE.w / 2 - 1.2 && x > BRIDGE.x0 && x < BRIDGE.x1) return true;
  const s = BRIDGE.stem;
  return Math.abs(x - s.x) < s.w / 2 - 1.2 && z > s.z0 && z < s.z1;
};

/** A small, repeatable random number generator (the same city every time). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The walkable map for a moment: a grid of 1 m cells over BOUNDS, 1 = you can stand here. Buildings, the rivers
 * and anything solid are 0 (the bridge is 1 over the water).
 */
export class WalkMap {
  constructor() {
    this.w = BOUNDS.x1 - BOUNDS.x0;
    this.h = BOUNDS.z1 - BOUNDS.z0;
    this.cells = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) {
      const z = BOUNDS.z0 + j + 0.5;
      for (let i = 0; i < this.w; i++) {
        const x = BOUNDS.x0 + i + 0.5;
        this.cells[j * this.w + i] = !inWater(x, z) || onBridge(x, z) ? 1 : 0;
      }
    }
  }

  /** Mark a rectangle (axis-aligned, metres) as solid, leaving a margin so you do not touch the walls. */
  block(x0, z0, x1, z1, margin = 0.35) {
    const i0 = Math.max(0, Math.floor(x0 - margin - BOUNDS.x0));
    const i1 = Math.min(this.w - 1, Math.floor(x1 + margin - BOUNDS.x0));
    const j0 = Math.max(0, Math.floor(z0 - margin - BOUNDS.z0));
    const j1 = Math.min(this.h - 1, Math.floor(z1 + margin - BOUNDS.z0));
    for (let j = j0; j <= j1; j++) this.cells.fill(0, j * this.w + i0, j * this.w + i1 + 1);
  }

  ok(x, z) {
    const i = Math.floor(x - BOUNDS.x0);
    const j = Math.floor(z - BOUNDS.z0);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false;
    return this.cells[j * this.w + i] === 1;
  }
}

/** Is (x, z) on one of the street grid's carriageways? (used to keep buildings off the streets) */
export function onStreet(x, z) {
  if (Math.abs(z - AIOI_ST.z) < AIOI_ST.w / 2) return true;
  const island = x < MOTOYASU.x0 && x > HONKAWA.x1 && z > FORK_Z;
  const S = island ? ISLAND_STREETS : EAST_STREETS;
  const half = S.width / 2;
  if (S.ns.some((sx) => Math.abs(x - sx) < half)) return true;
  if (S.ew.some((sz) => Math.abs(z - sz) < half)) return true;
  return false;
}
