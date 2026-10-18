// ============================================================
// The onboarding's words, in one place
// ============================================================
//
// Every line the native onboarding shows or reads out, so a change of
// wording is one file (the owner's rule for Merc's lines, 9 Oct 2026). From
// the S7b copy deck (§6.1): Merc's lines are plain and specific, one
// sentence at a time, and never say "wrong", "failed" or "bad". The
// microphone's promise is the house one, "Only you can hear you."
//
// The deck's lines are kept as written: the first note, the range's two
// slides and its result, the reveal's card and Merc's line on it. The rest
// are this build's own, in the same voice: the slides' nudges and the two
// ways a range can come up short, See my voice (concept 03's button), and
// what Share says when there is no share sheet.

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
  /** The named note's two ways on (S7b §6.1, beat 3). */
  findRange: 'Find my range',
  skip: 'Skip for now',
  /** Merc, as a skipped range lets the singer go on. */
  skipped: "It's here when you want it.",

  // ── The range (S7b beat 4) ──
  /** The layer's accessible name on the range. */
  rangeTitle: 'Your range',
  /** The first slide, and the ask before a tap starts it. */
  slideDown: 'Slide down, as low as feels easy.',
  /** The second slide. */
  slideUp: 'Now up, as high as feels easy.',
  /** Nine seconds and no voice, on each slide. */
  slideDownNudge: 'Any note to start, then slide down.',
  slideUpNudge: 'Start low, then slide up.',
  /** No range in what was heard: the mic is shut, a tap tries again. */
  unheard: "I couldn't follow that slide. Tap the mic and slide on an 'ooo'.",
  /** A range under MIN_RANGE_SEMITONES: one note, more or less. */
  narrow: 'That stayed close to one note. Tap the mic and slide further.',
  /** From the range to the reveal. */
  seeVoice: 'See my voice',

  // ── The reveal (S7b beat 5) ──
  revealTitle: 'Your voice',
  yourRange: 'Your range',
  twinLabel: 'Your voice twin',
  findTwin: 'Find my twin',
  voiceprint: "That's your voiceprint. It changes as you practice.",
  continue: 'Continue',
  share: 'Share',
  /** The share sheet's title. */
  shareTitle: 'My voiceprint',
  /** Where there is no share sheet, the link is copied instead. */
  linkCopied: 'Link copied.',
  /** Neither the sheet nor the clipboard would take it. */
  shareFailed: "Couldn't open the share sheet.",
} as const

/** "That's an A3." The note named back, with its article. */
export function heardLine(note: string): string {
  return `That's ${noteArticle(note)} ${note}.`
}

/** "E2 to G4": a range, as the reveal's card and Merc say it. */
export function rangeWords(low: string, high: string): string {
  return `${low} to ${high}`
}

/** "E2 to G4. That's your range today." Ranges move, hence "today". */
export function rangeLine(low: string, high: string): string {
  return `${rangeWords(low, high)}. That's your range today.`
}

/** The share sheet's line: the twin when there is one, else the range. */
export function shareLine(twin: string | null, range: string): string {
  return twin === null ? `My range is ${range}.` : `${twin} is my voice twin.`
}
