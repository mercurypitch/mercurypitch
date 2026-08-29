// Frère Jacques — traditional French round, public domain; our
// arrangement. Faster contour: the "sonnez les matines" eighth-note run,
// and a dip BELOW the tonic on "dang" — the first level whose window
// reaches under the ground note.

import type { LevelDef, MelodyDef } from './types'

const P1: MelodyDef = {
  id: 'frere-1',
  name: 'Frère Jacques — call',
  degrees: [0, 2, 4, 0, 0, 2, 4, 0],
  durations: [1, 1, 1, 1, 1, 1, 1, 1],
  syllables: ['frè', 're', 'jac', 'ques', 'frè', 're', 'jac', 'ques'],
}

const P2: MelodyDef = {
  id: 'frere-2',
  name: 'Frère Jacques — dormez-vous',
  degrees: [4, 5, 7, 4, 5, 7],
  durations: [1, 1, 2, 1, 1, 2],
  syllables: ['dor', 'mez', 'vous', 'dor', 'mez', 'vous'],
}

const P3: MelodyDef = {
  id: 'frere-3',
  name: 'Frère Jacques — sonnez les matines',
  degrees: [7, 9, 7, 5, 4, 0, 7, 9, 7, 5, 4, 0],
  durations: [0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1],
  syllables: [
    'son',
    'nez',
    'les',
    'ma',
    'ti',
    'nes',
    'son',
    'nez',
    'les',
    'ma',
    'ti',
    'nes',
  ],
}

const P4: MelodyDef = {
  id: 'frere-4',
  name: 'Frère Jacques — ding dang dong',
  degrees: [0, -5, 0, 0, -5, 0],
  durations: [1, 1, 2, 1, 1, 2],
  syllables: ['ding', 'dang', 'dong', 'ding', 'dang', 'dong'],
}

export const FRERE_JACQUES: LevelDef = {
  id: 'frere-jacques',
  title: 'Frère Jacques',
  blurb:
    'The round: a quick matines run, and a bell that dips below your ground note.',
  intro:
    'The round, phrase by phrase. The matines run moves quickly, and the bells at the end dip BELOW your ground note — the first road that goes under the start.',
  done: 'Frère Jacques rung through — quick run, low bell and all.',
  control: 'flow',
  segments: [
    { type: 'melody', melody: P1 },
    { type: 'melody', melody: P2 },
    { type: 'melody', melody: P3 },
    { type: 'melody', melody: P4 },
  ],
}
