// ============================================================
// Merc's lines for Ng slides: the owner's rules, every line
// ============================================================

import { describe, expect, it } from 'vitest'
import { createNgLines, NG_LINES } from './merc-lines'

const every = Object.values(NG_LINES).flat()

describe("Ng slides' lines", () => {
  it('keeps to the product voice: no em dashes, no "calm", one sentence or two', () => {
    for (const line of every) {
      expect(line.text).not.toMatch(/—/u)
      expect(line.text.toLowerCase()).not.toMatch(/calm/u)
      expect(
        line.text.split(/[.!?](?:\s|$)/u).filter(Boolean).length,
      ).toBeLessThanOrEqual(2)
    }
  })

  it('gives every line its own id', () => {
    const ids = every.map((line) => line.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('fills the note, the top and the share', () => {
    const lines = createNgLines(() => 0)

    expect(lines.next('breath', { note: 'B2' })).toBe(
      'Breathe. The next slide starts on B2.',
    )
    expect(lines.next('topFlat', { top: 'E3' })).toBe(
      'Short of E3. Reach a little higher.',
    )
    expect(lines.next('result', { pct: '84%' })).toBe(
      'On the line 84% of the time.',
    )
  })

  it('never says the same line twice running where it has two', () => {
    const lines = createNgLines(() => 0)
    const first = lines.next('archClean')
    expect(lines.next('archClean')).not.toBe(first)
  })
})
