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
// slides and its result, the reveal's card and Merc's line on it, the sung
// line's ask, its chip and Merc's four lines by band. The rest are this
// build's own, in the same voice: the slides' nudges and the two ways a
// range can come up short, See my voice (concept 03's button), Find my
// range again for a range this phone already keeps, what Share says when
// there is no share sheet, the sung line's turn, its no-voice line, and
// the words Merc's band lines take where the data says something other
// than the deck's example (lineVerdict). Keep, beat 7, says its own words
// (account-copy.ts); the Cloud offer, beat 9, its own (CloudOffer.tsx).

import { noteArticle } from '@/lib/note-utils'
import type { LineFacts } from './line-score'

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
  // Merc is the one who listens, as he is the one who asked.
  listens: 'Merc listens while you sing and draws your pitch on screen.',
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
  /** With a range already kept on this phone, under See my voice. */
  findRangeAgain: 'Find my range again',
  /** Merc, as a skipped range lets the singer go on. */
  skipped: "It's here when you want it.",
  /** Under a refused mic's Try again: the one way on (REQ-NFL-043), in the
   *  web's words (BeatFirstLight.tsx). */
  withoutMic: 'Continue without the mic',

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
  /** The layer's name on the reveal, and the card's headline for a range
   *  no voice type overlaps. */
  revealTitle: 'Your voice',
  twinLabel: 'Your voice twin',
  voiceprint: "That's your voiceprint. It changes as you practice.",
  continue: 'Continue',
  share: 'Share',
  /** The share sheet's title. */
  shareTitle: 'My voiceprint',
  /** Where there is no share sheet, the link is copied instead. */
  linkCopied: 'Link copied.',
  /** Neither the sheet nor the clipboard would take it. */
  shareFailed: "Couldn't open the share sheet.",

  // ── The sung line (S7b beat 8) ──
  /** The layer's accessible name on the line. */
  lineTitle: 'Sing one line',
  /** Merc's ask (S7b §6.1), through his call. */
  lineAsk: 'Sing this line with me.',
  /** Under the mic before the first tap: what the tap starts. */
  lineHow: "Merc sings it first, then it's your turn.",
  /** The mic's name: what a tap does. */
  singLine: 'Sing the line',
  /** His call is over: the singer's turn, counted in. */
  yourTurn: 'Your turn.',
  /** No voice at all in the turn: the mic is shut, a tap tries again. */
  lineUnheard: "I couldn't hear that one. Tap the mic and sing it back.",
  /** Sing it again, from Merc's call. */
  again: 'Once more',
} as const

/** "8 of 10 notes on pitch": the sung line's chip (S7b §6.1). */
export function lineScoreText(hit: number, total: number): string {
  return `${hit} of ${total} notes on pitch`
}

const COUNTS = [
  'none',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]

/**
 * Merc's word on a sung line, by S7b's bands (§3.6): all ten, 7 to 9, 4 to
 * 6, 0 to 3. The deck's lines are its examples, kept where the data says
 * the same; where it says otherwise, the same line with the data's word:
 * sharp for flat, no "hair" past a semitone, and no pitch at all for notes
 * nobody sang or for a mix.
 */
export function lineVerdict(facts: LineFacts): string {
  const { hit, total, trend, slight } = facts
  if (trend === null || hit >= total) {
    return `All ${COUNTS[total] ?? String(total)}. Clean.`
  }
  const share = hit / total
  if (share >= 0.7) {
    switch (trend) {
      case 'flat':
        return slight
          ? 'Nearly all. The rest sat a hair flat.'
          : 'Nearly all. The rest sat flat. Sing them higher.'
      case 'sharp':
        return slight
          ? 'Nearly all. The rest sat a hair sharp.'
          : 'Nearly all. The rest sat sharp. Sing them lower.'
      case 'unsung':
        return 'Nearly all. The rest went by unsung.'
      case 'mixed':
        return 'Nearly all. Listen once more for the rest.'
    }
  }
  if (share >= 0.4) {
    if (facts.highFlat) {
      return 'Good start. The high notes want a little more lift.'
    }
    switch (trend) {
      case 'flat':
        return `Good start. Some notes sat flat. Sing them ${slight ? 'a little ' : ''}higher.`
      case 'sharp':
        return `Good start. Some notes sat sharp. Sing them ${slight ? 'a little ' : ''}lower.`
      case 'unsung':
        return 'Good start. Some notes went by unsung. Sing every one.'
      case 'mixed':
        return 'Good start. Listen once more, then match Merc note for note.'
    }
  }
  return 'Your voice is still warming up. Once more?'
}

/** "That's an A3." The note named back, with its article. */
export function heardLine(note: string): string {
  return `That's ${noteArticle(note)} ${note}.`
}

/** "E2 to G4": a range, as Merc says it. */
export function rangeWords(low: string, high: string): string {
  return `${low} to ${high}`
}

/**
 * "E2–G4": a range, as a card writes it: the reveal's, then Keep's that it
 * flies into, and Progress's (keepRange in keep-voiceprint.ts).
 */
export function rangeSpan(low: string, high: string): string {
  return `${low}\u2013${high}`
}

/** "E2 to G4. That's your range today." Ranges move, hence "today". */
export function rangeLine(low: string, high: string): string {
  return `${rangeWords(low, high)}. That's your range today.`
}

/**
 * The reveal's headline: the voice type the range overlaps most, as plain
 * words ("You're a baritone", "You're an alto"), or "Your voice" when it
 * overlaps none.
 */
export function voiceHeadline(type: string | null): string {
  if (type === null) return ONBOARDING_COPY.revealTitle
  const article = /^[aeiou]/iu.test(type) ? 'an' : 'a'
  return `You're ${article} ${type.toLowerCase()}`
}

/**
 * How wide a range is, in octaves a non-singer can picture: "about two
 * octaves", rounded to the nearest half, a tie going down so a range is
 * never said wider than it is; under twelve semitones, "under an octave".
 */
export function spanWords(semitones: number): string {
  if (semitones < 12) return 'under an octave'
  const halves = Math.ceil(semitones / 6 - 0.5)
  const whole = Math.floor(halves / 2)
  const half = halves % 2 === 1
  if (whole === 1)
    return half ? 'about an octave and a half' : 'about an octave'
  const count = COUNTS[whole] ?? String(whole)
  return half ? `about ${count} and a half octaves` : `about ${count} octaves`
}

/** "F2 to G4 · about two octaves": the reveal's range, in words. */
export function rangeSubline(range: {
  readonly lowNote: string
  readonly highNote: string
  readonly lowMidi: number
  readonly highMidi: number
}): string {
  const words = rangeWords(range.lowNote, range.highNote)
  return `${words} \u00b7 ${spanWords(range.highMidi - range.lowMidi)}`
}

/** "You share a range with David Bowie.": the twin's card, its last line. */
export function twinLine(twin: string): string {
  return `You share a range with ${twin}.`
}

/** The share sheet's line: the twin when there is one, else the range. */
export function shareLine(twin: string | null, range: string): string {
  return twin === null ? `My range is ${range}.` : `${twin} is my voice twin.`
}
