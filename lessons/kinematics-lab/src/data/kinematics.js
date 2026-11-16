// Everything the Kinematics Lab knows: the four stations and their settings, the physics, the key terms, the
// predictions, the worksheet questions, the insights for the plenary and the physicist's answers.
//
//  Drop tower: free fall from 5, 10 or 15 m (as in the original lesson), with air resistance a = −g + g v²/vt²
//              (vt: the object's terminal speed). Without much air resistance h = ½gt², so t = √(2h/g).
//  Pendulum:   θ'' = −(g/L) sin θ, so for small swings T = 2π√(L/g), whatever the mass; bigger swings take a
//              little longer.
//  Spring:     a mass m on a spring of stiffness k stretches it by x = mg/k and bounces with T = 2π√(m/k).
//  Ramp:       a solid ball rolling down a slope at angle θ: a = (5/7) g sin θ (less than g sin θ, because some
//              of the energy goes into spinning); d = ½at².

export const G = 9.81;
export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

export const STATIONS = [
  ['drop', 'Drop tower'],
  ['pendulum', 'Pendulum'],
  ['spring', 'Spring'],
  ['ramp', 'Ramp'],
];

export const HEIGHTS = [5, 10, 15]; // m, as in the original lesson
export const DROP_OBJECTS = {
  tennis: { name: 'Tennis ball', vt: 30, r: 0.0335, color: 0xd8f24a },
  bowling: { name: 'Bowling ball', vt: 85, r: 0.108, color: 0x2c3a8c },
  feather: { name: 'Feather', vt: 0.6, r: 0.02, color: 0xf4f0e8, advanced: true },
  parachute: { name: 'Paper parachute', vt: 2.2, r: 0.03, color: 0xff6b6b, advanced: true },
};

export const LENGTHS = [0.2, 0.3, 0.4, 0.5, 0.6]; // m
export const BOBS = [50, 100, 200]; // g
export const SPRINGS = {
  soft: { name: 'Soft spring', k: 10, color: 0x7cc4ff },
  medium: { name: 'Medium spring', k: 20, color: 0x7ee2a8 },
  stiff: { name: 'Stiff spring', k: 40, color: 0xffd166 },
  mystery: { name: 'Mystery spring', k: 25, color: 0xc9a6ff, mystery: true },
};
export const SPRING_MASSES = [50, 100, 200, 300]; // g
export const ANGLES = [5, 10, 15, 20, 25, 30]; // degrees (ramp)

export const pendulumT = (L) => 2 * Math.PI * Math.sqrt(L / G);
export const springT = (mg, k) => 2 * Math.PI * Math.sqrt(mg / 1000 / k);
export const rampA = (deg) => (5 / 7) * G * Math.sin((deg * Math.PI) / 180);

// ───────────── starter ─────────────

export const TERMS = [
  ['Displacement', 'How far something is from where it started, in a particular direction (m). Walk 5 m forward and 5 m back: you have walked 10 m, but your displacement is 0.'],
  ['Velocity', 'How fast the displacement changes: speed in a particular direction (m/s).'],
  ['Acceleration', 'How fast the velocity changes (m/s²). Speeding up, slowing down and changing direction are all accelerating.'],
];

export const PREDICTIONS = [
  {
    name: 'Drop',
    q: 'A tennis ball and a bowling ball are dropped together from the 10 m balcony. Which lands first?',
    options: ['The bowling ball', 'The tennis ball', 'They land at almost the same time'],
    answer: 2,
    why: 'Almost together. Gravity gives everything the same acceleration, about 9.8 m/s². Only air resistance makes a difference, and over 10 m it hardly slows a tennis ball.',
  },
  {
    name: 'Pendulum',
    q: 'You make a pendulum’s string four times as long. Each swing will take…',
    options: ['Four times as long', 'Twice as long', 'The same time', 'Half as long'],
    answer: 1,
    why: 'Twice as long. The period depends on the square root of the length: T = 2π√(L/g). Four times the length, √4 = 2 times the period.',
  },
  {
    name: 'Mass',
    q: 'You swap a pendulum’s 50 g bob for a 200 g bob, same string. The swings will be…',
    options: ['Faster', 'Slower', 'The same'],
    answer: 2,
    why: 'The same. A heavier bob is pulled harder by gravity, but it is also harder to get moving, and the two cancel out exactly.',
  },
  {
    name: 'Velocity',
    q: 'A ball is thrown straight up. At the very top, for an instant, its velocity is zero. What is its acceleration?',
    options: ['Zero', '9.8 m/s² downwards', '9.8 m/s² upwards'],
    answer: 1,
    why: '9.8 m/s² downwards, all the way up and all the way down. Gravity never switches off: at the top it is changing the velocity from “going up” to “going down”.',
  },
];

// ───────────── worksheet questions (one per station) ─────────────

export const CHECKS = {
  drop: { q: 'Does the drop time depend on the height in a straight line (double the height, double the time)?', options: ['Yes', 'No: double the height takes about 1.4 times as long'], answer: 1, why: 'h = ½gt², so t = √(2h/g): double the height multiplies the time by √2 ≈ 1.4.' },
  pendulum: { q: 'Which changed the period: the length, the mass, or both?', options: ['Only the length', 'Only the mass', 'Both', 'Neither'], answer: 0, why: 'Only the length (and, a little, very big swings). T = 2π√(L/g) has no mass in it.' },
  spring: { q: 'With a heavier mass on the same spring, the bounces are…', options: ['Quicker', 'Slower', 'The same'], answer: 1, why: 'Slower: T = 2π√(m/k). Four times the mass, twice the period. (A pendulum doesn’t do this, but a spring does!)' },
  ramp: { q: 'Steeper ramp, bigger acceleration. Which line on a distance-time graph shows steady acceleration?', options: ['A straight line', 'A curve getting steeper', 'A curve getting flatter'], answer: 1, why: 'A curve getting steeper: the ball covers more distance every second. On a velocity-time graph the same motion is a straight sloping line.' },
};

// ───────────── plenary: key insights ─────────────

export const INSIGHTS = [
  { id: 'samefall', station: 'drop', text: 'Heavy and light balls fall together: air resistance is what makes a feather slow.' },
  { id: 'sqrt', station: 'drop', text: 'Fall time grows with the square root of the height: 4 times as high takes only twice as long.' },
  { id: 'terminal', station: 'drop', text: 'Air resistance gives a top speed (terminal velocity): the velocity graph flattens out.' },
  { id: 'length', station: 'pendulum', text: 'Only the length changes a pendulum’s period, not the mass.' },
  { id: 'big', station: 'pendulum', text: 'Very big swings take a little longer than small ones.' },
  { id: 'spring', station: 'spring', text: 'Heavier masses bounce more slowly on a spring; stiffer springs bounce faster.' },
  { id: 'hooke', station: 'spring', text: 'The stretch is proportional to the weight hung on the spring (Hooke’s law).' },
  { id: 'ramp', station: 'ramp', text: 'Steeper ramps give bigger acceleration, up to free fall when it is vertical.' },
  { id: 'graphs', station: 'all', text: 'The slope of a displacement graph is the velocity; the slope of a velocity graph is the acceleration.' },
];

export const DISCUSS = [
  'Which variable surprised you most: one you expected to matter that didn’t, or the other way round?',
  'How close were your values of g to 9.81 m/s²? What made them less accurate?',
  'Why time 10 swings and divide by 10, rather than timing one?',
  'Where do you see pendulums and springs in real life (clocks, cars, buildings, bungee jumps)?',
];

// ───────────── ask the physicist ─────────────

export const QUESTIONS = [
  { id: 'disp', label: 'Displacement vs distance?' },
  { id: 'vel', label: 'Speed vs velocity?' },
  { id: 'acc', label: 'What is acceleration?' },
  { id: 'g', label: 'Why 9.81 m/s²?' },
  { id: 'mass', label: 'Why doesn’t mass matter?' },
  { id: 'shm', label: 'What is simple harmonic motion?' },
  { id: 'graphs', label: 'How do I read the graphs?' },
  { id: 'clock', label: 'How do pendulum clocks work?' },
];

export const ANSWERS = {
  disp: 'Distance is how much ground you cover; displacement is how far you end up from the start, and in which direction. A pendulum swinging to and fro covers lots of distance, but its displacement keeps returning to zero.',
  vel: 'Speed is how fast; velocity is how fast and in which direction. A ball going up at 5 m/s and coming down at 5 m/s has the same speed but opposite velocities (+5 and −5 m/s).',
  acc: 'The rate velocity changes, in m/s every second (m/s²). A falling ball gains about 9.8 m/s every second. Slowing down and turning are accelerations too.',
  g: 'It is the acceleration Earth’s gravity gives everything near the ground, about 9.81 m/s². It is a little less at the equator and on mountains, and only 1.6 m/s² on the Moon.',
  mass: 'A heavier object is pulled harder by gravity, but it also needs a bigger force to speed it up (it has more inertia). The two effects cancel exactly, so everything falls with the same acceleration, unless air resistance gets in the way.',
  shm: 'Simple harmonic motion is the smooth to-and-fro of a spring or a small pendulum swing: the pull back to the middle grows with the distance from it. Its graphs are sine waves, and its period doesn’t depend on how big the swing is.',
  graphs: 'On a displacement-time graph, the slope is the velocity (steeper = faster). On a velocity-time graph, the slope is the acceleration, and the area underneath is the distance travelled.',
  clock: 'A pendulum’s swing takes the same time each time, so a clock counts swings. A pendulum about 1 m long takes 1 second for each swing across (2 s there and back): the classic grandfather clock.',
};
