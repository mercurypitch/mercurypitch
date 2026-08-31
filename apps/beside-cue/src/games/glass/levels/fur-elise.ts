// Für Elise — Ludwig van Beethoven (1810), public domain; our
// arrangement of the opening theme, melody line only. The signature
// skill: SEMITONE neighbors — mi/ri (E/D#) trilling a half step apart,
// the finest pitch control in the songbook. Chromatic solfege syllables
// (ri = raised re, si = raised sol).

import type { LevelDef, MelodyDef } from './types'

const P1: MelodyDef = {
  id: 'elise-1',
  name: 'Für Elise — the turn',
  degrees: [7, 6, 7, 6, 7, 2, 5, 3, 0],
  durations: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1],
  syllables: ['mi', 'ri', 'mi', 'ri', 'mi', 'ti', 're', 'do', 'la'],
  bpm: 76,
}

const P2: MelodyDef = {
  id: 'elise-2',
  name: 'Für Elise — rise from below',
  degrees: [-9, -5, 0, 2],
  durations: [0.5, 0.5, 0.5, 1],
  syllables: ['do', 'mi', 'la', 'ti'],
}

const P3: MelodyDef = {
  id: 'elise-3',
  name: 'Für Elise — the answer',
  degrees: [-5, -1, 2, 3],
  durations: [0.5, 0.5, 0.5, 1],
  syllables: ['mi', 'si', 'ti', 'do'],
}

const P4: MelodyDef = {
  id: 'elise-4',
  name: 'Für Elise — the turn, home',
  degrees: [7, 6, 7, 6, 7, 2, 5, 3, 0],
  durations: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2],
  syllables: ['mi', 'ri', 'mi', 'ri', 'mi', 'ti', 're', 'do', 'la'],
}

export const FUR_ELISE: LevelDef = {
  id: 'fur-elise',
  title: 'Für Elise',
  blurb:
    'The famous turn: mi and ri a half step apart. The finest control in the book.',
  intro:
    'Beethoven opens with two notes a SEMITONE apart — the smallest step there is. Trill the turn, dip to the low answer, and bring it home.',
  done: 'Für Elise, sung whole. Half steps hold no fear now.',
  control: 'flow',
  // Semitone neighbors ask for a fine band; everything else stays kind.
  feel: {
    land: { bandSemis: 0.5, dwellMs: 650 },
    // the song IS semitone control — the ear-gap follows it down
    listen: { gapSemis: 2 },
  },
  segments: [
    { type: 'melody', melody: P1 },
    { type: 'melody', melody: P2 },
    { type: 'melody', melody: P3 },
    { type: 'melody', melody: P4 },
  ],
}
