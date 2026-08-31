// The Glassworks — the mechanics workshop level (2026-08-31).
// Three research-picked verbs in one short room, so new tricks are
// playable the moment they exist (game-mechanics-research.md §7):
//   1. Resonance Ring — hold the pane's note, then VIBRATO pumps it.
//   2. Steady Beam — one steady note is the bridge; wobble flakes it.
//   3. Improv Atrium — any in-key note raises a step; walk your own
//      melody out and land on home.
// The melody framing is our own original do-mi-sol motif (no borrowed
// tune — the mechanics are the song here).

import type { LevelDef, MelodyDef } from './types'

const P1: MelodyDef = {
  id: 'gw-p1',
  name: 'Warming the room',
  degrees: [0, 4, 7],
  durations: [1, 1, 1.5],
  syllables: ['do', 'mi', 'sol'],
  bpm: 84,
}

const P2: MelodyDef = {
  id: 'gw-p2',
  name: 'Down from the ring',
  degrees: [7, 5, 4],
  durations: [1, 1, 1.5],
  syllables: ['sol', 'fa', 'mi'],
}

const P3: MelodyDef = {
  id: 'gw-p3',
  name: 'To the open room',
  degrees: [4, 2, 0],
  durations: [1, 1, 1.5],
  syllables: ['mi', 're', 'do'],
}

const HOME: MelodyDef = {
  id: 'gw-home',
  name: 'Home',
  degrees: [0],
  durations: [2],
  syllables: ['home'],
}

export const THE_GLASSWORKS: LevelDef = {
  id: 'the-glassworks',
  title: 'The Glassworks',
  chip: 'Workshop',
  blurb: 'Three new tricks: the ring, the beam, the open room.',
  intro:
    'The workshop where glass is taught to sing back. Hold a note and the round pane rings — then let your voice WAVE to burst it. A steady note is a bridge. And in the open room, every note you sing builds the floor.',
  done: 'The workshop is yours — ring, beam, and a floor built from your own notes.',
  control: 'flow',
  feel: {
    land: { bandSemis: 0.9, dwellMs: 500 },
    fall: { sinkGraceMs: 2200 },
  },
  segments: [
    { type: 'melody', melody: P1 },
    { type: 'encounter', kind: 'ring', at: 7 },
    { type: 'rest', beats: 1 },
    { type: 'melody', melody: P2 },
    { type: 'beam', at: 4, beats: 4 },
    { type: 'melody', melody: P3 },
    { type: 'atrium', beats: 8 },
    { type: 'melody', melody: HOME },
  ],
}
