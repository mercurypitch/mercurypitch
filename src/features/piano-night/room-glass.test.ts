// ============================================================
// Piano Night room glass — the numbers, and what zero has to mean
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { GUITAR_NIGHT_GLASS } from '../guitar-night/stage-glass'
import { formatPianoNightGlassValue, loadPianoNightGlass, persistPianoNightGlass, PIANO_NIGHT_GLASS, PIANO_NIGHT_GLASS_VAR, } from './room-glass'

describe('the Piano Night room glass preference', () => {
  beforeEach(() => {
    localStorage.removeItem(PIANO_NIGHT_GLASS.storageKey)
  })

  it('opens the room partway on a first visit', () => {
    expect(PIANO_NIGHT_GLASS.defaultValue).toBe(0.45)
    expect(loadPianoNightGlass()).toBe(0.45)
  })

  it('starts gentler than Guitar Night, because the keybed moves with it', () => {
    // Guitar Night's chrome floats over its room; here the play surface does
    // too. If these two ever converge, it should be a decision rather than a
    // copied constant.
    expect(PIANO_NIGHT_GLASS.defaultValue).toBeLessThan(
      GUITAR_NIGHT_GLASS.defaultValue,
    )
  })

  it('lets the slider reach zero, because zero is the room as it shipped', () => {
    expect(PIANO_NIGHT_GLASS.min).toBe(0)
    expect(PIANO_NIGHT_GLASS.max).toBe(1)
    expect(PIANO_NIGHT_GLASS.step).toBe(0.025)
    expect(persistPianoNightGlass(0)).toBe(0)
    expect(loadPianoNightGlass()).toBe(0)
  })

  it('names the useful room-visibility stops without hiding the percentage', () => {
    expect(formatPianoNightGlassValue(0)).toBe('Focused · 0% room visibility')
    expect(formatPianoNightGlassValue(0.35)).toBe('Soft · 35% room visibility')
    expect(formatPianoNightGlassValue(0.45)).toBe('Soft · 45% room visibility')
    expect(formatPianoNightGlassValue(0.6)).toBe('Clear · 60% room visibility')
    expect(formatPianoNightGlassValue(1)).toBe('Open · 100% room visibility')
  })

  it('does not read an absent preference as a deliberate zero', () => {
    expect(localStorage.getItem(PIANO_NIGHT_GLASS.storageKey)).toBeNull()
    expect(loadPianoNightGlass()).not.toBe(PIANO_NIGHT_GLASS.min)
  })

  it('round-trips a chosen value through storage', () => {
    expect(persistPianoNightGlass(0.8)).toBe(0.8)
    expect(loadPianoNightGlass()).toBe(0.8)
  })

  it('clamps a value from outside the slider', () => {
    expect(persistPianoNightGlass(5)).toBe(PIANO_NIGHT_GLASS.max)
    expect(persistPianoNightGlass(-5)).toBe(PIANO_NIGHT_GLASS.min)
  })

  it("keeps its own storage key, separate from Guitar Night's", () => {
    // Three rooms, three rooms' worth of taste. Sharing a key would make a
    // clear piano stage quietly fog the guitar one.
    expect(PIANO_NIGHT_GLASS.storageKey).toBe('pitchperfect_pn_room_glass')
    expect(PIANO_NIGHT_GLASS.storageKey).not.toBe(GUITAR_NIGHT_GLASS.storageKey)
    expect(PIANO_NIGHT_GLASS_VAR).toBe('--pn-glass')
  })
})
