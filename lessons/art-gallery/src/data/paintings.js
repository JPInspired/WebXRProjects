// Everything the Art Gallery knows: twelve famous paintings (all public domain; sources in ../../CREDITS.md),
// their real sizes, where they hang, a short story, one or two details worth a closer look (hotspots: u, v from
// the painting's left and top, 0 to 1), and the world events placed beside them on the timeline.

export const PAINTINGS = [
  {
    id: 'venus', title: 'The Birth of Venus', artist: 'Sandro Botticelli', year: 1485, yearText: 'about 1485',
    place: 'Uffizi Gallery, Florence', medium: 'Tempera on canvas', w: 278.5, h: 172.5,
    story: 'Venus, the goddess of love, arrives on the shore standing on a shell, blown by the winds. Painted in Renaissance Florence, it was one of the first large paintings of a story from ancient myth rather than the Bible.',
    hotspots: [
      { u: 0.5, v: 0.8, title: 'The scallop shell', text: 'In the myth, Venus was born from the sea foam. The shell carries her to land, a symbol of birth and beauty.' },
      { u: 0.17, v: 0.25, title: 'The winds', text: 'Zephyr, the west wind, blows Venus to the shore. Look at the flowers falling around him: spring arrives with her.' },
    ],
  },
  {
    id: 'mona', title: 'Mona Lisa', artist: 'Leonardo da Vinci', year: 1503, yearText: 'about 1503 to 1519',
    place: 'Louvre, Paris', medium: 'Oil on poplar wood', w: 53, h: 77,
    story: 'A portrait of Lisa Gherardini, the wife of a Florentine silk merchant. Leonardo worked on it for years and never gave it away. It became the most famous painting in the world after it was stolen from the Louvre in 1911.',
    hotspots: [
      { u: 0.5, v: 0.34, title: 'The smile', text: 'Leonardo blurred the corners of the mouth and eyes with soft layers of paint (sfumato, “smoky”). The smile seems to change as you look at it.' },
      { u: 0.16, v: 0.4, title: 'The landscape', text: 'An imaginary landscape of winding paths and water. It is higher on one side than the other, which makes the figure seem to shift.' },
    ],
  },
  {
    id: 'watch', title: 'The Night Watch', artist: 'Rembrandt van Rijn', year: 1642, yearText: '1642',
    place: 'Rijksmuseum, Amsterdam', medium: 'Oil on canvas', w: 453.5, h: 379.5,
    story: 'A company of Amsterdam’s civic guard, painted in the middle of moving off, rather than standing in neat rows as group portraits usually were. It is not even a night scene: dark varnish made it look like one, and gave it its name.',
    hotspots: [
      { u: 0.32, v: 0.62, title: 'The girl in the light', text: 'A small girl lit up in gold. She carries a chicken with large claws: the symbol of the company, the arquebusiers (claw: “klauw”).' },
      { u: 0.55, v: 0.66, title: 'The captain’s hand', text: 'The captain’s hand casts a shadow on his lieutenant’s coat: Rembrandt used light and shadow to make the figures leap out.' },
    ],
  },
  {
    id: 'pearl', title: 'Girl with a Pearl Earring', artist: 'Johannes Vermeer', year: 1665, yearText: 'about 1665',
    place: 'Mauritshuis, The Hague', medium: 'Oil on canvas', w: 39, h: 44.5,
    story: 'Not a portrait of a real person but a “tronie”, a study of a face and an expression. Vermeer painted slowly, with expensive pigments: the blue of the turban is ultramarine, made from ground lapis lazuli stone.',
    hotspots: [
      { u: 0.42, v: 0.55, title: 'The pearl', text: 'Just two strokes of paint: a bright highlight and the reflection of the white collar. It may not even be a pearl, but polished glass or tin.' },
    ],
  },
  {
    id: 'may3', title: 'The Third of May 1808', artist: 'Francisco Goya', year: 1814, yearText: '1814',
    place: 'Museo del Prado, Madrid', medium: 'Oil on canvas', w: 347, h: 268,
    story: 'French soldiers shoot Spanish civilians after a rising against Napoleon’s army in Madrid. Instead of heroes and glory, Goya painted ordinary people and the horror of war, and painters have followed him ever since (Picasso’s Guernica among them).',
    hotspots: [
      { u: 0.32, v: 0.42, title: 'The man in the white shirt', text: 'Lit by a lantern, arms raised like a martyr. There is a mark like a nail wound on his hand.' },
      { u: 0.72, v: 0.45, title: 'The soldiers', text: 'We never see their faces: a line of rifles and backs, like a machine. Goya makes them faceless on purpose.' },
    ],
  },
  {
    id: 'wave', title: 'The Great Wave off Kanagawa', artist: 'Katsushika Hokusai', year: 1831, yearText: 'about 1831',
    place: 'Many copies: the Metropolitan Museum, New York, the British Museum, London and others', medium: 'Woodblock print, ink and colour on paper', w: 37.9, h: 25.7,
    story: 'A woodblock print, so thousands were made and sold cheaply. A separate carved block printed each colour. Prints like this reached Europe and changed how painters such as Monet and Van Gogh saw composition and colour.',
    hotspots: [
      { u: 0.6, v: 0.7, title: 'Mount Fuji', text: 'The sacred mountain, tiny in the distance. This print is one of the series “Thirty-six Views of Mount Fuji”.' },
      { u: 0.3, v: 0.25, title: 'The claws of the wave', text: 'The foam curls like fingers or claws over three boats of fishermen. The new imported pigment Prussian blue made the deep blue possible.' },
    ],
  },
  {
    id: 'temeraire', title: 'The Fighting Temeraire', artist: 'J. M. W. Turner', year: 1839, yearText: '1839',
    place: 'National Gallery, London', medium: 'Oil on canvas', w: 121.6, h: 90.7,
    story: 'A great sailing warship that fought at Trafalgar is towed away by a small steam tug to be broken up for scrap. The age of sail gives way to the age of steam, painted as a blazing sunset.',
    hotspots: [
      { u: 0.33, v: 0.7, title: 'The steam tug', text: 'Small, dark and smoky, but it does the pulling: the new industrial age.' },
      { u: 0.85, v: 0.6, title: 'The sunset', text: 'Thick, glowing paint: the sun sets on the old ship and on an era.' },
    ],
  },
  {
    id: 'jatte', title: 'A Sunday on La Grande Jatte', artist: 'Georges Seurat', year: 1884, yearText: '1884 to 1886',
    place: 'Art Institute of Chicago', medium: 'Oil on canvas', w: 308, h: 207.6,
    story: 'Parisians relax on an island in the River Seine. Seurat spent two years on it, building every colour from tiny dots side by side, a method called pointillism, based on the science of how our eyes mix colours.',
    hotspots: [
      { u: 0.4, v: 0.25, title: 'Dots, not strokes', text: 'Look closely: dots of pure colour. From a distance your eyes blend them, making colours brighter than mixed paint.' },
      { u: 0.82, v: 0.62, title: 'The lady with the monkey', text: 'A fashionable lady with a parasol and a pet monkey on a lead. Everyone stands very still, like statues: modern life made timeless.' },
    ],
  },
  {
    id: 'starry', title: 'The Starry Night', artist: 'Vincent van Gogh', year: 1889, yearText: '1889',
    place: 'Museum of Modern Art, New York', medium: 'Oil on canvas', w: 92.1, h: 73.7,
    story: 'Painted from memory while Van Gogh was staying at a hospital in Saint-Rémy, in the south of France. The view from his window, the swirling sky and the village were brought together in thick, energetic brushstrokes.',
    hotspots: [
      { u: 0.2, v: 0.55, title: 'The cypress tree', text: 'A dark tree reaching up like a flame, linking the earth and the sky. Cypresses were often planted in cemeteries.' },
      { u: 0.47, v: 0.35, title: 'The swirling sky', text: 'Thick paint laid on in curving strokes (impasto). The sky seems to move, full of energy.' },
    ],
  },
  {
    id: 'scream', title: 'The Scream', artist: 'Edvard Munch', year: 1893, yearText: '1893',
    place: 'National Museum, Oslo', medium: 'Tempera and crayon on cardboard', w: 73.5, h: 91,
    story: 'Munch remembered a walk at sunset when he felt “a great, infinite scream pass through nature”. The figure is not screaming: it is covering its ears. The painting became a symbol of modern anxiety.',
    hotspots: [
      { u: 0.52, v: 0.55, title: 'The figure', text: 'Hardly a person at all: a skull-like face and a body that bends like the landscape. Feeling, not appearance.' },
      { u: 0.4, v: 0.1, title: 'The blood-red sky', text: 'Swirls of orange and red. Some think Munch remembered the red sunsets that followed the Krakatoa volcano in 1883.' },
    ],
  },
  {
    id: 'lilies', title: 'Water Lilies', artist: 'Claude Monet', year: 1906, yearText: '1906',
    place: 'Art Institute of Chicago', medium: 'Oil on canvas', w: 92.7, h: 87.6,
    story: 'Monet painted the pond in his own garden at Giverny about 250 times, at every hour and season. This is an Impressionist painting: an impression of light and colour, painted quickly, rather than every detail.',
    hotspots: [
      { u: 0.5, v: 0.45, title: 'Where is the sky?', text: 'There is no horizon. The blue and the clouds are reflections in the water: we look straight down at the pond.' },
    ],
  },
  {
    id: 'kiss', title: 'The Kiss', artist: 'Gustav Klimt', year: 1908, yearText: '1907 to 1908',
    place: 'Belvedere, Vienna', medium: 'Oil and gold leaf on canvas', w: 180, h: 180,
    story: 'Two lovers on the edge of a flowery meadow, wrapped in robes that turn into gold patterns. Klimt was the son of a gold engraver, and used real gold leaf, as in medieval religious paintings.',
    hotspots: [
      { u: 0.42, v: 0.4, title: 'Real gold', text: 'Thin sheets of gold leaf, laid onto the canvas. The man’s robe has square, upright shapes; the woman’s has round, flowing ones.' },
    ],
  },
];

/** World events for the timeline (year, text). */
export const EVENTS = [
  [1492, 'Columbus reaches the Americas'],
  [1517, 'The Protestant Reformation begins'],
  [1543, 'Copernicus: the Earth goes round the Sun'],
  [1606, 'The first Europeans reach Australia'],
  [1665, 'The Great Plague of London'],
  [1687, 'Newton’s laws of motion'],
  [1769, 'Watt’s steam engine'],
  [1789, 'The French Revolution'],
  [1805, 'The Battle of Trafalgar'],
  [1825, 'The first public steam railway'],
  [1839, 'Photography is invented'],
  [1859, 'Darwin: On the Origin of Species'],
  [1879, 'The electric light bulb'],
  [1903, 'The first powered flight'],
];

export const TIME = [1470, 1915]; // the timeline's ends
