// ============================================================
// Merc's lines for Lip roll: one table, easy to swap
// ============================================================
//
// The room kit's room-lines.ts picks the next line for a moment, never the
// same one twice running, and fills its fields (GlideLineFields): `{note}`
// is a note ("G3"), `{top}` a wave's top note ("G3"),
// `{pct}` a share ("88%").
//
// DESIGN-lip-roll.md 5 drafts them; the owner's rule for every room's
// lines holds (11 Oct 2026): plain words, one register, each line says
// what the voice did and what to do about it. The app follows the pitch,
// not the lips, so no line claims to hear the buzz. Merc speaks between
// waves only, never while the singer rides one.

import type { GlideLines } from '@/components/room-kit/glide/glide-room-contract'
import type { LineTable } from '@/components/room-kit/room-lines'
import { createRoomLines } from '@/components/room-kit/room-lines'

export type LipMoment =
  | 'intro'
  | 'introAny'
  | 'found'
  | 'listen'
  | 'onPath'
  | 'waveClean'
  | 'behind'
  | 'ahead'
  | 'shortTop'
  | 'pastTop'
  | 'jump'
  | 'break'
  | 'breath'
  | 'tip'
  | 'resultClean'
  | 'resultFlip'
  | 'resultBreaks'
  | 'tipOo'
  | 'resultShort'
  | 'result'
  | 'newBest'
  | 'again'
  | 'rest'
  | 'left'

export const LIP_LINES: LineTable<LipMoment> = {
  intro: [
    {
      id: 'intro-roll',
      text: 'Roll your lips, brrr, and ride the wave up to {top} and back.',
    },
    {
      id: 'intro-follow',
      text: 'Buzz your lips, then follow the wave up to {top} and down.',
    },
  ],
  // No voiceprint and no note kept: the singer's own note sets the waves.
  introAny: [
    {
      id: 'any-set',
      text: "Sing any easy note first. I'll set the waves from there.",
    },
  ],
  found: [
    { id: 'found-start', text: 'Got it. The first wave starts on {note}.' },
  ],
  // The count-in: the root's tone, then the first wave rolls in.
  listen: [
    {
      id: 'listen-reach',
      text: "Here's {note}. Start the buzz as the wave reaches me.",
    },
    {
      id: 'listen-ride',
      text: "That's {note}. Buzz it, then ride up with the wave.",
    },
  ],
  onPath: [{ id: 'on-air', text: 'On the wave. Keep the air going.' }],
  waveClean: [
    { id: 'clean-lit', text: 'The whole wave lit.' },
    { id: 'clean-breaks', text: 'Up and back with no breaks.' },
  ],
  behind: [{ id: 'behind', text: 'Behind the wave. Go up sooner.' }],
  ahead: [{ id: 'ahead', text: 'Ahead of the wave. Slow down.' }],
  shortTop: [{ id: 'short-top', text: 'Short of {top}. Ride all the way up.' }],
  pastTop: [{ id: 'past-top', text: 'Past {top}. Turn around sooner.' }],
  jump: [{ id: 'jump', text: 'A jump near {note}. Go through it slowly.' }],
  break: [
    {
      id: 'break',
      text: 'The sound stopped near {note}. Keep the air going through it.',
    },
  ],
  breath: [{ id: 'breath', text: 'Breathe. The next wave starts on {note}.' }],
  // A wave with no voice on it.
  tip: [
    {
      id: 'tip-cheeks',
      text: "I heard nothing on that one. Lips loose, and if they won't buzz, press a finger lightly on each cheek.",
    },
  ],
  resultClean: [{ id: 'result-clean', text: 'Three waves, no breaks.' }],
  resultFlip: [
    {
      id: 'result-flip',
      text: 'It jumps near {note} every time. Slow down through that spot.',
    },
  ],
  resultBreaks: [
    {
      id: 'result-breaks',
      text: 'The sound stops near {note}. Take a bigger breath and keep the air going.',
    },
  ],
  // A take whose voice kept stopping: three breaks or more.
  tipOo: [
    {
      id: 'tip-oo',
      text: "If your lips won't buzz, an oo works too. I follow the pitch.",
    },
  ],
  resultShort: [
    {
      id: 'result-short',
      text: 'The tops fell short. Ride each wave all the way up.',
    },
  ],
  result: [{ id: 'result', text: 'On the wave {pct} of the time.' }],
  newBest: [
    { id: 'new-best', text: 'New best: on the wave {pct} of the time.' },
  ],
  again: [{ id: 'again', text: 'Same waves, fresh breath.' }],
  rest: [
    {
      id: 'rest-off',
      text: 'No sound for a minute, so the mic is off. Tap it to start again.',
    },
  ],
  left: [
    {
      id: 'left-stopped',
      text: 'That run stopped when you left. Tap the mic to start again.',
    },
  ],
}

export type LipLines = GlideLines<LipMoment>

export function createLipLines(random: () => number = Math.random): LipLines {
  return createRoomLines(LIP_LINES, random)
}
