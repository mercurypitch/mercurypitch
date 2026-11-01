// ============================================================
// What the onboarding says: its name, and Merc's line
// ============================================================
//
// Read off the layer's state on every beat (NativeOnboarding.tsx): the
// dialog's name for a screen reader, and Merc's line for his bubble and the
// live region. Each beat's own line is read only on that beat.

import { ONBOARDING_COPY } from './onboarding-copy'

export type OnboardingBeat =
  | 'first-note'
  | 'range'
  | 'reveal'
  | 'keep'
  | 'line'
  | 'offer'

/** The layer's state that what it says depends on. */
export interface LayerWords {
  readonly beat: OnboardingBeat
  /** Not now's asks are out. */
  readonly deciding: boolean
  /** The range was skipped. */
  readonly skipped: boolean
  /** Keep has shown since. */
  readonly keepShown: boolean
  /** The sung line is done. */
  readonly lineDone: boolean
  /** A range has been revealed. */
  readonly revealed: boolean
  /** Under Not now's offer, the beat it was said on. */
  readonly leftFrom: OnboardingBeat | null
  readonly lineSays: () => string | null
  readonly rangeSays: () => string | null
  readonly noteSays: () => string | null
}

/** Merc's line on the beat on screen, for its bubble and the live region.
 *  None under Keep or the Cloud offer: the sheet says it. */
export function layerSays(words: LayerWords): string | null {
  // Not now's asks are out: the beats behind it went back to their start,
  // and their asks must not be read out again over the way out.
  if (words.deciding) return null
  switch (words.beat) {
    case 'keep':
    case 'offer':
      return null
    case 'line':
      return words.lineSays()
    default:
      break
  }
  if (words.skipped) {
    return words.keepShown
      ? ONBOARDING_COPY.skippedToKeep
      : ONBOARDING_COPY.skipped
  }
  switch (words.beat) {
    case 'range':
      return words.rangeSays()
    case 'reveal':
      return ONBOARDING_COPY.voiceprint
    default:
      return words.noteSays()
  }
}

/** The layer's name: under Not now's offer, the beat it was said on. */
export function layerTitle(words: LayerWords): string {
  const named = words.beat === 'offer' ? (words.leftFrom ?? 'line') : words.beat
  switch (named) {
    case 'range':
      return ONBOARDING_COPY.rangeTitle
    case 'reveal':
      return ONBOARDING_COPY.revealTitle
    case 'keep':
      if (words.lineDone) return ONBOARDING_COPY.lineTitle
      return words.revealed
        ? ONBOARDING_COPY.revealTitle
        : ONBOARDING_COPY.title
    case 'line':
    case 'offer':
      return ONBOARDING_COPY.lineTitle
    default:
      return ONBOARDING_COPY.title
  }
}
