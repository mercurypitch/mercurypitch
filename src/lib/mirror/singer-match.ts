// ============================================================
// Voice Mirror — famous-singer match for the share card.
//
// A playful "your range overlaps with a legend" pairing, keyed off the
// classical voice type from voiceTypeHint(). Two or more legends per type;
// singers are placed by their documented SINGING classification, not their
// speaking voice — e.g. Freddie Mercury spoke as a baritone but SANG as a
// tenor, so he sits under Tenor (see the classical ranges in metrics.ts
// VOICE_TYPES). Every legend here needs a portrait entry in
// LegendCaricature.tsx.
// ============================================================

const SINGERS_BY_VOICE_TYPE: Record<string, readonly string[]> = {
  Bass: ['Johnny Cash', 'Barry White'],
  // Baritone is the most common male voice, so it carries the most variety.
  Baritone: ['Elvis Presley', 'Frank Sinatra', 'Kurt Cobain', 'David Bowie'],
  Tenor: ['Freddie Mercury', 'Bruce Dickinson'],
  Alto: ['Amy Winehouse', 'Cher'], // contralto — the lowest female voices
  'Mezzo-soprano': ['Adele', 'Whitney Houston'],
  Soprano: ['Mariah Carey', 'Celine Dion'],
}

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
  if (options === undefined) return null
  const seed = Math.abs(Math.round(lowMidi) * 3 + Math.round(highMidi))
  return options[seed % options.length]
}
