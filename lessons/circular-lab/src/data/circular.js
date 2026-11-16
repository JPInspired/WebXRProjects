// Everything the Circular Motion lab knows: the kit, the physics, the predictions, the real-world examples and
// the physicist's answers.
//
// The kit is the standard school practical: a string runs through a smooth tube held upright; a ball is tied to
// the top end and a weight hangs from the bottom end. Swirl the tube so the ball goes round in a horizontal
// circle. The hanging weight pulls the string with a fixed force F = Mg, and that pull is the centripetal force.
// The ball settles at the speed where F = m ω² r: spin faster and the ball pulls the string out (the weight
// rises); slower and the weight drags the string back in. A clip on the string, just below the tube, marks
// the radius you chose: keep it there and you are at the right speed.
//   rotations per second f = ω / 2π = (1 / 2π) √(F / (m r))
// so heavier balls and longer strings go round more slowly, and a bigger pull makes them go faster.

export const G = 9.81;
export const BALLS = [50, 100, 150, 200, 250]; // grams, as in the original lesson
export const LENGTHS = [0.2, 0.3, 0.4, 0.5]; // radius (m) set by the clip
export const HANGING = [100, 150, 200, 250, 300]; // grams (Advanced); Core uses 200 g
export const CORE_HANGING = 200;
export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

/** Steady rotations per second for ball mass m (g), radius r (m) and hanging mass M (g). */
export function idealRps(m, r, M) {
  return Math.sqrt(((M / 1000) * G) / ((m / 1000) * r)) / (2 * Math.PI);
}

// ───────────── starter: predict ─────────────

export const PREDICTIONS = [
  {
    name: 'Everyday',
    q: 'A car drives round a roundabout at a steady speed. Which force keeps it turning?',
    options: ['The engine', 'Friction between the tyres and the road', 'Gravity', 'No force: it just keeps turning'],
    answer: 1,
    why: 'Friction from the road pushes the tyres sideways, towards the centre of the turn. On ice there is almost none, which is why cars slide straight on.',
  },
  {
    name: 'Mass',
    q: 'The same pull keeps a ball going round on a string. Swap it for a heavier ball. To keep the same circle, it will go round…',
    options: ['Faster', 'Slower', 'At the same speed', 'It can’t go round at all'],
    answer: 1,
    why: 'Slower. A heavier ball needs a bigger force to turn it at the same speed. With the same pull, it can only be turned at a lower speed.',
  },
  {
    name: 'Length',
    q: 'Same ball, same pull, but a longer string (a bigger circle). The number of turns each second will…',
    options: ['Go up', 'Go down', 'Stay the same'],
    answer: 1,
    why: 'Go down. A bigger circle takes longer to go round, and the same pull can’t turn the ball as quickly on it.',
  },
  {
    name: 'Snap!',
    q: 'You are whirling a ball above your head and the string snaps. Which way does the ball fly?',
    options: ['Straight outwards, away from the centre', 'Straight on, along the line it was moving (the tangent)', 'In a curve, still turning', 'Straight down'],
    answer: 1,
    why: 'Straight on, along the tangent (and falling, because of gravity). Without the string there is no force pulling it round, so it carries on in a straight line: Newton’s first law.',
  },
];

// ───────────── the plenary: real world ─────────────

export const EXAMPLES = [
  { id: 'ball', name: 'Ball on a string', force: 'Tension in the string', lose: 'Cut the string', what: 'The string pulls the ball towards the centre of the circle.' },
  { id: 'satellite', name: 'Satellite orbiting Earth', force: 'Gravity', lose: 'Switch off gravity', what: 'Earth’s gravity pulls the satellite towards Earth’s centre. It is always falling towards Earth, but moving sideways so fast that it keeps missing.' },
  { id: 'car', name: 'Car on a bend', force: 'Friction on the tyres', lose: 'Ice on the road', what: 'The road pushes the tyres sideways, towards the centre of the bend. Less grip (ice, rain) means a slower safe speed.' },
];

export const DISCUSS = [
  'Which mattered more for the speed: doubling the mass or doubling the length? How do your results show it?',
  'Why must the clip stay just below the tube while you time the turns?',
  'Which of your results don’t fit the pattern? What might have caused them?',
  'Why do racing tracks bank their bends?',
  'A washing machine’s drum spins fast: where does the water go, and why?',
];

// ───────────── ask the physicist ─────────────

export const QUESTIONS = [
  { id: 'centripetal', label: 'What is centripetal force?' },
  { id: 'centrifugal', label: 'Is there a “centrifugal” force?' },
  { id: 'accelerating', label: 'How is it accelerating?' },
  { id: 'formula', label: 'Where does F = mv²/r come from?' },
  { id: 'orbit', label: 'Why don’t satellites fall?' },
  { id: 'errors', label: 'What makes results less accurate?' },
  { id: 'banked', label: 'Why are bends banked?' },
  { id: 'everyday', label: 'Where else do we see it?' },
];

export const ANSWERS = {
  centripetal: 'Any force that keeps something moving in a circle, by pulling it towards the centre. It isn’t a new kind of force: here it is the tension in the string; for the Moon it is gravity; for a car on a bend it is friction.',
  centrifugal: 'Not really. The outward “fling” you feel is your body trying to carry straight on (inertia) while something pulls you round. Cut the string and the ball flies off along the tangent, not straight outwards, which shows nothing was pushing it out.',
  accelerating: 'Acceleration is any change in velocity, and velocity includes direction. Going round a circle at a steady speed, the direction changes all the time, so it is always accelerating, towards the centre.',
  formula: 'Turning something at speed v round a circle of radius r needs an acceleration v²/r towards the centre. Newton’s second law (F = ma) then gives F = mv²/r, or F = mω²r using the turns: ω = 2π × turns per second.',
  orbit: 'They are falling! Gravity pulls them towards Earth, but they move sideways so fast (about 7.7 km/s for the space station) that the ground curves away beneath them as quickly as they fall.',
  errors: 'Your reaction time when starting and stopping the stopwatch (time 10 or more turns to make it smaller), keeping the clip in the same place, the string rubbing in the tube, and the ball dipping below a horizontal circle.',
  banked: 'On a sloping (banked) bend, part of the road’s push on the car points towards the centre of the turn, so the car can go round faster without relying only on friction. Cycling tracks and racing circuits are banked for this.',
  everyday: 'Washing-machine spin cycles, theme-park rides, a hammer thrower, the Moon round Earth, Earth round the Sun, electrons in particle accelerators, and centrifuges that separate blood.',
};
