// ============================================================
// Lesson 12 numerals tests — every numeral spoken as a number and a quality
// ============================================================
//
// WEB-SPEC, Tests 10's numeral clauses: "I–V–vi–IV" is "one, five, six
// minor, four" and "vii°" "seven diminished"; the spoken text holds no
// bare numeral; the markup shows the numeral and speaks the words, as
// `signsHtml` does for a sign (Toys 8, Contract).

import { describe, expect, it } from 'vitest'
import { romanOf } from '@/lib/ear/progressions'
import { numberWord, numeralHtml, spokenNumeral } from './numerals'

/** The app's seven numerals, I to vii°. */
const SEVEN = [1, 2, 3, 4, 5, 6, 7].map(romanOf)

/** A Roman numeral standing as a word, or the diminished circle. */
const BARE = /\b(?:[IV]+|[iv]+)\b|°/

/** Markup as the eye reads it: the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')

/** Markup as a screen reader reads it: the aria-hidden part dropped. */
const heard = (html: string): string =>
  html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')

describe('spokenNumeral', () => {
  it('speaks each of the seven as its number, with minor after a lower-case one and diminished after vii°', () => {
    // Act
    const spoken = SEVEN.map(spokenNumeral)

    // Assert: FACTS 10 and 17
    expect(spoken).toEqual([
      'one',
      'two minor',
      'three minor',
      'four',
      'five',
      'six minor',
      'seven diminished',
    ])
  })

  it('speaks the loop, I–V–vi–IV, as "one, five, six minor, four"', () => {
    // Act
    const spoken = spokenNumeral('I–V–vi–IV')

    // Assert: Tests 10
    expect(spoken).toBe('one, five, six minor, four')
  })

  it('leaves no bare numeral and no circle in anything it says', () => {
    // Arrange
    const inputs = [...SEVEN, 'I–V–vi–IV', 'vi–IV–I–V', 'I–vi–IV–V']

    for (const input of inputs) {
      // Act
      const spoken = spokenNumeral(input)

      // Assert
      expect(spoken, input).not.toMatch(BARE)
    }
  })

  it('refuses anything that is not a numeral, the pronoun I in a sentence included', () => {
    // Assert
    for (const text of ["I'm", 'V°', 'vi+', 'VIII', 'Iv', ''])
      expect(() => spokenNumeral(text), text).toThrow(/not a numeral/)
  })
})

describe('numberWord', () => {
  it('names the degrees one to seven in words, and no other', () => {
    // Assert
    expect([1, 2, 3, 4, 5, 6, 7].map(numberWord)).toEqual([
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
    ])
    expect(() => numberWord(8)).toThrow()
    expect(() => numberWord(0)).toThrow()
  })
})

describe('numeralHtml', () => {
  it('shows the numeral and speaks its words, the numeral hidden from a screen reader', () => {
    // Act
    const html = numeralHtml('vii°')

    // Assert
    expect(html).toBe(
      '<span aria-hidden="true">vii°</span><span class="sr">seven diminished</span>',
    )
    expect(seen(html)).toBe('vii°')
    expect(heard(html)).toBe('seven diminished')
  })

  it('reads a numeral in a line of copy as words, in its place', () => {
    // Act
    const line = `In C major, what are the roots of ${numeralHtml('I–V–vi–IV')}?`

    // Assert
    expect(seen(line)).toBe('In C major, what are the roots of I–V–vi–IV?')
    expect(heard(line)).toBe(
      'In C major, what are the roots of one, five, six minor, four?',
    )
    expect(heard(line)).not.toMatch(BARE)
  })
})
