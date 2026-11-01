// ============================================================
// Merc's lines for Leap: one table, easy to swap
// ============================================================
//
// The room kit's room-lines.ts picks the next line for a moment, never the
// same one twice running, and fills its fields: `{leap}` is the leap's
// name ("Up a fifth"), `{size}` its size alone ("fifth"), `{song}` the
// song that opens on it ("Twinkle, Twinkle"), `{from}` and `{note}` Merc's
// note and the target ("G3", "D4") and `{way}` up or down.
//
// A result's counts are on its card, so the result lines leave them out:
// each says what the run asks of the singer next, in words Merc can say
// aloud from a recording (room-kit merc-speech.ts).
//
// The owner's rule for every room's lines holds (11 Oct 2026): plain words,
// one register, each line says what the voice did and what to do about it.
// Merc names the leap as he calls it, and speaks between leaps, never
// while the singer sings.

import type { LineTable } from '@/components/room-kit/room-lines'
import { createRoomLines } from '@/components/room-kit/room-lines'

export type LeapMoment =
  | 'intro'
  | 'introMatch'
  | 'call'
  | 'callMatch'
  | 'callPlain'
  | 'landed'
  | 'landedSong'
  | 'missed'
  | 'missedShort'
  | 'missedOver'
  | 'missedSilent'
  | 'resultAll'
  | 'resultMost'
  | 'resultSome'
  | 'resultNone'
  | 'newBest'
  | 'silentRun'

export interface LeapLineFields {
  readonly leap?: string
  readonly size?: string
  readonly song?: string
  readonly from?: string
  readonly note?: string
  readonly way?: string
}

export const LEAP_LINES: LineTable<LeapMoment> = {
  intro: [
    {
      id: 'intro-ledges',
      text: 'I sing a note and name a leap. Sing my note, then leap to the far ledge.',
    },
    {
      id: 'intro-lantern',
      text: "Each note is a ledge. Sing mine, then leap: the lantern lights when you're there.",
    },
  ],
  // Learning: Merc sings both notes, and the singer matches them.
  introMatch: [
    {
      id: 'match-both',
      text: "I'll sing both notes of each leap. Sing them back to me.",
    },
  ],
  call: [
    {
      id: 'call-song',
      text: "{leap}: the leap that opens {song}. Here's my note.",
    },
  ],
  callMatch: [
    {
      id: 'match-song',
      text: '{leap}, as {song} opens. Both notes, then you.',
    },
  ],
  callPlain: [{ id: 'plain-note', text: "{leap}. Here's my note." }],
  landed: [
    { id: 'landed-on', text: 'Landed on {note}.' },
    { id: 'landed-leap', text: 'That was the {size}. Next leap.' },
  ],
  landedSong: [
    { id: 'song-opens', text: "That's the {size}, the way {song} opens." },
    { id: 'song-landed', text: 'Landed. {song} starts on that leap.' },
  ],
  missed: [
    {
      id: 'missed-listen',
      text: 'Not quite. Listen: {from}, {way} to {note}.',
    },
  ],
  missedShort: [
    { id: 'short-of', text: 'Short of it. Listen: {from}, {way} to {note}.' },
  ],
  missedOver: [
    { id: 'over-past', text: 'Past it. Listen: {from}, {way} to {note}.' },
  ],
  missedSilent: [
    {
      id: 'silent-leap',
      text: "I didn't hear you. Sing my note, then leap. Listen: {from}, {way} to {note}.",
    },
  ],
  resultAll: [
    {
      id: 'all-landed',
      text: 'Every leap landed. When it feels easy, try the next level.',
    },
  ],
  resultMost: [
    {
      id: 'most-landed',
      text: 'A good run. Tap a leap below to hear it again.',
    },
  ],
  resultSome: [
    {
      id: 'some-landed',
      text: "Hear each leap's song in your head before you leap.",
    },
  ],
  resultNone: [
    {
      id: 'none-learning',
      text: 'Leaps take a few runs. At Learning, I sing both notes first and you match me.',
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

export function createLeapLines(random: () => number = Math.random) {
  return createRoomLines<LeapMoment, LeapLineFields>(LEAP_LINES, random)
}
