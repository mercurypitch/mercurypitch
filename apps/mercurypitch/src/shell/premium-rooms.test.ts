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

  it('draws Ng slides full-bleed too, held upright on a phone', () => {
    expect(PREMIUM_ROOM_SCREENS['ng-slides']).toEqual({ fullBleed: true })
    expect(isFullBleed('ng-slides')).toBe(true)
    expect(isPremiumRoom('ng-slides')).toBe(true)
  })

  it('draws Lip roll full-bleed too, held upright on a phone', () => {
    expect(PREMIUM_ROOM_SCREENS['lip-roll']).toEqual({ fullBleed: true })
    expect(isFullBleed('lip-roll')).toBe(true)
    expect(isPremiumRoom('lip-roll')).toBe(true)
  })

  it("draws the Warm-up's path full-bleed too, held upright on a phone", () => {
    expect(PREMIUM_ROOM_SCREENS['warm-up']).toEqual({ fullBleed: true })
    expect(isFullBleed('warm-up')).toBe(true)
    expect(isPremiumRoom('warm-up')).toBe(true)
  })

  it('draws Home note, the first Ear room, full-bleed too, held upright on a phone', () => {
    expect(PREMIUM_ROOM_SCREENS['home-note']).toEqual({ fullBleed: true })
    expect(isFullBleed('home-note')).toBe(true)
    expect(isPremiumRoom('home-note')).toBe(true)
  })

  it('draws First note, the second Ear room, full-bleed too, held upright on a phone', () => {
    expect(PREMIUM_ROOM_SCREENS['first-note']).toEqual({ fullBleed: true })
    expect(isFullBleed('first-note')).toBe(true)
    expect(isPremiumRoom('first-note')).toBe(true)
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
