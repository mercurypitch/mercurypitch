// ============================================================
// Voice Mirror — famous-singer match for the share card.
//
// A playful "your range overlaps with a legend" pairing, keyed off the
// classical voice type from voiceTypeHint(). The canonical roster and broad
// classifications live in legend-catalog.ts so matching and the constellation
// cannot drift apart.
// ============================================================

import { VOICE_LEGENDS, VOICE_TYPE_BANDS } from './legend-catalog'
import type { RangeResult } from './metrics'

/**
 * Three or more per type, deliberately. The match is seeded off the
 * detected range, so a two-name roster makes the "twin" a coin flip that
 * two singers in the same type keep landing on — and the twin is the
 * payoff the whole onboarding builds to. Four of these types were pairs
 * until the second round of portraits.
 */
export const SINGERS_BY_VOICE_TYPE: Record<string, readonly string[]> =
  Object.fromEntries(
    VOICE_TYPE_BANDS.map((band) => [
      band.id,
      VOICE_LEGENDS.filter((legend) => legend.band === band.id).map(
        (legend) => legend.name,
      ),
    ]),
  )

/**
 * A legendary singer whose range overlaps this voice type, chosen
 * deterministically from the singer's DETECTED range (lowMidi+highMidi):
 * varied across different voices, but stable for one person — the same singer
 * shows on the card, the on-screen chip, and every re-share. Returns null for
 * an unknown / unmapped voice type.
 */
export function singerForVoiceType(
  voiceHint: string | null,
  lowMidi = 0,
  highMidi = 0,
): string | null {
  if (voiceHint === null) return null
  const options = SINGERS_BY_VOICE_TYPE[voiceHint]
  // The length guard keeps a future empty roster from turning `seed % 0`
  // into options[NaN] === undefined, which would leak past `=== null` checks.
  if (options === undefined || options.length === 0) return null
  const seed = Math.abs(Math.round(lowMidi) * 3 + Math.round(highMidi))
  return options[seed % options.length]
}

/** The legend for a detected range — the one derivation shared by the chip,
 *  the reveal, the portrait preload and the story-card export, so they can
 *  never disagree about who the twin is. */
export function singerForRange(
  range: Pick<RangeResult, 'voiceHint' | 'lowMidi' | 'highMidi'> | null,
): string | null {
  if (range === null) return null
  return singerForVoiceType(range.voiceHint, range.lowMidi, range.highMidi)
}
