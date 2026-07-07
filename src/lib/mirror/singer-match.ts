// ============================================================
// Voice Mirror — famous-singer match for the share card.
//
// A fun "your range overlaps with a legend" pairing, keyed off the classical
// voice type from voiceTypeHint(). Legends only — one iconic, instantly-known
// name per voice type, spanning low to high.
// ============================================================

/** One mega-star per voice type. Keep names iconic and unmistakable. */
const SINGER_BY_VOICE_TYPE: Record<string, string> = {
  Bass: 'Johnny Cash',
  Baritone: 'Freddie Mercury',
  Tenor: 'Bruce Dickinson',
  Alto: 'Adele',
  'Mezzo-soprano': 'Whitney Houston',
  Soprano: 'Mariah Carey',
}

/**
 * The legendary singer whose range overlaps this voice type, or null when the
 * voice type is unknown / unmapped. It's a playful range match, not a claim
 * about timbre — the card frames it as "overlaps with", never "you sound like".
 */
export function singerForVoiceType(voiceHint: string | null): string | null {
  if (voiceHint === null) return null
  return SINGER_BY_VOICE_TYPE[voiceHint] ?? null
}
