// ============================================================
// The twin screen's line: a famous singer of a type, not your type
// ============================================================

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { VOICE_TYPE_BANDS } from '@/lib/mirror/legend-catalog'
import { twinPeekLine } from './twin-peek-line'

describe('twinPeekLine', () => {
  it('names the singer, the type the range overlaps most, and what that is worth', () => {
    expect(twinPeekLine('Freddie Mercury', 'Tenor')).toBe(
      'Freddie Mercury: a famous tenor, the voice type your range overlaps most. A broad guide, not a verdict.',
    )
  })

  it('gives the visitor no type of their own, for any of the six', () => {
    const lines = VOICE_TYPE_BANDS.map((band) =>
      twinPeekLine('A Singer', band.id),
    )

    expect(lines.map((line) => line.split(',')[0])).toEqual([
      'A Singer: a famous bass',
      'A Singer: a famous baritone',
      'A Singer: a famous tenor',
      'A Singer: a famous alto',
      'A Singer: a famous mezzo-soprano',
      'A Singer: a famous soprano',
    ])
    expect(
      lines.filter((line) =>
        /shares your voice type|yours now|you are an?\b/iu.test(line),
      ),
    ).toEqual([])
    expect(
      lines.flatMap(
        (text) =>
          validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
      ),
    ).toEqual([])
  })

  it('still says what the singer is worth when the range named no type', () => {
    expect(twinPeekLine('A Singer', null)).toBe(
      'A Singer: a famous singer of the voice type your range overlaps most. A broad guide, not a verdict.',
    )
  })
})
