// Everything the Pendulum Lab knows: lengths, bobs, air, planets, the physics, predictions, the real-world
// models and the physicist's answers.
//
// The pendulum is solved exactly (not with the small-angle shortcut):
//   θ'' = −(g/L) sin θ − (drag / m) · v|v| / L − pivot friction
// drag = ½ ρ Cd A × the air factor (0 in a vacuum). For small swings T = 2π√(L/g): only the length (and g)
// matter, not the mass; bigger swings take slightly longer. Air resistance takes energy away each swing, so the
// swings die away, quickly for light or draggy bobs; the period hardly changes.

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];
export const LENGTHS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]; // m (bench, up/down buttons as in the original)
export const GIANT_LENGTHS = [1.5, 2.0, 2.5]; // m (from the ceiling)
export const ANGLES = [5, 10, 15, 20, 30, 45, 60];
export const RHO = 1.2; // kg/m³, air

export const BOBS = {
  steel: { name: 'Steel', m: 0.25, r: 0.02, cd: 0.47, color: 0xc0c6d0, metal: true },
  wood: { name: 'Wood', m: 0.022, r: 0.02, cd: 0.47, color: 0xb5834e },
  foam: { name: 'Polystyrene', m: 0.001, r: 0.02, cd: 0.47, color: 0xf4f4f0 },
  sail: { name: 'Steel + paper sail', m: 0.255, r: 0.02, cd: 1.2, area: 0.035, color: 0xc0c6d0, metal: true, sail: true },
};
export const AIR = [['vacuum', 'Vacuum', 0], ['normal', 'Normal air', 1], ['thick', 'Air ×5', 5], ['treacle', 'Air ×20', 20]];

export const PLANETS = {
  earth: { name: 'Earth', g: 9.81 },
  moon: { name: 'Moon', g: 1.62 },
  mars: { name: 'Mars', g: 3.71 },
  jupiter: { name: 'Jupiter', g: 24.8 },
};

export const periodSmall = (L, g = 9.81) => 2 * Math.PI * Math.sqrt(L / g);

/** Drag coefficient term k (1/m): θ'' gets −k v|v| / L with v the bob's speed. */
export function dragK(bob, airFactor) {
  const b = BOBS[bob];
  const A = b.area ?? Math.PI * b.r * b.r;
  return (0.5 * RHO * b.cd * A * airFactor) / b.m;
}

// ───────────── starter ─────────────

export const FACTORS = ['The length of the string', 'The mass of the bob', 'How far you pull it back (the angle)', 'Air resistance', 'Gravity'];

export const PREDICTIONS = [
  {
    name: 'Length',
    q: 'You make the string longer. What happens to the time for one swing?',
    options: ['It gets longer', 'It gets shorter', 'It stays the same'],
    answer: 0,
    why: 'Longer. A long pendulum swings slowly, which is why grandfather clocks are tall and a short pendulum ticks quickly.',
  },
  {
    name: 'Four times',
    q: 'Make the string four times as long. The period becomes…',
    options: ['Four times as long', 'Twice as long', 'Sixteen times as long', 'The same'],
    answer: 1,
    why: 'Twice as long: the period goes with the square root of the length, T = 2π√(L/g). So you need four times the length to double the period.',
  },
  {
    name: 'Mass',
    q: 'Swap a light wooden bob for a heavy steel one (same string). The period…',
    options: ['Gets longer', 'Gets shorter', 'Stays (almost) the same'],
    answer: 2,
    why: 'Stays the same. Gravity pulls harder on the heavier bob, but it is also harder to get moving, and the two cancel. The heavy bob does keep swinging for longer, though: the air slows it less.',
  },
  {
    name: 'Stopping',
    q: 'Why does a pendulum eventually stop swinging?',
    options: ['Gravity runs out', 'Air resistance and friction take energy away each swing', 'The string gets tired', 'It does not: it swings for ever'],
    answer: 1,
    why: 'Air resistance and friction at the pivot turn a little of its energy into heat and sound every swing. In a vacuum, with a perfect pivot, it would swing for ever.',
  },
];

// ───────────── real world ─────────────

export const WORLD = [
  ['clock', 'Pendulum clock'],
  ['swing', 'Swing & pirate ship'],
  ['metronome', 'Metronome'],
  ['planets', 'Other planets'],
];
export const SECONDS_L = 9.81 / (Math.PI * Math.PI); // a 2-second ("seconds") pendulum, 0.994 m

export const DISCUSS = [
  'Which variable changed the period, and which did not? Did your results match your predictions?',
  'Why does timing 10 swings give a better answer than timing one?',
  'Your stopwatch and the light gate did not agree exactly: why not?',
  'Which bob kept swinging longest, and why? Where did the energy go?',
  'Why must a pendulum clock be adjusted if it is moved to a mountain top, or to the Moon?',
];

// ───────────── ask the physicist ─────────────

export const QUESTIONS = [
  { id: 'period', label: 'What is the period?' },
  { id: 'length', label: 'Why does length matter?' },
  { id: 'mass', label: 'Why does not mass matter?' },
  { id: 'angle', label: 'Does the angle matter?' },
  { id: 'energy', label: 'Where does the energy go?' },
  { id: 'momentum', label: 'What about momentum?' },
  { id: 'clock', label: 'How do pendulum clocks work?' },
  { id: 'foucault', label: 'What is a Foucault pendulum?' },
];

export const ANSWERS = {
  period: 'The time for one complete swing, there and back: from one side, across, and back to the same side. A 1 m pendulum on Earth has a period of about 2 seconds.',
  length: 'A longer pendulum swings along a bigger, flatter arc, so gravity pulls it back to the middle more gently and it takes longer. The period grows with the square root of the length: T = 2π√(L/g).',
  mass: 'A heavier bob is pulled harder by gravity, but it also needs a bigger force to speed it up. The two cancel exactly, so the period does not change. (Mass does change how long it keeps swinging in air.)',
  angle: 'Hardly, for small swings: that is why pendulums keep good time even as their swings die away. For big swings (more than about 20°), each swing takes a little longer.',
  energy: 'At the top of a swing it has gravitational potential energy and stops for an instant; at the bottom that has become kinetic energy. A little is lost each swing to the air and the pivot, as heat and sound.',
  momentum: 'The bob’s momentum (mass × velocity) is biggest at the bottom and zero at the ends, where gravity turns it round. Air resistance takes some momentum away every swing, so it slows down and the swings get smaller.',
  clock: 'Each swing takes the same time, so the clock counts swings. Too fast? Lower the bob (screw the nut down) to make the pendulum longer. Grandfather clocks use a 1 m “seconds pendulum”: one second for each swing across.',
  foucault: 'A huge pendulum that swings for hours. As it swings, the Earth turns underneath it, so its swing seems to rotate slowly around the floor: the first direct proof (1851) that the Earth spins.',
};
