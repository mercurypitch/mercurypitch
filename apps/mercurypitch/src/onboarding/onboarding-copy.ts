// ============================================================
// The onboarding's words, in one place
// ============================================================
//
// Every line the native onboarding shows or reads out, so a change of
// wording is one file (the owner's rule for Merc's lines, 9 Oct 2026). From
// the S7b copy deck (§6.1): Merc's lines are plain and specific, one
// sentence at a time, and never say "wrong", "failed" or "bad". The
// microphone's promise is the house one, "Only you can hear you."

import { noteArticle } from '@/lib/note-utils'

export const ONBOARDING_COPY = {
  /** The layer's accessible name. */
  title: 'Your first note',
  /** The one exit, top right, on every beat (S7b E1). */
  notNow: 'Not now',

  // ── The first note (S7b beats 2 and 3) ──
  /** Merc's first line, as he lands. */
  hello: "Hi, I'm Merc.",
  /** His ask, a beat later, and while he waits for a voice. */
  ask: 'Sing me one note, any note.',
  /** The silent demonstration line's label (REQ-NFL-021). */
  example: 'Example',
  /** Under the mic, and its name: what a tap does. */
  sing: 'Sing a note',
  /** Today's priming copy (the Sing room's), ending in the house promise. */
  listens:
    'Mercury Pitch listens while you sing and draws your pitch on screen.',
  private: 'Only you can hear you.',
  /** The mic's name while it opens. */
  opening: 'Opening the microphone',
  /** The mic's name while it listens. */
  listening: 'Listening. Tap to stop',
  /** A voice is in, and the take runs. */
  hold: 'Hold it there.',
  /** Nine seconds and no voice yet. */
  nudge: 'Any note at all. Hold it for a few seconds.',
  /** A take with no settled note, listening again by itself. */
  wandered: "That one wandered. Hold one steady 'ahh'.",
  /** Two of those: the mic is shut, and a tap tries again. */
  missed: "I didn't catch that. Tap the mic and hold one 'ahh'.",
  /** The landing for now: the Sing room, live. */
  startSinging: 'Start singing',
} as const

/** "That's an A3." The note named back, with its article. */
export function heardLine(note: string): string {
  return `That's ${noteArticle(note)} ${note}.`
}
