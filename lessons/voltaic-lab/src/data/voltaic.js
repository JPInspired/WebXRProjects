// Everything the Voltaic Lab knows: the metals and their electrode potentials, the electrolytes, how a cell's
// voltage and current are worked out, the predictions, the real batteries and the chemist's answers.
//
// Core: a simple cell, two different metal strips in one beaker of electrolyte. The more reactive metal gives
// up electrons (it is the negative terminal); the voltage grows with the gap between the metals in the
// reactivity series. Simple cells give less than the textbook value (bubbles of hydrogen and a film on the
// positive strip get in the way), and the electrolyte matters: it must contain ions to carry the charge, so
// sugar water and pure water barely work, and how well it conducts sets the current.
// Advanced: each metal in a solution of its own ions (zinc in zinc sulfate…), the two beakers joined by a salt
// bridge. Then the voltage is close to E°cell = E°(positive) − E°(negative).

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

/** E°: standard electrode potential (V) of M²⁺/M (Ag⁺/Ag). */
export const METALS = {
  mg: { name: 'Magnesium', sym: 'Mg', E: -2.37, color: 0xc9ccd2, ion: 'Mg²⁺', n: 2, solution: 'magnesium sulfate', solColor: 0xeef3f8, react: 'very reactive' },
  zn: { name: 'Zinc', sym: 'Zn', E: -0.76, color: 0x9aa7b4, ion: 'Zn²⁺', n: 2, solution: 'zinc sulfate', solColor: 0xeef3f8, react: 'reactive' },
  fe: { name: 'Iron', sym: 'Fe', E: -0.44, color: 0x6d6f73, ion: 'Fe²⁺', n: 2, solution: 'iron(II) sulfate', solColor: 0xd6ecc8, react: 'fairly reactive' },
  pb: { name: 'Lead', sym: 'Pb', E: -0.13, color: 0x7d8494, ion: 'Pb²⁺', n: 2, solution: 'lead nitrate', solColor: 0xeef3f8, react: 'not very reactive' },
  cu: { name: 'Copper', sym: 'Cu', E: 0.34, color: 0xc8733f, ion: 'Cu²⁺', n: 2, solution: 'copper sulfate', solColor: 0x3d8fe0, react: 'unreactive' },
  ag: { name: 'Silver', sym: 'Ag', E: 0.8, color: 0xe4e6ea, ion: 'Ag⁺', n: 1, solution: 'silver nitrate', solColor: 0xeef3f8, react: 'very unreactive' },
};
export const METAL_IDS = Object.keys(METALS);

/**
 * Core electrolytes. k: share of the ideal voltage a simple cell reaches in it; R: the cell's internal
 * resistance (Ω) with it, set by how well it conducts (lemon cells are famously weak).
 */
export const ELECTROLYTES = {
  salt: { name: 'Salt water', short: 'Salt water', k: 0.72, R: 25, color: 0xe6f4ff, ions: true, why: 'Dissolved salt splits into sodium and chloride ions that carry charge through the water.' },
  vinegar: { name: 'Vinegar', short: 'Vinegar', k: 0.78, R: 70, color: 0xf2e7c4, ions: true, why: 'Vinegar is a weak acid: it has some hydrogen ions, but not many, so it conducts less well than salt water.' },
  lemon: { name: 'Lemon juice', short: 'Lemon', k: 0.8, R: 450, color: 0xf6ef9a, ions: true, why: 'Citric acid gives ions, enough for a decent voltage but only a tiny current: a lemon battery can’t light a bulb.' },
  acid: { name: 'Dilute sulfuric acid', short: 'Dilute acid', k: 0.85, R: 8, color: 0xf2f6ff, ions: true, why: 'A strong acid is full of hydrogen and sulfate ions, so it conducts well: the best electrolyte here.' },
  sugar: { name: 'Sugar water', short: 'Sugar water', k: 0.06, R: 60000, color: 0xfaf6ee, ions: false, why: 'Sugar dissolves as whole molecules, not ions, so there is almost nothing to carry the charge.' },
  water: { name: 'Pure water', short: 'Pure water', k: 0.08, R: 40000, color: 0xeaf6ff, ions: false, why: 'Pure water has hardly any ions, so it barely conducts and the cell hardly works.' },
};
export const ELECTROLYTE_IDS = Object.keys(ELECTROLYTES);

export const BRIDGE_R = 150; // Ω, two half-cells and a salt bridge (the paper bridge limits the current to a few mA)
export const METER_R = 1; // Ω, the ammeter

/** Ideal voltage between the + (right-hand, red lead) and − (left-hand, black lead) strips. */
export const idealV = (left, right) => METALS[right].E - METALS[left].E;

/**
 * One cell's EMF (V, + means the right strip is positive) and internal resistance (Ω), or null if it
 * can't work (missing a strip, no electrolyte, no salt bridge). wear: 0 (fresh) … 1 (worn out).
 */
export function cellEMF(cell, level, wear = 0) {
  const { left, right } = cell;
  if (!left || !right) return null;
  const ideal = idealV(left, right);
  const fade = 1 - 0.75 * wear ** 1.6;
  if (level === 'advanced') {
    if (!cell.bridge) return { V: 0, R: Infinity, open: true };
    // a little below E°cell (solutions not exactly 1 M, a little resistance in the bridge)
    return { V: ideal * 0.985 * fade, R: BRIDGE_R * (1 + 2 * wear) };
  }
  const e = ELECTROLYTES[cell.electrolyte];
  if (!e) return null;
  // simple cells fall further short for big gaps (the positive strip gets coated in hydrogen bubbles)
  const gap = Math.abs(ideal);
  const V = Math.sign(ideal) * e.k * gap * (1 - 0.12 * Math.max(0, gap - 1.1));
  return { V: V * fade, R: e.R * (1 + 3 * wear) };
}

// ───────────── starter: predict ─────────────

export const PREDICTIONS = [
  {
    name: 'Batteries',
    q: 'How does a battery make electricity?',
    options: ['It stores electricity, like water in a tank', 'A chemical reaction pushes electrons round the circuit', 'It is full of static electricity', 'Magnets inside it spin round'],
    answer: 1,
    why: 'A chemical reaction inside it: one material gives up electrons, which flow round the circuit to the other. When the chemicals are used up, the battery is flat.',
  },
  {
    name: 'Metals',
    q: 'Which pair of metal strips will give the biggest voltage in a lemon?',
    options: ['Zinc and copper', 'Magnesium and copper', 'Iron and copper', 'Copper and copper'],
    answer: 1,
    why: 'Magnesium and copper: they are furthest apart in the reactivity series. Magnesium gives up its electrons much more readily than copper.',
  },
  {
    name: 'Same metal',
    q: 'What voltage will two strips of the same metal give?',
    options: ['Double the usual', 'About the same as zinc and copper', 'Almost zero', 'It depends on the size of the strips'],
    answer: 2,
    why: 'Almost zero. Both strips want to give up electrons equally, so there is no push in either direction.',
  },
  {
    name: 'Electrolyte',
    q: 'Zinc and copper strips in sugar water, then in salt water. What happens?',
    options: ['Both work equally well', 'Only the sugar water works', 'Only the salt water works', 'Neither works'],
    answer: 2,
    why: 'Only the salt water works. The electrolyte must contain ions to carry the charge between the strips: salt splits into ions in water, sugar does not.',
  },
];

// ───────────── real batteries (plenary) ─────────────

export const BATTERIES = [
  {
    id: 'aa', name: 'Alkaline AA', volts: '1.5 V', recharge: 'No', neg: 'Zinc powder (the negative)', pos: 'Manganese dioxide (the positive)', electrolyte: 'Potassium hydroxide paste',
    note: 'The same idea as your zinc cell, packed tight: zinc gives up electrons, manganese dioxide takes them. Once the zinc is used up, it is flat.',
  },
  {
    id: 'li', name: 'Lithium-ion (phones, laptops)', volts: '3.7 V', recharge: 'Yes', neg: 'Graphite holding lithium', pos: 'A lithium metal oxide', electrolyte: 'A lithium salt in an organic solvent',
    note: 'Lithium is even more reactive than magnesium, so the voltage is high. Charging pushes the lithium back into the graphite, so it can be used again and again.',
  },
  {
    id: 'lead', name: 'Car battery (lead-acid)', volts: '12 V (6 cells of 2 V)', recharge: 'Yes', neg: 'Lead plates', pos: 'Lead dioxide plates', electrolyte: 'Sulfuric acid',
    note: 'Six cells in series, just like linking your cells, add up to 12 V. It is heavy, but it can give the huge current needed to start an engine.',
  },
];

export const DISCUSS = [
  'Which metal pair and electrolyte gave your biggest voltage? Why that pair?',
  'Why did sugar water and pure water hardly work?',
  'What did linking cells in series do to the voltage? And to the current?',
  'Which strip wore away as the cell ran down, and why that one?',
  'Why do phones use lithium batteries rather than zinc and copper?',
];

// ───────────── ask the chemist ─────────────

export const QUESTIONS = [
  { id: 'how', label: 'How does a voltaic cell work?' },
  { id: 'which', label: 'Which strip is negative?' },
  { id: 'electrolyte', label: 'What does the electrolyte do?' },
  { id: 'bridge', label: 'Why a salt bridge?' },
  { id: 'redox', label: 'What are oxidation and reduction?' },
  { id: 'flat', label: 'Why do batteries go flat?' },
  { id: 'series', label: 'Why add cells in series?' },
  { id: 'volta', label: 'Who invented the battery?' },
];

export const ANSWERS = {
  how: 'Two different metals, joined by a wire and dipped in an electrolyte. The more reactive metal loses electrons more easily. Those electrons flow through the wire to the other metal, where ions in the solution pick them up. That flow of electrons is an electric current.',
  which: 'The more reactive metal, the one higher in the reactivity series. It gives up electrons, so electrons leave from it into the wire: it is the negative terminal. If your voltmeter shows a minus sign, its leads are on the other way round.',
  electrolyte: 'It completes the circuit inside the cell. Electrons can’t travel through water, but ions can: as electrons flow one way through the wire, ions drift through the electrolyte, keeping each side from building up charge.',
  bridge: 'In a two-beaker cell, the salt bridge (paper soaked in potassium nitrate) lets ions move between the beakers without the two solutions mixing. Without it, charge builds up in each beaker and the current stops at once.',
  redox: 'Oxidation is losing electrons (zinc atoms become zinc ions). Reduction is gaining electrons (copper ions become copper atoms). They always happen together: “OIL RIG”, oxidation is loss, reduction is gain.',
  flat: 'The reacting chemicals get used up: the zinc wears away and the ions on the other side run out. Rechargeable batteries can push the reaction backwards when you charge them.',
  series: 'Joining cells in series (+ of one to − of the next) adds their voltages: four 1.1 V cells give about 4.4 V. Each cell also adds its own resistance, so the current doesn’t go up the same way.',
  volta: 'Alessandro Volta, in 1800: a stack of zinc and copper discs separated by cardboard soaked in salt water, the “voltaic pile”. The unit of voltage, the volt, is named after him.',
};
