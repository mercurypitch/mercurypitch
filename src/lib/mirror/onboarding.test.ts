// ============================================================
// Voice Mirror onboarding — "How it works" seen-flag persistence.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { hasSeenHowItWorks, markHowItWorksSeen } from './onboarding'

describe('how-it-works seen flag', () => {
  beforeEach(() => localStorage.clear())

  it('is unseen by default', () => {
    expect(hasSeenHowItWorks(localStorage)).toBe(false)
  })

  it('round-trips after marking seen', () => {
    markHowItWorksSeen(localStorage, 1750000000000)
    expect(hasSeenHowItWorks(localStorage)).toBe(true)
    expect(localStorage.getItem('mirror.howto.v1')).toBe(
      '{"seenAt":1750000000000}',
    )
  })

  it('treats corrupt data as unseen', () => {
    localStorage.setItem('mirror.howto.v1', '{not json')
    expect(hasSeenHowItWorks(localStorage)).toBe(false)
    localStorage.setItem('mirror.howto.v1', '{"seenAt":"nope"}')
    expect(hasSeenHowItWorks(localStorage)).toBe(false)
  })

  it('never throws on a blocked storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    } as unknown as Storage
    expect(hasSeenHowItWorks(blocked)).toBe(false)
    expect(() => markHowItWorksSeen(blocked)).not.toThrow()
  })
})
