// ============================================================
// Merc's lines for Home note: one table, easy to swap
// ============================================================
//
// The room kit's room-lines.ts picks the next line for a moment, never the
// same one twice running, and fills its fields: `{note}` is home's name
// ("D4").
//
// A result's counts are on its card, so the result lines leave them out:
// each says what the run asks of the singer next, in words Merc can say
// aloud from a recording (room-kit merc-speech.ts).
//
// The owner's rule for every room's lines holds (11 Oct 2026): plain words,
// one register, each line says what the voice did and what to do about it.
// Merc speaks between rounds only, never while the band plays or the
// singer sings.

import type { LineTable } from '@/components/room-kit/room-lines'
import { createRoomLines } from '@/components/room-kit/room-lines'

export type HomeMoment =
  | 'intro'
  | 'introMatch'
  | 'landed'
  | 'landedQuick'
  | 'missed'
  | 'missedSilent'
  | 'resultAll'
  | 'resultMost'
  | 'resultSome'
  | 'resultNone'
  | 'newBest'
  | 'silentRun'

export interface HomeLineFields {
  readonly note?: string
}

export const HOME_LINES: LineTable<HomeMoment> = {
  intro: [
    {
      id: 'intro-feels',
      text: 'The band plays a few chords and stops. Sing the note that feels like home.',
    },
    {
      id: 'intro-karaoke',
      text: 'Like a song after its intro: hear the chords, then find home and sing it.',
    },
  ],
  // Learning: Merc sings home after the band, and the singer matches it.
  introMatch: [
    {
      id: 'match-after',
      text: "I'll sing home after the band. Sing it back to me, any octave.",
    },
  ],
  landed: [
    { id: 'landed-home', text: "That's home. Hear the band settle on it." },
    { id: 'landed-there', text: 'You found it. Next key.' },
  ],
  landedQuick: [
    { id: 'quick-straight', text: 'Straight home, first try.' },
    { id: 'quick-ear', text: 'Your ear knew that one.' },
  ],
  missed: [
    {
      id: 'missed-here',
      text: 'Home was {note}. Hear how the chord rests on it.',
    },
    {
      id: 'missed-close',
      text: 'Not quite. This is {note}, where the chords wanted to land.',
    },
  ],
  missedSilent: [
    {
      id: 'silent-sing',
      text: "I didn't hear you. When the band stops, sing. Home was {note}.",
    },
  ],
  resultAll: [
    {
      id: 'all-home',
      text: 'Every key, home. When it feels easy, try the next level.',
    },
  ],
  resultMost: [
    {
      id: 'most-home',
      text: 'A good run. Next time, hum along with the chords: home is the note they lean on.',
    },
  ],
  resultSome: [
    {
      id: 'some-home',
      text: 'Home gets easier the more keys you hear it in.',
    },
  ],
  resultNone: [
    {
      id: 'none-learning',
      text: 'Home takes a few runs. At Learning, I sing it first and you match me.',
    },
  ],
  newBest: [{ id: 'best-new', text: 'A new best at this level.' }],
  silentRun: [
    {
      id: 'silent-run',
      text: "I didn't hear a voice that run. Tap the mic when you're ready.",
    },
  ],
}

export function createHomeLines(random: () => number = Math.random) {
  return createRoomLines<HomeMoment, HomeLineFields>(HOME_LINES, random)
}
