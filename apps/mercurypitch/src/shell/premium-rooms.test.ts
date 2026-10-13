// ============================================================
// Premium rooms on the stack: which are full-bleed, which hold portrait
// ============================================================

import { describe, expect, it } from 'vitest'
import { isFullBleed, isPremiumRoom, PREMIUM_ROOM_SCREENS, } from './premium-rooms'

describe('premium rooms', () => {
  it('draws Long note full-bleed (decision D1, 13 Oct 2026)', () => {
    expect(PREMIUM_ROOM_SCREENS['long-note']).toEqual({ fullBleed: true })
    expect(isFullBleed('long-note')).toBe(true)
    expect(isPremiumRoom('long-note')).toBe(true)
  })

  it('draws Echo full-bleed too, held upright on a phone', () => {
    expect(PREMIUM_ROOM_SCREENS.echo).toEqual({ fullBleed: true })
    expect(isFullBleed('echo')).toBe(true)
    expect(isPremiumRoom('echo')).toBe(true)
  })

  it('leaves every other screen under the opaque bar, free to turn', () => {
    for (const screen of ['settings', 'karaoke', 'developer'] as const) {
      expect(isFullBleed(screen)).toBe(false)
      expect(isPremiumRoom(screen)).toBe(false)
    }
    expect(isFullBleed(null)).toBe(false)
    expect(isPremiumRoom(null)).toBe(false)
  })
})
