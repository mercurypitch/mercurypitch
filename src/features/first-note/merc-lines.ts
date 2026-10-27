// ============================================================
// Merc's lines for First note: one table, easy to swap
// ============================================================
//
// The room kit's room-lines.ts picks the next line for a moment, never the
// same one twice running, and fills its fields: `{note}` is the entry's
// note ("E3"), `{onNote}`, `{found}` and `{rounds}` are counts, `{level}`
// a level's name.
//
// The owner's rule for every room's lines holds (11 Oct 2026): plain words,
// one register, each line says what the voice did and what to do about it.
// Merc speaks between rounds only, never while the band plays or the
// singer sings.

import type { LineTable } from '@/components/room-kit/room-lines'
import { createRoomLines } from '@/components/room-kit/room-lines'

export type FirstMoment =
  | 'intro'
  | 'introLine'
  | 'landedOnNote'
  | 'landed'
  | 'missed'
  | 'missedSilent'
  | 'songFailed'
  | 'resultAll'
  | 'resultMost'
  | 'resultSome'
  | 'resultNone'
  | 'newBest'
  | 'silentRun'

export interface FirstLineFields {
  readonly note?: string
  readonly onNote?: number
  readonly found?: number
  readonly rounds?: number
  readonly level?: string
}

export const FIRST_LINES: LineTable<FirstMoment> = {
  intro: [
    {
      id: 'intro-stop',
      text: "I'll play a song and stop the band where the singer comes in. Sing their first note.",
    },
    {
      id: 'intro-entry',
      text: 'When the band stops, come in on the first note, in any octave. The line shows once you do.',
    },
  ],
  // Learning: the note's line is there from the start.
  introLine: [
    {
      id: 'line-slide',
      text: 'When the band stops, sing the first note. The line shows you where it is.',
    },
  ],
  landedOnNote: [
    {
      id: 'on-straight',
      text: 'Right on it. Here comes the singer, with you.',
    },
    { id: 'on-ear', text: 'You came in on the note. Hear them join you.' },
  ],
  landed: [
    {
      id: 'found-there',
      text: 'There it is. Now the singer comes in with you.',
    },
    { id: 'found-start', text: 'Found it. Hear how the line starts.' },
  ],
  missed: [
    {
      id: 'missed-was',
      text: "It was {note}. Hear it, then the singer's way in.",
    },
    {
      id: 'missed-listen',
      text: 'Not this time: {note}. Listen to the singer come in on it.',
    },
  ],
  missedSilent: [
    {
      id: 'silent-sing',
      text: "I didn't hear you. When the band stops, sing. It was {note}.",
    },
  ],
  songFailed: [
    {
      id: 'song-failed',
      text: "That song wouldn't play just now. Tap the mic to try again.",
    },
  ],
  resultAll: [
    {
      id: 'all-on',
      text: 'Every entry on the note. You hear where a song wants you.',
    },
  ],
  resultMost: [
    {
      id: 'most-bar',
      text: "{onNote} of {rounds} on the note. The band's last bar often holds the singer's note.",
    },
  ],
  resultSome: [
    {
      id: 'some-hum',
      text: '{onNote} of {rounds} on the note. Hum along with the band, then come in where it stops.',
    },
  ],
  resultNone: [
    {
      id: 'none-learning',
      text: 'Coming in on a note takes practice. At Learning, the line shows from the start.',
    },
  ],
  newBest: [
    {
      id: 'best-new',
      text: 'A new best: {onNote} of {rounds} on the note at {level}.',
    },
  ],
  silentRun: [
    {
      id: 'silent-run',
      text: "I didn't hear a voice that run. Tap the mic when you're ready.",
    },
  ],
}

export function createFirstLines(random: () => number = Math.random) {
  return createRoomLines<FirstMoment, FirstLineFields>(FIRST_LINES, random)
}
