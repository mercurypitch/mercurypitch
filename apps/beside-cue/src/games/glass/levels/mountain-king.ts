// In the Hall of the Mountain King — Edvard Grieg (1875), public
// domain; our arrangement of the theme, simplified to one line. The
// signature skill: the CHASE — the same phrase three times, each pass
// quicker than the last (durations shrink per segment; geometry is
// time, so the road itself accelerates). Chromatic solfege: me = flat
// mi, fi = raised fa, ra = flat re.

import type { LevelDef, MelodyDef } from './types'

const THEME_DEGREES = [
  0, 2, 3, 5, 7, 3, 7, 6, 2, 6, 5, 1, 5, 0, 2, 3, 5, 7, 3, 7, 0,
]
const THEME_SYLLABLES = [
  'do',
  're',
  'me',
  'fa',
  'sol',
  'me',
  'sol',
  'fi',
  're',
  'fi',
  'fa',
  'ra',
  'fa',
  'do',
  're',
  'me',
  'fa',
  'sol',
  'me',
  'sol',
  'do',
]
const durationsAt = (scale: number): number[] =>
  [
    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0.5,
    0.5, 0.5, 0.5, 0.5, 1.5,
  ].map((d) => d * scale)

const pass = (n: 1 | 2 | 3, scale: number): MelodyDef => ({
  id: `mountain-${n}`,
  name: `Mountain King — pass ${n}`,
  degrees: [...THEME_DEGREES],
  durations: durationsAt(scale),
  syllables: [...THEME_SYLLABLES],
  bpm: 112,
})

export const MOUNTAIN_KING: LevelDef = {
  id: 'mountain-king',
  title: 'Mountain King',
  blurb:
    'The chase: the same phrase three times, each pass faster. Do not look back.',
  intro:
    'Grieg wrote a tiptoe that becomes a stampede. The phrase repeats three times and the road tightens each pass — keep your feet under the tune.',
  done: 'Out of the hall. The Mountain King keeps none who can sing the chase.',
  control: 'flow',
  // The chase needs narrow slabs to actually accelerate (minWidth would
  // clamp the quick passes flat), and it plays strict: short grace,
  // one air correction, a real rhythm fail state.
  feel: {
    melody: { minWidth: 0.6 },
    fall: { sinkGraceMs: 1200 },
    control: { airReliftMax: 1 },
    tap: { windowMs: 180, maxMisses: 10 },
  },
  segments: [
    { type: 'melody', melody: pass(1, 1) },
    { type: 'rest', beats: 1 },
    { type: 'melody', melody: pass(2, 0.85) },
    { type: 'rest', beats: 1 },
    { type: 'melody', melody: pass(3, 0.7) },
  ],
}
