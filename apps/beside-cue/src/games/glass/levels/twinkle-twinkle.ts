// Twinkle Twinkle Little Star — traditional melody (Ah! vous dirai-je,
// maman), lyrics Jane Taylor (1806). Public domain; our arrangement.
// The signature move: the leap from do straight up to sol, then repeat
// notes — sung as the English lyric, karaoke-style.

import type { LevelDef, MelodyDef } from './types'

const VERSE: MelodyDef = {
  id: 'twinkle-a',
  name: 'Twinkle — verse',
  degrees: [0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0],
  durations: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2],
  syllables: [
    'twin',
    'kle',
    'twin',
    'kle',
    'lit',
    'tle',
    'star',
    'how',
    'I',
    'won',
    'der',
    'what',
    'you',
    'are',
  ],
}

const MIDDLE: MelodyDef = {
  id: 'twinkle-b',
  name: 'Twinkle — middle',
  degrees: [7, 7, 5, 5, 4, 4, 2, 7, 7, 5, 5, 4, 4, 2],
  durations: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2],
  syllables: [
    'up',
    'a',
    'bove',
    'the',
    'world',
    'so',
    'high',
    'like',
    'a',
    'dia',
    'mond',
    'in',
    'the',
    'sky',
  ],
}

export const TWINKLE_TWINKLE: LevelDef = {
  id: 'twinkle-twinkle',
  title: 'Twinkle Twinkle',
  blurb:
    'The big leap up to sol, then the slow walk home. Verse, middle, verse.',
  intro:
    'The lullaby as a road: the famous leap from do up to sol, repeat notes to steady your voice, and the slow walk back down.',
  done: 'Twinkle Twinkle, sung whole. The leap up to sol is yours now.',
  control: 'flow',
  segments: [
    { type: 'melody', melody: VERSE },
    { type: 'melody', melody: MIDDLE },
    { type: 'melody', melody: VERSE },
  ],
}
