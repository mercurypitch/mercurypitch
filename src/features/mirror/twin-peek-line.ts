// ============================================================
// Voice Mirror — the twin screen's line
// ============================================================
//
// The twin follows from the range alone: singerForRange reads only the low
// and high notes the glides held. A range does not decide a voice type
// (tessitura, tone and training matter too, as the range results say),
// so the line names the singer as a famous singer of the type the range
// overlaps most, and says what that is worth before the results do. It used
// to say the singer "shares your voice type. That is yours now", which gave
// the visitor a type from range alone (Find Your Pitch, Lesson 7 FACTS 69).

/** "Freddie Mercury: a famous tenor, the voice type your range overlaps
 *  most. A broad guide, not a verdict." */
export function twinPeekLine(legend: string, voiceType: string | null): string {
  const singer =
    voiceType === null
      ? 'a famous singer of the voice type your range overlaps most'
      : `a famous ${voiceType.toLowerCase()}, the voice type your range overlaps most`
  return `${legend}: ${singer}. A broad guide, not a verdict.`
}
