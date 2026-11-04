// Every string the vowel figure speaks (Lesson 13 WEB-SPEC, Toys 1 and 2;
// Tests 9): spoken names, never a sign; the compact lines before the reveal
// say nothing of what the bars do; the states' lines as the spec gives them.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { addName, allLine, COMPACT_EE, COMPACT_EE_AH, COMPACT_REST, COMPACT_REVEAL, fiveLine, harmonicsLine, ordinal, spokenNote, voiceLine, vowelLine, vowelName, } from './lines'
import { HOME, VOWELS, vowelStrip } from './vowels'

/** Every line the figure can say, on every note Move reaches. */
function everyLine(): string[] {
  const out = [COMPACT_REST, COMPACT_EE, COMPACT_EE_AH, COMPACT_REVEAL]
  for (let m = 53; m <= 73; m++) {
    const voice = m < 65 ? 'lower' : 'higher'
    const f0 = 440 * 2 ** ((m - 69) / 12)
    for (let n = 1; n <= 22; n++) out.push(harmonicsLine(n, m, f0))
    out.push(allLine(18, m, f0), addName(4, f0))
    for (const v of VOWELS)
      out.push(vowelLine(v, m, vowelStrip(voice, m, v).peaks, true))
    out.push(
      fiveLine(
        m,
        VOWELS.map((v) => vowelStrip(voice, m, v).peaks[0]),
      ),
    )
  }
  out.push(voiceLine('higher', HOME.higher, 9, 440, 2))
  return out
}

describe("the figure's lines (WEB-SPEC, Tests 9)", () => {
  it('names notes in spoken words, never a sign', () => {
    // Act / Assert
    expect([spokenNote(57), spokenNote(61), spokenNote(56)]).toEqual([
      'A 3',
      'C sharp 4',
      'G sharp 3',
    ])
    for (const line of everyLine()) expect(line, line).not.toMatch(/[♯♭]/)
  })

  it('writes bars as ordinals: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
    ])
  })

  it('says nothing of what the bars do before the reveal: no heights, louder or softer, and no bar of ‘ah’', () => {
    for (const line of [COMPACT_REST, COMPACT_EE, COMPACT_EE_AH]) {
      expect(line).not.toMatch(/height|louder|softer/i)
      expect(line).not.toMatch(/3rd|5th/)
    }
    expect(COMPACT_REVEAL).toBe('‘Ah’: peaks on the 3rd bar and the 5th.')
  })

  it("gives the steps' lines as the spec writes them", () => {
    expect(harmonicsLine(3, 57, 220)).toBe(
      'Harmonics 1 to 3 of A 3: 220, 440 and 660 hertz, 220 hertz apart.',
    )
    expect(harmonicsLine(18, 57, 220)).toBe(
      'Harmonics 1 to 18 of A 3, up to 3,960 hertz, 220 hertz apart.',
    )
    expect(allLine(18, 57, 220)).toBe(
      'All 18 harmonics of A 3, 220 hertz apart. The line stayed level.',
    )
    expect(vowelLine('ee', 57, [1, 10])).toBe(
      '‘Ee’ on A 3: peaks on the 1st bar and the 10th.',
    )
    expect(voiceLine('lower', 57, 18, 220, 3)).toBe(
      'Lower voice, ‘ah’ on A 3: 18 bars, 220 hertz apart. The tallest is the 3rd.',
    )
    expect(addName(4, 220)).toBe('Add a harmonic: the 4th, 880 hertz')
  })

  it("begins each vowel's name with its label and adds its British word", () => {
    expect(VOWELS.map(vowelName)).toEqual([
      'ee, as in key',
      'eh, as in pet',
      'ah, as in half',
      'oh, as in paw',
      'oo, as in coo',
    ])
  })

  it('says only what the claims check passes, and never that it hears, matches or corrects a vowel', () => {
    for (const text of everyLine()) {
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
      expect(text).not.toMatch(/heard your|match|correct|pronunciation/i)
    }
  })
})
