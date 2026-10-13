// ============================================================
// Merc's lines for Echo: one table, easy to swap
// ============================================================
//
// The room kit's selector (line-selector.ts) picks the next line for a
// moment and never says the same one twice running. Echo's lines name more
// than the note: `{nth}` is a note's place in the phrase ("second"),
// `{sung}` and `{target}` are notes ("C4"), `{landed}`, `{count}` and
// `{total}` are counts, and `{level}` is the level's name.
//
// Owner, 11 Oct 2026: plain words, one register. Each line says what the
// voice did (on the note, flat, sharp, another note) and what to do about
// it. No decoration, and nothing about the singer: the lines are about the
// sound.

import type { MercLine } from '@/components/room-kit/line-selector'
import { createLineSelector } from '@/components/room-kit/line-selector'

export type EchoMoment =
  | 'intro'
  | 'introAny'
  | 'found'
  | 'early'
  | 'flatNote'
  | 'sharpNote'
  | 'otherNote'
  | 'slid'
  | 'silent'
  | 'phraseAll'
  | 'phraseSome'
  | 'replay'
  | 'resultAll'
  | 'resultLeapsFlat'
  | 'resultStepsSharp'
  | 'resultEnds'
  | 'result'
  | 'newBest'
  | 'again'
  | 'rest'
  | 'left'

export const ECHO_LINES: Readonly<Record<EchoMoment, readonly MercLine[]>> = {
  intro: [
    { id: 'intro-first', text: 'I sing it first. Then you sing it back.' },
    {
      id: 'intro-listen',
      text: 'Listen to my phrase, then sing it back to me.',
    },
  ],
  // No root yet: the singer's own note starts the phrases.
  introAny: [
    {
      id: 'any-easy',
      text: "Sing any easy note first. I'll start my phrases there.",
    },
    {
      id: 'any-start',
      text: "Start on a note that feels easy. I'll build my phrases on it.",
    },
  ],
  found: [
    { id: 'found-first', text: "Got it: {note}. Here's the first phrase." },
    { id: 'found-from', text: "{note} it is. Here's my first phrase." },
  ],
  // Singing while Merc still sings: his voice is all the mic would hear.
  early: [
    { id: 'early-last', text: 'Wait for my last note, then sing.' },
    { id: 'early-finish', text: 'Let me finish, then sing it back.' },
  ],
  flatNote: [
    { id: 'flat-lift', text: 'The {nth} note sat flat. Lift it a little.' },
    { id: 'flat-up', text: 'The {nth} note was a touch flat. Aim higher.' },
  ],
  sharpNote: [
    { id: 'sharp-ease', text: 'The {nth} note went sharp. Ease it down.' },
    {
      id: 'sharp-down',
      text: 'The {nth} note was a touch sharp. Come down a little.',
    },
  ],
  otherNote: [
    { id: 'other-was', text: 'You sang {sung}. That note was {target}.' },
    { id: 'other-landed', text: 'That was {sung}. I sang {target}.' },
  ],
  slid: [
    { id: 'slid-land', text: 'Land on each note before you move on.' },
    { id: 'slid-stay', text: 'Stay on each note a moment, then move.' },
  ],
  silent: [
    {
      id: 'silent-after',
      text: "I didn't hear you. Sing it back after my last note.",
    },
    {
      id: 'silent-turn',
      text: 'Nothing reached me. When my last note ends, it is your turn.',
    },
  ],
  phraseAll: [
    { id: 'all-count', text: 'All {count} notes. Next phrase.' },
    { id: 'all-pitch', text: "All on pitch. Here's the next one." },
  ],
  phraseSome: [
    { id: 'some-next', text: '{landed} of {count}. Next one.' },
    { id: 'some-on', text: '{landed} of {count} on pitch. Next phrase.' },
  ],
  replay: [
    { id: 'replay-once', text: 'Once more. Listen.' },
    { id: 'replay-again', text: 'Here it is again.' },
  ],
  resultAll: [
    { id: 'result-all', text: 'All {total} notes on pitch.' },
    { id: 'result-every', text: 'Every note on pitch: {total} of {total}.' },
  ],
  resultLeapsFlat: [
    {
      id: 'leaps-flat',
      text: 'Your jumps up landed flat. Aim higher on the leaps.',
    },
  ],
  resultStepsSharp: [
    {
      id: 'steps-sharp',
      text: 'Steps down ran sharp. Let them fall a little further.',
    },
  ],
  resultEnds: [
    {
      id: 'ends-slipped',
      text: 'The last notes slipped. Hold the end of each phrase a moment.',
    },
  ],
  result: [
    { id: 'result-on', text: '{landed} of {total} on pitch.' },
    { id: 'result-stars', text: '{landed} of {total} stars lit.' },
  ],
  newBest: [
    { id: 'best-level', text: 'New best at {level}: {landed} of {total}.' },
  ],
  again: [
    { id: 'again-new', text: 'New phrases, same level.' },
    { id: 'again-fresh', text: 'Fresh phrases. Same level.' },
  ],
  rest: [
    {
      id: 'rest-off',
      text: 'No voice for a minute, so the mic is off. Tap it to sing.',
    },
  ],
  left: [
    {
      id: 'left-stopped',
      text: 'That run stopped when you left. Tap the mic to start again.',
    },
  ],
}

/** What a line's placeholders become. */
export interface LineFields {
  readonly note?: string
  readonly nth?: string
  readonly sung?: string
  readonly target?: string
  readonly landed?: number
  readonly count?: number
  readonly total?: number
  readonly level?: string
}

const PLACES = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

/** A note's place in its phrase, for `{nth}`: 0 is "first". */
export function nthNote(index: number): string {
  return PLACES[index] ?? `number ${index + 1}`
}

/** The lines with every placeholder filled in. */
export function fillFields(text: string, fields: LineFields): string {
  return text.replace(/\{(\w+)\}/gu, (whole, key: string) => {
    const value = fields[key as keyof LineFields]
    return value === undefined ? whole : String(value)
  })
}

export interface EchoLines {
  next(moment: EchoMoment, fields?: LineFields): string
}

/** Merc's next line for a moment, never the same one twice running. */
export function createEchoLines(random: () => number = Math.random): EchoLines {
  const selector = createLineSelector(ECHO_LINES, random)
  return {
    next: (moment, fields = {}) =>
      fillFields(selector.next(moment, fields.note ?? '{note}'), fields),
  }
}
