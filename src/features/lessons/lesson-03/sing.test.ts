// ============================================================
// Lesson 3 Sing it tests — the notes, the live tag and the chart's words
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { TakeReading } from '@/features/lessons/kit/take'
import { notesFor } from './sing'
import { chartSummary, octaveTag } from './sing-take'

const reading = (over: Partial<TakeReading>): TakeReading => ({
  steady: true,
  d: 12,
  octaves: 0,
  band: 'middle',
  landed: true,
  line: '',
  octaveLine: null,
  ...over,
})

describe('notesFor (FACTS 45)', () => {
  it('sings A, then G a tone below, then B a tone above, around the voice', () => {
    expect(notesFor('lower')).toEqual([57, 55, 59])
    expect(notesFor('higher')).toEqual([69, 67, 71])
  })
})

describe("the live line's octave tag", () => {
  it("names an octave away only within 50 cents of Merc's note", () => {
    expect(octaveTag(-1, 10)).toBe('octave lower')
    expect(octaveTag(1, -50)).toBe('octave higher')
    expect(octaveTag(-2, 0)).toBe('two octaves lower')
    expect(octaveTag(-1, 51)).toBeNull()
    expect(octaveTag(0, 0)).toBeNull()
  })
})

describe("the chart's words after a take (REQ-GVC-085)", () => {
  it("say Merc's note, the gap and the band, as WEB-SPEC's example reads", () => {
    expect(chartSummary(57, reading({ d: 20, band: 'band' }))).toBe(
      "Merc's note A3; your note 20 cents above it, in the band",
    )
    expect(chartSummary(57, reading({ d: 12, band: 'middle' }))).toBe(
      "Merc's note A3; your note 12 cents above it, right in the middle",
    )
    expect(chartSummary(57, reading({ d: -25, band: 'band' }))).toBe(
      "Merc's note A3; your note 25 cents below it, in the band",
    )
  })

  it('add the octave where the take said so, and say when nothing steady was heard', () => {
    expect(
      chartSummary(
        69,
        reading({
          d: 0,
          octaves: -1,
          octaveLine: 'You sang it an octave lower: same note.',
        }),
      ),
    ).toBe(
      "Merc's note A4; your note on it, right in the middle, an octave lower",
    )
    expect(
      chartSummary(58, reading({ steady: false, d: null, band: null })),
    ).toBe("Merc's note A sharp 3; no steady note heard")
  })
})
