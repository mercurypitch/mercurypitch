// ============================================================
// Names modes tests — the switch's modes, and the sung names each scale shows
// ============================================================
//
// Lesson 4's three modes in its order, the two the later lessons offer, and
// the syllables (Lesson 10's Tests 13, its syllable half): under Major, do
// re mi fa so la ti do; under Minor, do re me fa so le te do, the third,
// sixth and seventh changed and nothing else.

import { describe, expect, it } from 'vitest'
import { LETTERS_SOLFEGE_MODES, MAJOR_SOLFEGE, MINOR_SOLFEGE, NAMES_MODES, } from './names-modes'

describe('names modes', () => {
  it("offers Lesson 4's Letters, Numbers and Do-re-mi, in that order", () => {
    expect(NAMES_MODES).toEqual(['letters', 'numbers', 'solfege'])
  })

  it('offers Letters and Do-re-mi, and no numbers, where a lesson drops the degree numbers', () => {
    expect(LETTERS_SOLFEGE_MODES).toEqual(['letters', 'solfege'])
  })
})

describe('the sung names', () => {
  it('sings the major scale do re mi fa so la ti do', () => {
    expect(MAJOR_SOLFEGE.join(' ')).toBe('do re mi fa so la ti do')
  })

  it('sings the natural minor scale do re me fa so le te do', () => {
    expect(MINOR_SOLFEGE.join(' ')).toBe('do re me fa so le te do')
  })

  it('changes only the third, the sixth and the seventh from major to minor', () => {
    // Act
    const changed = MAJOR_SOLFEGE.flatMap((s, i) =>
      s === MINOR_SOLFEGE[i] ? [] : [i + 1],
    )

    // Assert
    expect(changed).toEqual([3, 6, 7])
  })
})
