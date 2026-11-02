// ============================================================
// Merc's lines for Harmony: one table, easy to swap
// ============================================================
//
// The room kit's room-lines.ts picks the next line for a moment, never the
// same one twice running, and fills its fields: `{from}` is Merc's note
// and `{note}` the harmony's at the note that missed ("B3", "D4"), and
// `{way}` above or below.
//
// A result's counts are on its card, so the result lines leave them out:
// each says what the run asks of the singer next, in words Merc can say
// aloud from a recording (room-kit merc-speech.ts).
//
// The owner's rule for every room's lines holds (11 Oct 2026): plain words,
// one register, each line says what the voice did and what to do about it.
// Merc speaks before a line and between lines, and says nothing while the
// singer sings, alone or with him.

import type { LineTable } from '@/components/room-kit/room-lines'
import { createRoomLines } from '@/components/room-kit/room-lines'

export type HarmonyMoment =
  | 'intro'
  | 'introBoth'
  | 'introTogether'
  | 'introBothTogether'
  | 'call'
  | 'callBoth'
  | 'callBelow'
  | 'callTogether'
  | 'callBothTogether'
  | 'landed'
  | 'landedBelow'
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

export interface HarmonyLineFields {
  readonly from?: string
  readonly note?: string
  readonly way?: string
}

export const HARMONY_LINES_TABLE: LineTable<HarmonyMoment> = {
  intro: [
    {
      id: 'intro-third',
      text: 'I sing my line. You sing it a third higher.',
    },
    {
      id: 'intro-lamps',
      text: 'My line is the teal lamps. Yours is the gold, a third above.',
    },
  ],
  // Learning: Merc sings the harmony too, before the singer's turn.
  introBoth: [
    {
      id: 'both-first',
      text: 'I sing my line, then yours. Then you sing yours, a third above.',
    },
  ],
  introTogether: [
    {
      id: 'together-first',
      text: 'Headphones on. I sing my line, then we sing it together.',
    },
  ],
  // Learning, together: the harmony first from him, then both voices.
  introBothTogether: [
    {
      id: 'both-together-first',
      text: 'Headphones on. I sing my line, then yours. Then we sing them together.',
    },
  ],
  call: [{ id: 'call-first', text: 'My line first. Then yours, a third up.' }],
  callBoth: [
    { id: 'call-both', text: 'My line, then yours. Then you sing it.' },
  ],
  callBelow: [
    {
      id: 'call-below',
      text: 'This one goes under me. Yours is a third down.',
    },
  ],
  callTogether: [
    { id: 'call-together', text: 'My line first. Then sing yours with me.' },
  ],
  callBothTogether: [
    {
      id: 'call-both-together',
      text: 'My line, then yours. Then sing yours with me.',
    },
  ],
  landed: [
    { id: 'landed-harmony', text: 'In harmony. Next line.' },
    { id: 'landed-third', text: 'Every note a third above.' },
  ],
  landedBelow: [{ id: 'landed-below', text: 'Every note a third below.' }],
  missed: [
    {
      id: 'missed-listen',
      text: 'Not quite. Listen: {from}, then {note} {way} it.',
    },
  ],
  missedShort: [
    {
      id: 'short-of',
      text: 'Short of it. Listen: {from}, then {note} {way} it.',
    },
  ],
  missedOver: [
    { id: 'over-past', text: 'Past it. Listen: {from}, then {note} {way} it.' },
  ],
  missedSilent: [
    {
      id: 'silent-line',
      text: "I didn't hear that note. Listen: {from}, then {note} {way} it.",
    },
  ],
  resultAll: [
    {
      id: 'all-harmony',
      text: 'Every line in harmony. When it feels easy, try the next level.',
    },
  ],
  resultMost: [
    {
      id: 'most-harmony',
      text: 'A good run. Tap a line to hear it in two voices.',
    },
  ],
  resultSome: [
    {
      id: 'some-harmony',
      text: 'Hear my note, then find the third from it before you sing.',
    },
  ],
  resultNone: [
    {
      id: 'none-learning',
      text: 'Harmony takes a few runs. At Learning, I sing your line first.',
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

export function createHarmonyLines(random: () => number = Math.random) {
  return createRoomLines<HarmonyMoment, HarmonyLineFields>(
    HARMONY_LINES_TABLE,
    random,
  )
}
