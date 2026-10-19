// ============================================================
// Lesson notes tests — a note's names in signs, in words and as markup
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Spelled } from './notes'
import { flatOf, isBlack, nameHtml, sharpOf, signName, signsHtml, spellOn, spellScale, wordName, } from './notes'

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12]
const signs = (ss: readonly Spelled[]): string =>
  ss.map((s) => signName(s, { octave: false })).join(' ')

describe('spellOn', () => {
  it('spells a black key on either neighbouring letter', () => {
    // Act
    const sharp = spellOn(61, 'C')
    const flat = spellOn(61, 'D')

    // Assert
    expect(sharp).toEqual({ letter: 'C', alter: 1, octave: 4 })
    expect(flat).toEqual({ letter: 'D', alter: -1, octave: 4 })
  })

  it("gives a white key's rare name the octave of its letter, not of its sound", () => {
    // Act
    const bSharp = spellOn(60, 'B')
    const cFlat = spellOn(59, 'C')
    const eSharp = spellOn(65, 'E')

    // Assert: B♯3 sounds as C4, C♭4 as B3
    expect(signName(bSharp)).toBe('B♯3')
    expect(signName(cFlat)).toBe('C♭4')
    expect(signName(eSharp)).toBe('E♯4')
  })
})

describe('sharpOf and flatOf', () => {
  it('name every black key both ways and leave a white key its letter', () => {
    // Act
    const blacks = [61, 63, 66, 68, 70].map(
      (m) => `${signName(sharpOf(m))}=${signName(flatOf(m))}`,
    )
    const white = [signName(sharpOf(64)), signName(flatOf(64))]

    // Assert
    expect(blacks).toEqual([
      'C♯4=D♭4',
      'D♯4=E♭4',
      'F♯4=G♭4',
      'G♯4=A♭4',
      'A♯4=B♭4',
    ])
    expect(white).toEqual(['E4', 'E4'])
  })

  it('tells the black keys from the white ones', () => {
    // Act
    const octave = Array.from({ length: 12 }, (_, i) => isBlack(60 + i))

    // Assert
    expect(octave).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ])
  })
})

describe('signName and wordName', () => {
  it('say one note in signs for the eye and in words for a screen reader', () => {
    // Arrange
    const cSharp = sharpOf(61)

    // Act
    const forEye = [signName(cSharp), signName(cSharp, { octave: false })]
    const forEar = [
      wordName(cSharp),
      wordName(flatOf(70), { octave: false }),
      wordName(sharpOf(57)),
    ]

    // Assert: a plain letter is read as it is printed
    expect(forEye).toEqual(['C♯4', 'C♯'])
    expect(forEar).toEqual(['C sharp 4', 'B flat', 'A3'])
  })
})

describe('nameHtml', () => {
  it('shows the sign, hides it from a screen reader and speaks its word instead', () => {
    // Arrange
    const host = document.createElement('p')

    // Act
    host.innerHTML = nameHtml(sharpOf(61))

    // Assert
    expect(host.textContent).toBe('C♯ sharp 4')
    expect(host.querySelector('[aria-hidden="true"]')?.textContent).toBe('♯')
    expect(host.querySelector('.sr')?.textContent).toBe(' sharp ')
  })

  it('leaves a plain letter as plain text', () => {
    // Act
    const html = nameHtml(sharpOf(57))

    // Assert
    expect(html).toBe('A3')
  })
})

describe('signsHtml', () => {
  it('makes every sign in a line of text speakable, with or without an octave', () => {
    // Arrange
    const host = document.createElement('p')

    // Act
    host.innerHTML = signsHtml('Play: A to A♯, then D♭4 & <C>')

    // Assert: hidden signs, spoken words, and the text itself escaped
    const spoken = Array.from(host.childNodes)
      .filter(
        (n) =>
          !(n instanceof Element && n.getAttribute('aria-hidden') === 'true'),
      )
      .map((n) => n.textContent)
      .join('')
    expect(spoken).toBe('Play: A to A sharp, then D flat 4 & <C>')
    expect(host.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })
})

describe('spellScale', () => {
  it('spells each major scale one letter per step, as Lesson 4 tabulates them', () => {
    // Act
    const keys = {
      C: signs(spellScale('C', 60, MAJOR)),
      'D♭': signs(spellScale('D', 61, MAJOR)),
      'F♯': signs(spellScale('F', 66, MAJOR)),
      'B♭': signs(spellScale('B', 70, MAJOR)),
    }

    // Assert
    expect(keys).toEqual({
      C: 'C D E F G A B C',
      'D♭': 'D♭ E♭ F G♭ A♭ B♭ C D♭',
      'F♯': 'F♯ G♯ A♯ B C♯ D♯ E♯ F♯',
      'B♭': 'B♭ C D E♭ F G A B♭',
    })
  })
})
