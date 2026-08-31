// Ode to Joy — Beethoven, Symphony No. 9 (public domain). Our own
// arrangement as level data: first strain, two phrases, a gate on the
// dominant between them. Five-note range (do..sol) — the beginner level.

import type { LevelDef, MelodyDef } from './types'

const PHRASE_A: MelodyDef = {
  id: 'ode-a',
  name: 'Ode to Joy — first phrase',
  degrees: [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2],
  durations: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2],
  syllables: [
    'mi',
    'mi',
    'fa',
    'sol',
    'sol',
    'fa',
    'mi',
    're',
    'do',
    'do',
    're',
    'mi',
    'mi',
    're',
    're',
  ],
}

const PHRASE_B: MelodyDef = {
  id: 'ode-b',
  name: 'Ode to Joy — second phrase',
  degrees: [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0],
  durations: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2],
  syllables: [
    'mi',
    'mi',
    'fa',
    'sol',
    'sol',
    'fa',
    'mi',
    're',
    'do',
    'do',
    're',
    'mi',
    're',
    'do',
    'do',
  ],
}

export const ODE_TO_JOY: LevelDef = {
  id: 'ode-to-joy',
  title: 'Ode to Joy',
  intro:
    'Beethoven, laid out as a road. Every slab is the next note of the melody — follow the syllables and sing the line.',
  done: 'Ode to Joy, end to end. The melody was the map, and your voice walked it.',
  control: 'flow',
  segments: [
    { type: 'melody', melody: PHRASE_A },
    {
      type: 'encounter',
      kind: 'gate',
      at: 7,
      hint: 'Between the phrases, a gate — it rings on sol. Hold it.',
    },
    { type: 'melody', melody: PHRASE_B },
  ],
}
