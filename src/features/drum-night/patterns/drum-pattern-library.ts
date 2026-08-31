// ============================================================
// Drum pattern library — idiom grooves, one straight grid each
// ============================================================
//
// Every groove here is written for this app, so the whole catalog ships without
// a third-party license obligation. The `provenance` field exists so a corpus
// -seeded pattern (the Groove MIDI Dataset, or a player's own collection) can
// join later carrying its attribution, with no schema change.
//
// Grids are straight sixteenths. Swing lives in ../groove/groove-humanize.ts,
// which is why the jazz grooves below are notated on plain eighths: at a jazz
// feel the engine pushes the off-eighths out to the Friberg ratio for the
// tempo, and at intensity 0 they stay straight for practice.
//
//   step  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
//   beat  1  e  &  a  2  e  &  a  3  e  &  a  4  e  &  a

import type { DrumPattern, DrumPatternStyle } from './drum-pattern'

const ORIGINAL = Object.freeze({
  attribution: 'MercuryPitch original groove.',
  license: 'original',
})

export const DRUM_PATTERNS: readonly DrumPattern[] = Object.freeze([
  // ---------------------------------------------------------------- rock ---
  {
    id: 'rock-straight-backbeat',
    name: 'Straight Backbeat',
    style: 'rock',
    description:
      'The default rock pocket: eighth-note hats, snare on two and four, kick on one and three with a push into the turnaround.',
    bars: 2,
    tempoBpm: 104,
    tempoRange: [78, 138],
    lanes: {
      crash: 'X---------------|----------------',
      'hh-closed': 'X-x-X-x-X-x-X-x-|X-x-X-x-X-x-X-x-',
      snare: '----X-------X---|----X-------X---',
      kick: 'X-------X--x----|X-------X--x--x-',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'rock-half-time-anthem',
    name: 'Half-Time Anthem',
    style: 'rock',
    description:
      'One backbeat per bar on beat three, leaving the kick room to walk underneath it.',
    bars: 2,
    tempoBpm: 78,
    tempoRange: [62, 96],
    lanes: {
      crash: 'X---------------|----------------',
      'hh-closed': 'X-x-x-x-X-x-x-x-|X-x-x-x-X-x-x-x-',
      snare: '--------X-------|--------X-------',
      kick: 'X-----x---x-----|X-----x---x---x-',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'rock-driving-eighths',
    name: 'Driving Eighths',
    style: 'rock',
    description:
      'Kick on every quarter under a hard backbeat — the punk and hard-rock engine room.',
    bars: 2,
    tempoBpm: 152,
    tempoRange: [128, 192],
    lanes: {
      crash: 'X---------------|X---------------',
      'hh-closed': 'X-x-X-x-X-x-X-x-|X-x-X-x-X-x-X-x-',
      snare: '----X-------X---|----X-------X---',
      kick: 'X---x---X---x---|X---x---X---x-x-',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'rock-open-hat-lift',
    name: 'Open-Hat Lift',
    style: 'rock',
    description:
      'A closed-hat groove that opens on the last eighth of each bar to lift the turnaround.',
    bars: 2,
    tempoBpm: 118,
    tempoRange: [96, 146],
    lanes: {
      'hh-closed': 'X-x-X-x-X-x-X---|X-x-X-x-X-x-X---',
      'hh-open': '--------------x-|--------------x-',
      snare: '----X-------X---|----X---o---X---',
      kick: 'X--x--X---x-----|X--x--X---x-----',
    },
    provenance: ORIGINAL,
  },

  // ---------------------------------------------------------------- funk ---
  {
    id: 'funk-sixteenth-pocket',
    name: 'Sixteenth Pocket',
    style: 'funk',
    description:
      'Sixteenth hats with accents on one and three, ghost snares filling the gaps around the backbeat.',
    bars: 2,
    tempoBpm: 98,
    tempoRange: [84, 116],
    lanes: {
      'hh-closed': 'XoxoxoxoXoxoxoxo|XoxoxoxoXoxoxoxo',
      snare: '--o-X--o--o-X-o-|--o-X--o--o-X-o-',
      kick: 'X-----x----x----|X-----x--x-x----',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'funk-ghost-pocket',
    name: 'Ghost Pocket',
    style: 'funk',
    description:
      'A sparser funk feel where the snare hand is mostly ghosts and the kick carries the syncopation.',
    bars: 2,
    tempoBpm: 104,
    tempoRange: [88, 124],
    lanes: {
      'hh-closed': 'X-x-x-x-X-x-x-x-|X-x-x-x-X-x-x-x-',
      snare: '--o-X-o---o-X-o-|--o-X-o---o-X---',
      kick: 'X--x----x-------|X--x----x---x---',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'funk-open-hat-push',
    name: 'Open-Hat Push',
    style: 'funk',
    description:
      'The hat opens on the last sixteenth of every bar, pushing the loop back around.',
    bars: 2,
    tempoBpm: 110,
    tempoRange: [92, 130],
    lanes: {
      'hh-closed': 'x-x-x-x-x-x-x---|x-x-x-x-x-x-x---',
      'hh-open': '--------------x-|--------------x-',
      snare: '----X---o---X---|----X---o---X-o-',
      kick: 'X--x--X---x-----|X--x--X---x--x--',
    },
    provenance: ORIGINAL,
  },

  // ---------------------------------------------------------------- jazz ---
  {
    id: 'jazz-ride-swing',
    name: 'Ride & Feathered Kick',
    style: 'jazz',
    description:
      'The standard ride pattern with the hi-hat pedal on two and four and a barely-there kick under all four.',
    bars: 2,
    tempoBpm: 168,
    tempoRange: [120, 220],
    lanes: {
      ride: 'X---x-x-X---x-x-|X---x-x-X---x-x-',
      'hh-pedal': '----x-------x---|----x-------x---',
      kick: 'o---o---o---o---|o---o---o---o---',
      snare: '----------------|------o---o-----',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'jazz-comping',
    name: 'Comping Snare',
    style: 'jazz',
    description:
      'The same ride with an answering left hand — snare accents placed off the ride to break the loop up.',
    bars: 2,
    tempoBpm: 152,
    tempoRange: [110, 200],
    lanes: {
      ride: 'X---x-x-X---x-x-|X---x-x-X---x-x-',
      'hh-pedal': '----x-------x---|----x-------x---',
      snare: '------x---o-----|--o-------x---o-',
      kick: 'o-------o-------|o-----x-o-------',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'jazz-uptempo',
    name: 'Up-Tempo Ride',
    style: 'jazz',
    description:
      'Fast enough that the swing ratio flattens out on its own — sparse comping, pedal on two and four.',
    bars: 2,
    tempoBpm: 232,
    tempoRange: [190, 300],
    lanes: {
      ride: 'X---x-x-X---x-x-|X---x-x-X---x-x-',
      'hh-pedal': '----x-------x---|----x-------x---',
      snare: '--------o-------|------------o---',
    },
    provenance: ORIGINAL,
  },

  // --------------------------------------------------------------- latin ---
  {
    id: 'latin-bossa-nova',
    name: 'Bossa Nova',
    style: 'latin',
    description:
      'Cross-stick on the 3-2 son clave over steady eighths, kick on one and the and of three.',
    bars: 2,
    tempoBpm: 132,
    tempoRange: [104, 160],
    lanes: {
      'hh-closed': 'x-x-x-x-x-x-x-x-|x-x-x-x-x-x-x-x-',
      sidestick: 'X-----X-----X---|----X---X-------',
      kick: 'X---------X-----|X---------X-----',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'latin-songo',
    name: 'Songo',
    style: 'latin',
    description:
      'Clave on the cross-stick with tom answers and a kick that leans on the and of two.',
    bars: 2,
    tempoBpm: 100,
    tempoRange: [86, 122],
    lanes: {
      'hh-closed': 'x-x-x-x-x-x-x-x-|x-x-x-x-x-x-x-x-',
      sidestick: 'X-----X-----X---|----X---X-------',
      'tom-high': '------------x---|--------x-------',
      'tom-low': '--------x-------|------------x---',
      kick: 'X-----x---X-----|X-----x---X---x-',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'latin-samba',
    name: 'Samba',
    style: 'latin',
    description:
      'Surdo-weighted kick on every eighth with the accent falling on two and four, sixteenth hats above it.',
    bars: 2,
    tempoBpm: 196,
    tempoRange: [160, 240],
    lanes: {
      'hh-closed': 'xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo',
      sidestick: 'X-----X-----X---|----X---X-------',
      kick: 'x---X---x---X---|x---X---x---X---',
    },
    provenance: ORIGINAL,
  },

  // ---------------------------------------------------------- electronic ---
  {
    id: 'electronic-four-on-floor',
    name: 'Four on the Floor',
    style: 'electronic',
    description:
      'Kick on every quarter, clap on the backbeat, hats on the offbeats — the house default.',
    bars: 2,
    tempoBpm: 124,
    tempoRange: [112, 134],
    lanes: {
      kick: 'X---X---X---X---|X---X---X---X---',
      clap: '----X-------X---|----X-------X---',
      'hh-closed': '--x---x---x---x-|--x---x---x-----',
      'hh-open': '----------------|--------------x-',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'electronic-breakbeat',
    name: 'Breakbeat',
    style: 'electronic',
    description:
      'A chopped two-bar break: displaced kicks, a ghosted snare pickup, straight eighth hats holding the grid.',
    bars: 2,
    tempoBpm: 168,
    tempoRange: [140, 180],
    lanes: {
      'hh-closed': 'x-x-x-x-x-x-x-x-|x-x-x-x-x-x-x-x-',
      snare: '----X------oX---|----X-o----X----',
      kick: 'X--x------x-----|X--x----X-------',
    },
    provenance: ORIGINAL,
  },
  {
    id: 'electronic-trap-roll',
    name: 'Trap Roll',
    style: 'electronic',
    description:
      'Half-time clap on three with rolling sixteenth hats and a kick that answers underneath.',
    bars: 2,
    tempoBpm: 140,
    tempoRange: [124, 160],
    lanes: {
      'hh-closed': 'X-xxX-xxX-xxXxxx|X-xxX-xxX-xxXxxx',
      clap: '--------X-------|--------X-------',
      kick: 'X-----x---X-----|X-----x-----x---',
    },
    provenance: ORIGINAL,
  },
])

export const DRUM_PATTERN_STYLE_ORDER: readonly DrumPatternStyle[] =
  Object.freeze(['rock', 'funk', 'jazz', 'latin', 'electronic'])

export const DRUM_PATTERN_STYLE_LABELS: Readonly<
  Record<DrumPatternStyle, string>
> = Object.freeze({
  rock: 'Rock',
  funk: 'Funk',
  jazz: 'Jazz',
  latin: 'Latin',
  electronic: 'Electronic',
})

export function drumPatternsForStyle(
  style: DrumPatternStyle,
): readonly DrumPattern[] {
  return DRUM_PATTERNS.filter((pattern) => pattern.style === style)
}

export function findDrumPattern(id: string): DrumPattern | null {
  return DRUM_PATTERNS.find((pattern) => pattern.id === id) ?? null
}
