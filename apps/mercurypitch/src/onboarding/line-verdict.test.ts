// ============================================================
// Merc's word on the sung line: S7b's bands, true to what was sung
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LineFacts } from './line-score'
import { lineScoreText, lineVerdict } from './onboarding-copy'

const facts = (over: Partial<LineFacts>): LineFacts => ({
  hit: 10,
  total: 10,
  trend: null,
  slight: false,
  highFlat: false,
  ...over,
})

describe('lineScoreText', () => {
  it('says the score as the chip does (S7b §6.1)', () => {
    expect(lineScoreText(8, 10)).toBe('8 of 10 notes on pitch')
  })
})

describe('lineVerdict', () => {
  it("keeps S7b's lines for their bands, word for word", () => {
    expect(lineVerdict(facts({}))).toBe('All ten. Clean.')
    expect(lineVerdict(facts({ hit: 8, trend: 'flat', slight: true }))).toBe(
      'Nearly all. The rest sat a hair flat.',
    )
    expect(lineVerdict(facts({ hit: 5, trend: 'flat', highFlat: true }))).toBe(
      'Good start. The high notes want a little more lift.',
    )
    expect(lineVerdict(facts({ hit: 2, trend: 'mixed' }))).toBe(
      'Your voice is still warming up. Once more?',
    )
  })

  it('says sharp when the rest were sharp, as S7b asks of the data', () => {
    expect(lineVerdict(facts({ hit: 9, trend: 'sharp', slight: true }))).toBe(
      'Nearly all. The rest sat a hair sharp.',
    )
  })

  it('drops "a hair" past a semitone, and says the fix', () => {
    expect(lineVerdict(facts({ hit: 7, trend: 'flat' }))).toBe(
      'Nearly all. The rest sat flat. Sing them higher.',
    )
    expect(lineVerdict(facts({ hit: 7, trend: 'sharp' }))).toBe(
      'Nearly all. The rest sat sharp. Sing them lower.',
    )
  })

  it('never names the high notes unless both went flat', () => {
    expect(lineVerdict(facts({ hit: 5, trend: 'flat', slight: true }))).toBe(
      'Good start. Some notes sat flat. Sing them a little higher.',
    )
    expect(lineVerdict(facts({ hit: 4, trend: 'sharp' }))).toBe(
      'Good start. Some notes sat sharp. Sing them lower.',
    )
  })

  it('claims no pitch for notes nobody sang, or for a mix', () => {
    expect(lineVerdict(facts({ hit: 8, trend: 'unsung' }))).toBe(
      'Nearly all. The rest went by unsung.',
    )
    expect(lineVerdict(facts({ hit: 9, trend: 'mixed' }))).toBe(
      'Nearly all. Listen once more for the rest.',
    )
    expect(lineVerdict(facts({ hit: 6, trend: 'unsung' }))).toBe(
      'Good start. Some notes went by unsung. Sing every one.',
    )
    expect(lineVerdict(facts({ hit: 4, trend: 'mixed' }))).toBe(
      'Good start. Listen once more, then match Merc note for note.',
    )
  })

  it('bands by S7b: 10, 7 to 9, 4 to 6, 0 to 3', () => {
    const band = (hit: number) =>
      lineVerdict(facts({ hit, trend: 'mixed' })).split('.')[0]
    expect([0, 3, 4, 6, 7, 9].map(band)).toEqual([
      'Your voice is still warming up',
      'Your voice is still warming up',
      'Good start',
      'Good start',
      'Nearly all',
      'Nearly all',
    ])
  })

  it('writes no dash and no exclamation into any of them', () => {
    const lines = [0, 2, 4, 5, 7, 8, 10].flatMap((hit) =>
      (['flat', 'sharp', 'unsung', 'mixed'] as const).flatMap((trend) =>
        [true, false].map((slight) =>
          lineVerdict(facts({ hit, trend, slight })),
        ),
      ),
    )
    for (const line of lines) expect(line).not.toMatch(/[—–!]/u)
  })
})
