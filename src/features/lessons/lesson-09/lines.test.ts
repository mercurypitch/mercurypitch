// ============================================================
// Lesson 9 lines tests — what the chart's sounds say, against the house rules
// ============================================================
//
// WEB-SPEC, Tests 4 and part of 8: the cold open's live lines name each
// path's two moves (FACTS 12); Step 1's ratios read 1.12 and 1.50 (FACTS
// 30); Step 3's and Step 4's leaps are named and sized (FACTS 20, 93); Step
// 5's readout begins as the leap lands, and at the landing and the settle
// reads "outside the band; nearest note G sharp 3" and "in the band;
// nearest note A3" (FACTS 94), and the scrub bar says where the line is;
// free play names each leap, up or down.
// Every line, in either voice, passes the guided-voice claims check as a
// finding and holds no sharp or flat sign.

import { describe, expect, it } from 'vitest'
import { inBand } from '@/features/lessons/kit/band-words'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { RungId } from './ladder-data'
import { doOf, RUNG_ORDER } from './ladder-data'
import type { FoldsMove } from './lines'
import { foldsLine, foldsRatio, freeLine, HEAR_LINE, landingReadout, mercLeapLine, moveLine, orderLine, overLine, pathLine, SCRUB_SEC, scrubText, } from './lines'
import { FIVE_LEAPS, LANDING_SEC, landingAt, OVER_LEAPS, PATH_IDS, } from './sounds'

const VOICES: readonly Voice[] = ['lower', 'higher']
const MOVES: readonly FoldsMove[] = ['step', 'leap']
/** Every tenth of a second of the landing, as the scrub bar's arrow keys step it. */
const TENTHS = Array.from({ length: 31 }, (_, i) => i / 10)

/** Every line the chart's sounds say, in either voice. */
function allLines(): string[] {
  const lines: string[] = [HEAR_LINE]
  for (const v of VOICES) {
    const d = doOf(v)
    lines.push(mercLeapLine(d), ...PATH_IDS.map((p) => pathLine(d, p)))
    for (const m of MOVES) lines.push(moveLine(d, m), foldsLine(d, m))
    for (const t of TENTHS) {
      const readout = landingReadout(d, t)
      if (readout !== null) lines.push(readout)
    }
    lines.push(freeLine(d, null, 'do'))
    for (const from of RUNG_ORDER)
      for (const to of RUNG_ORDER) lines.push(freeLine(d, from, to))
  }
  lines.push(
    ...OVER_LEAPS.map(overLine),
    ...FIVE_LEAPS.map((_, k) => orderLine(k)),
  )
  lines.push(...TENTHS.map(scrubText))
  return lines
}

describe('the cold open', () => {
  it("says Merc's leap and each path in words: notes, moves and their names", () => {
    // Act
    const d = doOf('lower')

    // Assert
    expect(mercLeapLine(d)).toBe(
      "Merc's leap: do, D3, up to so, A3, a perfect fifth",
    )
    expect(PATH_IDS.map((p) => pathLine(d, p))).toEqual([
      'Do, D3, up to re, E3, a tone; then up to so, A3, a perfect fourth',
      'Do, D3, up to mi, F sharp 3, a major third; then up to so, A3, a minor third',
      'Do, D3, up to fa, G3, a perfect fourth; then up to so, A3, a tone',
    ])
  })

  it('says the higher voice an octave up', () => {
    // Act
    const d = doOf('higher')

    // Assert
    expect(mercLeapLine(d)).toBe(
      "Merc's leap: do, D4, up to so, A4, a perfect fifth",
    )
    expect(pathLine(d, 'mi')).toBe(
      'Do, D4, up to mi, F sharp 4, a major third; then up to so, A4, a minor third',
    )
  })
})

describe('Step 1', () => {
  it('reads the folds’ change as 1.12 for the step and 1.50 for the leap, in either voice', () => {
    for (const v of VOICES) {
      // Act
      const ratios = MOVES.map((m) => foldsRatio(doOf(v), m))

      // Assert: FACTS 30, 2^(2/12) and 2^(7/12)
      expect(ratios, v).toEqual(['1.12', '1.50'])
    }
  })

  it('names the move, then the folds, as the spec words both', () => {
    // Act
    const lower = MOVES.map((m) => foldsLine(doOf('lower'), m))

    // Assert
    expect(lower).toEqual([
      'The step: D3 to E3, a tone. The folds go about an eighth faster: 1.12 times.',
      'The leap: D3 to A3, a perfect fifth. The folds go one and a half times as fast: 1.50 times.',
    ])
    expect(moveLine(doOf('higher'), 'step')).toBe('The step: D4 to E4, a tone.')
  })
})

describe('Steps 2 to 4', () => {
  it('names each leap over the climb by the rungs it skips', () => {
    // Act
    const lines = OVER_LEAPS.map(overLine)

    // Assert
    expect(HEAR_LINE).toBe('So: hear where the leap lands.')
    expect(lines).toEqual([
      'Do to so: a perfect fifth, 7 semitones, over mi.',
      'Do to the top do: an octave, 12 semitones, over mi and so.',
    ])
  })

  it("numbers Step 4's five leaps in the syllabus's order, each named and sized", () => {
    // Act
    const lines = FIVE_LEAPS.map((_, k) => orderLine(k))

    // Assert: FACTS 93
    expect(lines).toEqual([
      '1 of 5: mi to so, a minor third, 3 semitones',
      '2 of 5: do to mi, a major third, 4 semitones',
      '3 of 5: do to so, a perfect fifth, 7 semitones',
      '4 of 5: so to the top do, a perfect fourth, 5 semitones',
      '5 of 5: do to the top do, an octave, 12 semitones',
    ])
  })
})

describe('Step 5', () => {
  it('reads the landing as outside the band, G sharp 3, and the settle as in the band, A3', () => {
    // Act
    const landed = landingReadout(doOf('lower'), 1.3)
    const settled = landingReadout(doOf('lower'), 2.6)

    // Assert: FACTS 94, the edge lit only at the settle
    expect(landed).toBe(
      "80 cents below Merc's note: outside the band; nearest note G sharp 3",
    )
    expect(settled).toBe(
      "25 cents below Merc's note: in the band; nearest note A3",
    )
    expect(inBand(landingAt(1.3).cents)).toBe(false)
    expect(inBand(landingAt(2.6).cents)).toBe(true)
  })

  it('shows no readout during do’s first second, and begins as the leap lands', () => {
    // Act
    const before = [0, 0.4, 0.9, 0.99].map((t) =>
      landingReadout(doOf('lower'), t),
    )
    const landing = landingReadout(doOf('lower'), 1)

    // Assert: FACTS 94, the readout against so from the leap on
    expect(before).toEqual([null, null, null, null])
    expect(landing).toBe(
      "80 cents below Merc's note: outside the band; nearest note G sharp 3",
    )
  })

  it('reads the higher voice an octave up', () => {
    // Act
    const higher = landingReadout(doOf('higher'), 1.3)

    // Assert
    expect(higher).toBe(
      "80 cents below Merc's note: outside the band; nearest note G sharp 4",
    )
  })

  it("gives the scrub bar the moment, and the band's word once the leap lands, 0 to 3 seconds", () => {
    // Act
    const texts = [1.4, 2.6, 0.4, -1, 9].map(scrubText)

    // Assert
    expect(texts).toEqual([
      "1.4 seconds of 3: 80 cents below Merc's note, outside the band",
      "2.6 seconds of 3: 25 cents below Merc's note, in the band",
      '0.4 seconds of 3',
      '0.0 seconds of 3',
      "3.0 seconds of 3: 25 cents below Merc's note, in the band",
    ])
  })

  it('spans the scrub bar over the whole landing at speed', () => {
    // Assert
    expect(SCRUB_SEC).toBe(LANDING_SEC)
    expect(SCRUB_SEC).toBe(3)
  })
})

describe('free play', () => {
  it('names a leap with its size and way, and a first tap by its rung', () => {
    // Arrange
    const d = doOf('lower')
    const said = (from: RungId | null, to: RungId) => freeLine(d, from, to)

    // Act and Assert
    expect(said('so', 'top')).toBe(
      'So to top do: a perfect fourth, 5 semitones, up',
    )
    expect(said('top', 'so')).toBe(
      'Top do to so: a perfect fourth, 5 semitones, down',
    )
    expect(said('do', 'mi')).toBe('Do to mi: a major third, 4 semitones, up')
    expect(said(null, 'mi')).toBe('Mi, F sharp 3')
    expect(said('so', 'so')).toBe('So, A3')
  })

  it('says mi to the top do by its size alone, never a name the lesson does not teach', () => {
    // Act
    const up = freeLine(doOf('higher'), 'mi', 'top')
    const down = freeLine(doOf('higher'), 'top', 'mi')

    // Assert: FACTS 20
    expect(up).toBe('Mi to top do: 8 semitones, up')
    expect(down).toBe('Top do to mi: 8 semitones, down')
  })
})

describe("every line the chart's sounds say", () => {
  it('passes the guided-voice claims check, as a finding', () => {
    for (const text of allLines()) {
      // Act
      const result = validateGuidedDynamicClaim({ surface: 'finding', text })

      // Assert
      expect(result.violations, text).toEqual([])
    }
  })

  it('holds no sharp or flat sign', () => {
    // Act
    const signed = allLines().filter((l) => /[♯♭]/.test(l))

    // Assert
    expect(signed).toEqual([])
  })
})
