// Habanera — Georges Bizet, Carmen (1875), public domain; our
// simplified one-line arrangement. The signature skill: the CHROMATIC
// DESCENT — half step after half step walking down from the tonic, sung
// to the French lyric. The gate rings on the dominant below.

import type { LevelDef, MelodyDef } from './types'

const P1: MelodyDef = {
  id: 'habanera-1',
  name: 'Habanera — the descent',
  degrees: [0, -1, -2, -3, -4, -5],
  durations: [1, 0.5, 0.5, 1, 0.5, 1.5],
  syllables: ["l'a", 'mour', 'est', 'un', 'oi', 'seau'],
  bpm: 96,
}

const P2: MelodyDef = {
  id: 'habanera-2',
  name: 'Habanera — rebelle',
  degrees: [-5, -4, -3, -2, -3, -7],
  durations: [0.5, 0.5, 0.5, 0.5, 1, 1.5],
  syllables: ['re', 'bel', 'le', 'que', 'nul', 'sait'],
}

const P3: MelodyDef = {
  id: 'habanera-3',
  name: 'Habanera — prends garde',
  degrees: [0, -1, -2, -3, -4, -5],
  durations: [1, 0.5, 0.5, 1, 0.5, 2],
  syllables: ['si', 'je', "t'ai", 'me', 'prends', 'garde'],
}

export const HABANERA: LevelDef = {
  id: 'habanera',
  title: 'Habanera',
  blurb:
    'The chromatic walk down, half step by half step, with a gate on the low dominant.',
  intro:
    "Carmen's aria walks DOWN in half steps — every slab a semitone under the last. Descend with it, ring the low gate open, and descend once more.",
  done: 'The Habanera, walked whole. Down in half steps and back for more.',
  control: 'flow',
  // Half-step precision going DOWN: a tight band, and the descent keeps
  // moving — modest grace only.
  feel: {
    land: { bandSemis: 0.45, dwellMs: 650 },
    fall: { sinkGraceMs: 1300 },
    tap: { windowMs: 180 },
  },
  segments: [
    { type: 'melody', melody: P1 },
    { type: 'melody', melody: P2 },
    {
      type: 'encounter',
      kind: 'gate',
      at: -5,
      hint: 'The gate rings LOW — the dominant under your ground note.',
    },
    { type: 'melody', melody: P3 },
  ],
}
