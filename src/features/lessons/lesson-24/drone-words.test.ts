// ============================================================
// Lesson 24 drone words tests — the readout, the summaries and the play lines
// ============================================================
//
// WEB-SPEC, Toys 2, and FACTS 28 and 38: the readout says the rate in Beat
// Hunt's words, "still" at none, "beating" or "still" for a chord, and
// nothing while a state is held back; Step 2's shows only after a play and
// Step 4's says the wave's throb is much fainter under a flutter; the
// canvas's summary names what each state draws; and a play's line names
// what it sets against the drone and how it beats.

import { describe, expect, it } from 'vitest'
import type { Choices } from './drone-picture'
import { START } from './drone-picture'
import { dragWords, FIG, HELD_WORDS, hzWords, miWords, playWords, readoutOf, stillWords, WAVE_WORDS, } from './drone-words'
import { playFor } from './sounds'

const NONE: Choices = { cold: false, step2: false }
const COLD: Choices = { cold: true, step2: false }
const BOTH: Choices = { cold: true, step2: true }

const playing = (
  key: Parameters<typeof playFor>[0],
  tuning = START.tuning,
) => ({
  key,
  play: playFor(key, tuning),
})

describe('the readout', () => {
  it('says nothing while a state is held back', () => {
    // Assert
    expect(readoutOf(1, START, NONE, null)).toBeNull()
    expect(readoutOf(3, START, COLD, null)).toBeNull()
  })

  it('says Step 1\'s rate in Beat Hunt\'s words, following its slider or its play, and "still" in tune', () => {
    // Assert
    expect(readoutOf(1, START, COLD, null)).toBe('4 beats a second')
    expect(readoutOf(1, { ...START, top: 220.5 }, COLD, null)).toBe(
      'a beat every 2 s',
    )
    expect(readoutOf(1, START, COLD, playing('220'))).toBe('still')
    expect(readoutOf(1, START, COLD, playing('octave'))).toBe('1 beat a second')
  })

  it("shows Step 2's only after a play: each interval's rate, and the chord beating or still", () => {
    // Assert
    expect(readoutOf(2, START, BOTH, null)).toBeNull()
    expect(readoutOf(2, START, BOTH, playing('fifth'))).toBe(
      'a beat every 1.3 s',
    )
    expect(readoutOf(2, START, BOTH, playing('third'))).toBe(
      '8.7 beats a second',
    )
    expect(readoutOf(2, START, BOTH, playing('chord'))).toBe('beating')
    expect(readoutOf(2, START, BOTH, playing('chord', 'pure'))).toBe('still')
  })

  it("follows Step 3's mi, and gives Step 4's wave FACTS 38's words", () => {
    // Assert
    expect(readoutOf(3, START, BOTH, null)).toBe('8.7 beats a second')
    expect(readoutOf(3, START, BOTH, playing('mi-pure'))).toBe('still')
    expect(readoutOf(4, START, BOTH, null)).toBeNull()
    expect(readoutOf(4, START, BOTH, playing('wave'))).toBe(WAVE_WORDS)
    expect(readoutOf(4, START, BOTH, playing('straight'))).toBe(
      'a beat every 1.3 s',
    )
  })
})

describe('the words beside the chart', () => {
  it("names each state's figure as free play's switch does", () => {
    // Assert
    expect(Object.values(FIG)).toEqual([
      '<span class="fig">Fig. 1</span> Close notes',
      '<span class="fig">Fig. 2</span> The beads',
      '<span class="fig">Fig. 3</span> The band on mi',
      '<span class="fig">Fig. 4</span> The wave',
    ])
  })

  it("keeps the markup's own summary while held back, and names what each state draws", () => {
    // Assert
    expect(stillWords(2, START, NONE)).toBe(HELD_WORDS)
    expect(stillWords(1, START, COLD)).toBe(
      "The drone's band on A3, and the top note's line at 224 Hz, 31 cents above it.",
    )
    expect(stillWords(1, { ...START, top: 220 }, COLD)).toBe(
      "The drone's band on A3, and the top note's line at 220 Hz, on it.",
    )
    expect(stillWords(1, { ...START, octave: true, top: 438 }, COLD)).toMatch(
      /^The band marks the drone's second harmonic, 440 Hz, and the top note's line at 438 Hz, 8 cents below it\.$/,
    )
    expect(stillWords(2, START, COLD)).not.toContain('pure mi')
    expect(stillWords(2, START, BOTH)).toContain(
      'Dashed ticks mark the pure mi and so.',
    )
    expect(stillWords(3, START, BOTH)).toContain(
      "Mi's line is at the piano's tick.",
    )
    expect(stillWords(4, START, BOTH)).toContain('the drone pinned below')
  })

  it("says where Step 3's mi sits against the two ticks", () => {
    // Assert
    expect(miWords(0)).toBe("at the piano's tick")
    expect(miWords(-13.5)).toBe('at the pure tick')
    expect(miWords(-20)).toBe("20 cents under the piano's tick")
    expect(miWords(7.5)).toBe("7.5 cents over the piano's tick")
  })

  it('writes a frequency to a tenth of a hertz', () => {
    expect([hzWords(224), hzWords(220.5), hzWords(277.1826)]).toEqual([
      '224 Hz',
      '220.5 Hz',
      '277.2 Hz',
    ])
  })
})

describe("a play's line", () => {
  it('names what the play sets against the drone, and how it beats', () => {
    // Assert
    expect(playWords(1, START, COLD, '222', playFor('222'))).toBe(
      'The drone with the top note at 222 Hz: 2 beats a second.',
    )
    expect(playWords(1, START, COLD, 'octave', playFor('octave'))).toBe(
      'The drone with the top note at 441 Hz, an octave up: 1 beat a second.',
    )
    expect(
      playWords(
        2,
        { ...START, tuning: 'pure' },
        BOTH,
        'chord',
        playFor('chord', 'pure'),
      ),
    ).toBe('Do, mi and so together, pure: still.')
    expect(playWords(4, START, BOTH, 'wave', playFor('wave'))).toBe(
      "The piano's fifth with a wave: much fainter, under a flutter.",
    )
  })

  it('names where a drag was left', () => {
    expect(dragWords(1, 221)).toBe(
      'The top note at 221 Hz with the drone: 1 beat a second.',
    )
  })
})
