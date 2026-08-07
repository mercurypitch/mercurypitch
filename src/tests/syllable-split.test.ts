// ============================================================
// syllableBoundaries — the guess that saves the boring half
// ============================================================
//
// This is a suggestion the singer then drags, so a slightly wrong break costs
// one adjustment. What must not happen is a break that is obviously wrong on
// a common word, or a break so close to an edge that it leaves a single
// letter hanging — that reads as the feature being broken rather than
// approximate.

import { describe, expect, it } from 'vitest'
import { syllableBoundaries } from '@/lib/syllable-split'
import { splitGraphemes } from '@/lib/word-letters'

/** Render the proposed split the way a reader would check it: "ba-by". */
function hyphenate(word: string): string {
  const graphemes = splitGraphemes(word)
  const cuts = new Set(syllableBoundaries(word))
  return graphemes
    .map((glyph, i) => (cuts.has(i) ? `-${glyph}` : glyph))
    .join('')
}

describe('syllableBoundaries — words with nothing to split', () => {
  it('leaves a one-syllable word alone', () => {
    for (const word of ['hold', 'on', 'soul', 'bright', 'strength']) {
      expect(syllableBoundaries(word)).toEqual([])
    }
  })

  it('leaves a word too short to divide alone', () => {
    expect(syllableBoundaries('a')).toEqual([])
    expect(syllableBoundaries('go')).toEqual([])
  })

  it('has nothing to say about an empty string', () => {
    expect(syllableBoundaries('')).toEqual([])
  })

  it('does not split a contraction into two', () => {
    // "I'll" is one syllable. An apostrophe is not a syllable start.
    expect(syllableBoundaries("I'll")).toEqual([])
    expect(syllableBoundaries("don't")).toEqual([])
  })
})

describe('syllableBoundaries — ordinary words', () => {
  it('breaks after an open vowel', () => {
    expect(hyphenate('baby')).toBe('ba-by')
    expect(hyphenate('open')).toBe('o-pen')
  })

  it('breaks between doubled consonants', () => {
    expect(hyphenate('better')).toBe('bet-ter')
    expect(hyphenate('hollow')).toBe('hol-low')
  })

  it('keeps a cluster that starts a syllable together', () => {
    // "dec-lare" would be wrong: "cl" begins the second syllable.
    expect(hyphenate('declare')).toBe('de-clare')
  })

  it('never splits a digraph, which is one sound', () => {
    expect(hyphenate('mother')).toBe('mo-ther')
    expect(hyphenate('washing')).toBe('wa-shing')
  })

  it('treats a -le ending as its own syllable', () => {
    // It has no vowel of its own, so the vowel-group walk cannot see it.
    expect(hyphenate('gentle')).toBe('gent-le')
    // What precedes the "l" decides where the break lands: "bl" opens a
    // syllable and comes along, a doubled consonant splits down the middle.
    expect(hyphenate('table')).toBe('ta-ble')
    expect(hyphenate('trouble')).toBe('trou-ble')
    expect(hyphenate('little')).toBe('lit-tle')
  })

  it('handles a name with three syllables', () => {
    expect(syllableBoundaries('Josephine').length).toBeGreaterThanOrEqual(2)
  })
})

describe('syllableBoundaries — what it refuses to do', () => {
  it('never proposes the word own edges', () => {
    for (const word of ['baby', 'Josephine', 'better', 'declare', 'gentle']) {
      const cuts = syllableBoundaries(word)
      expect(cuts).not.toContain(0)
      expect(cuts).not.toContain(splitGraphemes(word).length)
    }
  })

  it('never leaves a single letter as the tail', () => {
    // A one-letter first syllable is real ("o-pen"), a one-letter last one
    // is not — "declar-e" is a split nobody sings.
    for (const word of ['baby', 'Josephine', 'better', 'gentle', 'behind']) {
      const length = splitGraphemes(word).length
      for (const cut of syllableBoundaries(word)) {
        expect(cut).toBeGreaterThanOrEqual(1)
        expect(length - cut).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('returns each boundary once, in order', () => {
    for (const word of ['Josephine', 'understanding', 'gentle', 'terrible']) {
      const cuts = syllableBoundaries(word)
      expect(new Set(cuts).size).toBe(cuts.length)
      expect([...cuts].sort((a, b) => a - b)).toEqual(cuts)
    }
  })

  it('does not propose more breaks than the word has syllables', () => {
    // One break makes two syllables, so breaks < syllables always.
    for (const word of ['baby', 'Josephine', 'better', 'understanding']) {
      expect(syllableBoundaries(word).length).toBeLessThan(word.length)
    }
  })

  it('survives punctuation riding along with the word', () => {
    // The mapper splits on whitespace, so a trailing comma is part of it.
    expect(() => syllableBoundaries('Josephine,')).not.toThrow()
    expect(syllableBoundaries('Josephine,').length).toBeGreaterThan(0)
  })

  it('survives a word that is punctuation only', () => {
    expect(syllableBoundaries('...')).toEqual([])
    expect(syllableBoundaries('—')).toEqual([])
  })

  it('indexes in grapheme space, so an accent stays one position', () => {
    // A combining mark must not shift every later boundary by one.
    const cuts = syllableBoundaries('café-au-lait')
    for (const cut of cuts) {
      expect(cut).toBeLessThanOrEqual(splitGraphemes('café-au-lait').length)
    }
  })
})
