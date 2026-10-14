// ============================================================
// Merc's lines for Ng slides: one table, easy to swap
// ============================================================
//
// The room kit's selector (line-selector.ts) picks the next line for a
// moment and never says the same one twice running. `{note}` is a note
// ("A2"), `{top}` a slide's top note ("E3"), `{pct}` a share ("84%").
//
// DESIGN-ng-slides.md 5 drafts them; the owner's rule for every room's
// lines holds (11 Oct 2026): plain words, one register, each line says
// what the voice did and what to do about it. Merc speaks between slides
// only, never while the singer slides.

import type { MercLine } from '@/components/room-kit/line-selector'
import { createLineSelector } from '@/components/room-kit/line-selector'

export type NgMoment =
  | 'intro'
  | 'introAny'
  | 'found'
  | 'listen'
  | 'onPath'
  | 'behind'
  | 'ahead'
  | 'topFlat'
  | 'topSharp'
  | 'jump'
  | 'break'
  | 'breath'
  | 'silent'
  | 'archClean'
  | 'resultClean'
  | 'resultFlip'
  | 'resultTopsFlat'
  | 'resultLate'
  | 'result'
  | 'newBest'
  | 'again'
  | 'rest'
  | 'left'

export const NG_LINES: Readonly<Record<NgMoment, readonly MercLine[]>> = {
  intro: [
    {
      id: 'intro-sing',
      text: 'Hum ng, like the end of sing. Slide up to {top} and back.',
    },
    { id: 'intro-follow', text: 'Hum ng and follow the arch up to {top}.' },
  ],
  // No voiceprint and no note kept: the singer's own note fits the slides.
  introAny: [
    {
      id: 'any-build',
      text: "Hum any easy note first. I'll build the slides from there.",
    },
  ],
  found: [
    { id: 'found-start', text: 'Got it. The first slide starts on {note}.' },
  ],
  // The count-in: the root's tone, then the first arch rolls in.
  listen: [
    {
      id: 'listen-reach',
      text: "Here's {note}. Hum it as the arch reaches me.",
    },
    {
      id: 'listen-start',
      text: "That's {note}. Start humming when the arch reaches me.",
    },
  ],
  onPath: [{ id: 'on-keep', text: 'On the line. Keep sliding.' }],
  behind: [{ id: 'behind', text: 'A little behind. Start the slide sooner.' }],
  ahead: [{ id: 'ahead', text: 'Ahead of the line. Slow the slide down.' }],
  topFlat: [{ id: 'top-flat', text: 'Short of {top}. Reach a little higher.' }],
  topSharp: [{ id: 'top-sharp', text: 'Past {top}. Turn around sooner.' }],
  jump: [
    { id: 'jump', text: 'That jumped near {note}. Slide through it slowly.' },
  ],
  break: [
    {
      id: 'break',
      text: 'The hum stopped. Keep it going to the end of the slide.',
    },
  ],
  breath: [{ id: 'breath', text: 'Breathe. The next slide starts on {note}.' }],
  silent: [
    {
      id: 'silent',
      text: 'I heard no hum on that one. The next starts on {note}.',
    },
  ],
  archClean: [
    { id: 'clean-smooth', text: 'Smooth slide.' },
    { id: 'clean-jumps', text: 'No jumps on that one.' },
  ],
  resultClean: [{ id: 'result-clean', text: 'Five slides, no jumps.' }],
  resultFlip: [
    {
      id: 'result-flip',
      text: 'It jumps near {note} every time. Slow down through that spot.',
    },
  ],
  resultTopsFlat: [
    {
      id: 'result-tops',
      text: 'The tops sat flat. Reach the top note fully.',
    },
  ],
  resultLate: [
    {
      id: 'result-late',
      text: 'You trailed the line. Start each slide a little sooner.',
    },
  ],
  result: [{ id: 'result', text: 'On the line {pct} of the time.' }],
  newBest: [
    { id: 'new-best', text: 'New best: on the line {pct} of the time.' },
  ],
  again: [{ id: 'again', text: 'Same slides, fresh breath.' }],
  rest: [
    {
      id: 'rest-off',
      text: 'No hum for a minute, so the mic is off. Tap it to start again.',
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
export interface NgFields {
  readonly note?: string
  readonly top?: string
  readonly pct?: string
}

export interface NgLines {
  next: (moment: NgMoment, fields?: NgFields) => string
}

export function createNgLines(random: () => number = Math.random): NgLines {
  const selector = createLineSelector(NG_LINES, random)
  return {
    next: (moment, fields = {}) =>
      selector
        .next(moment, fields.note ?? '{note}')
        .replaceAll('{top}', fields.top ?? '{top}')
        .replaceAll('{pct}', fields.pct ?? '{pct}'),
  }
}
