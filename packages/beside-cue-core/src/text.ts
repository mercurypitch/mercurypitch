// ============================================================
// Cue text normalization — preserve wording while making storage predictable
// ============================================================

export type CueTextValidationReason = 'empty' | 'too_long'

export class CueTextValidationError extends RangeError {
  constructor(
    readonly reason: CueTextValidationReason,
    readonly normalizedText: string,
    readonly graphemeCount: number,
  ) {
    super(
      reason === 'empty'
        ? 'Cue text must contain at least one grapheme.'
        : 'Cue text must contain at most 120 graphemes.',
    )
    this.name = 'CueTextValidationError'
  }
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})
const NON_SEMANTIC_CODE_POINTS =
  /[\p{White_Space}\p{Cc}\p{Default_Ignorable_Code_Point}]/gu

export function countGraphemes(value: string): number {
  return Array.from(GRAPHEME_SEGMENTER.segment(value)).length
}

/** NFC-normalize, trim, collapse whitespace, then enforce 1–120 graphemes. */
export function normalizeCueText(value: string): string {
  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim()
  const graphemeCount = countGraphemes(normalized)
  const semanticText = normalized.replace(NON_SEMANTIC_CODE_POINTS, '')

  if (graphemeCount === 0 || semanticText.length === 0) {
    throw new CueTextValidationError('empty', normalized, graphemeCount)
  }
  if (graphemeCount > 120) {
    throw new CueTextValidationError('too_long', normalized, graphemeCount)
  }

  return normalized
}
