// ============================================================
// Guitar Night room glass — the numbers, and what zero has to mean
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { GUITAR_NIGHT_GLASS, GUITAR_NIGHT_GLASS_VAR, loadGuitarNightGlass, persistGuitarNightGlass, } from './stage-glass'

describe('the Guitar Night room glass preference', () => {
  beforeEach(() => {
    localStorage.removeItem(GUITAR_NIGHT_GLASS.storageKey)
  })

  it('opens the room partway on a first visit', () => {
    // The complaint was about the DEFAULT being too heavy, so a room nobody
    // has touched is already partway open. Dropping this back to 0 would ship
    // the exact state that was reported.
    expect(GUITAR_NIGHT_GLASS.defaultValue).toBe(0.55)
    expect(loadGuitarNightGlass()).toBe(0.55)
  })

  it('lets the slider reach zero, because zero is the room as it shipped', () => {
    expect(GUITAR_NIGHT_GLASS.min).toBe(0)
    expect(GUITAR_NIGHT_GLASS.max).toBe(1)
    expect(persistGuitarNightGlass(0)).toBe(0)
    expect(loadGuitarNightGlass()).toBe(0)
  })

  it('does not read an absent preference as a deliberate zero', () => {
    expect(localStorage.getItem(GUITAR_NIGHT_GLASS.storageKey)).toBeNull()
    expect(loadGuitarNightGlass()).not.toBe(GUITAR_NIGHT_GLASS.min)
  })

  it('round-trips a chosen value through storage', () => {
    expect(persistGuitarNightGlass(0.8)).toBe(0.8)
    expect(loadGuitarNightGlass()).toBe(0.8)
  })

  it('clamps a value from outside the slider', () => {
    expect(persistGuitarNightGlass(5)).toBe(GUITAR_NIGHT_GLASS.max)
    expect(persistGuitarNightGlass(-5)).toBe(GUITAR_NIGHT_GLASS.min)
  })

  it("keeps its own storage key, separate from Karaoke Night's", () => {
    // Two rooms, two rooms' worth of taste. Sharing a key would make picking
    // a clear Guitar Night room quietly fog the Karaoke stage.
    expect(GUITAR_NIGHT_GLASS.storageKey).toBe('pitchperfect_gn_room_glass')
    expect(GUITAR_NIGHT_GLASS_VAR).toBe('--gn-glass')
  })
})
