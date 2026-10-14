// ============================================================
// Merc's lines for Lip roll: the owner's rules, every line
// ============================================================

import { describe, expect, it } from 'vitest'
import { createLipLines, LIP_LINES } from './merc-lines'

const every = Object.values(LIP_LINES).flat()

describe("Lip roll's lines", () => {
  it('keeps to the product voice: no em dashes, no "calm", one sentence or two', () => {
    for (const line of every) {
      expect(line.text).not.toMatch(/—/u)
      expect(line.text.toLowerCase()).not.toMatch(/calm/u)
      expect(
        line.text.split(/[.!?](?:\s|$)/u).filter(Boolean).length,
      ).toBeLessThanOrEqual(2)
    }
  })

  it('never claims to hear the lips: the room follows the pitch only', () => {
    for (const line of every) {
      expect(line.text.toLowerCase()).not.toMatch(
        /hear\w* (?:your |the )?(?:buzz|lips|trill)/u,
      )
    }
  })

  it('gives every line its own id', () => {
    const ids = every.map((line) => line.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('fills the note, the top and the share', () => {
    const lines = createLipLines(() => 0)

    expect(lines.next('breath', { note: 'D3' })).toBe(
      'Breathe. The next wave starts on D3.',
    )
    expect(lines.next('shortTop', { top: 'C4' })).toBe(
      'Short of C4. Ride all the way up.',
    )
    expect(lines.next('result', { pct: '88%' })).toBe(
      'On the wave 88% of the time.',
    )
  })

  it('never says the same line twice running where it has two', () => {
    const lines = createLipLines(() => 0)
    const first = lines.next('waveClean')
    expect(lines.next('waveClean')).not.toBe(first)
  })
})
