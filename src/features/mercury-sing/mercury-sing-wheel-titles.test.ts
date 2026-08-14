// ============================================================
// Wheel titles — what survives the arc
// ============================================================
//
// A textPath does not wrap: text longer than its arc is clipped at BOTH
// ends, so the truncation and the type scale are the difference between
// "Hallowed Be Thy Name" and "allowed Be Thy Nam". These helpers are pure
// and exported for exactly this test.

import { describe, expect, it } from 'vitest'
import { titleFontSize, truncateTitle } from './MercurySingWheel'

describe('truncateTitle', () => {
  it('passes short titles through, whitespace collapsed', () => {
    expect(truncateTitle('Fear of the Dark')).toBe('Fear of the Dark')
    expect(truncateTitle('  Fear   of the Dark  ')).toBe('Fear of the Dark')
  })

  it('cuts at 24 chars with an ellipsis, no trailing space before it', () => {
    const long = 'Somewhere Over The Rainbow Tonight'
    const cut = truncateTitle(long)
    expect(cut.length).toBeLessThanOrEqual(24)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut).not.toMatch(/\s…$/)
  })

  it('a 24-char title is NOT truncated — the cut starts beyond the limit', () => {
    const exact = 'x'.repeat(24)
    expect(truncateTitle(exact)).toBe(exact)
  })

  it('an empty or blank name still reads as something', () => {
    expect(truncateTitle('')).toBe('Your song')
    expect(truncateTitle('   ')).toBe('Your song')
  })
})

describe('titleFontSize', () => {
  it('steps down at the 14 and 19 character breakpoints', () => {
    expect(titleFontSize('x'.repeat(14))).toBe(17)
    expect(titleFontSize('x'.repeat(15))).toBe(15)
    expect(titleFontSize('x'.repeat(19))).toBe(15)
    expect(titleFontSize('x'.repeat(20))).toBe(13)
  })
})
