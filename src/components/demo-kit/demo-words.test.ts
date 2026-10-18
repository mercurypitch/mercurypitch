// ============================================================
// The demo's words: the same in every room
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEMO_WORDS } from './demo-words'

describe('DEMO_WORDS', () => {
  it('has every word the demo kit and its cards say', () => {
    expect(Object.keys(DEMO_WORDS).sort()).toEqual(
      [
        'again',
        'ask',
        'cardLine',
        'cardTitle',
        'endTitle',
        'micHint',
        'notNow',
        'off',
        'on',
        'skip',
        'tryIt',
        'watch',
        'watchButton',
      ].sort(),
    )
  })

  it('uses no em dash, says "practice" and has no stray spaces', () => {
    for (const word of Object.values(DEMO_WORDS)) {
      expect(word).not.toContain('—')
      expect(word.toLowerCase()).not.toContain('practise')
      expect(word).toBe(word.trim())
      expect(word.length).toBeGreaterThan(0)
    }
  })
})
