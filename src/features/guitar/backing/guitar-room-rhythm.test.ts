// Guitar room rhythm tests protect safe preset lookup and lap-to-lap variation.
// ============================================================

import { describe, expect, it } from 'vitest'
import { GUITAR_ROOM_RHYTHM_PRESETS, guitarRoomRhythmHitsForBeat, nextGuitarRoomRhythmVariant, resolveGuitarRoomRhythmPreset, resolveGuitarRoomRhythmPresets, } from './guitar-room-rhythm'

describe('guitar room rhythms', () => {
  it('keeps every bundled hit inside its tempo-free pattern', () => {
    for (const preset of GUITAR_ROOM_RHYTHM_PRESETS) {
      expect(preset.beatsPerPattern).toBeGreaterThan(0)
      expect('tempoBpm' in preset).toBe(false)
      for (const hit of preset.hits) {
        expect(hit.beatOffset).toBeGreaterThanOrEqual(0)
        expect(hit.beatOffset).toBeLessThan(preset.beatsPerPattern)
        expect(hit.velocity).toBeGreaterThan(0)
        expect(hit.velocity).toBeLessThanOrEqual(1)
      }
    }
  })

  it('falls back locally for unknown IDs and filters unsafe variant entries', () => {
    expect(resolveGuitarRoomRhythmPreset('https://example.com/beat').id).toBe(
      'first-win-rock',
    )
    expect(
      resolveGuitarRoomRhythmPresets([
        'unknown',
        'first-win-pocket',
        'first-win-pocket',
      ]).map((preset) => preset.id),
    ).toEqual(['first-win-pocket'])
  })

  it('chooses a deterministic different variant when alternatives exist', () => {
    const ids = ['first-win-rock', 'first-win-pocket', 'first-win-lift']

    expect(nextGuitarRoomRhythmVariant(ids, 'first-win-rock', () => 0).id).toBe(
      'first-win-pocket',
    )
    expect(
      nextGuitarRoomRhythmVariant(ids, 'first-win-rock', () => 0.999).id,
    ).toBe('first-win-lift')
    expect(
      nextGuitarRoomRhythmVariant(['first-win-rock'], 'first-win-rock').id,
    ).toBe('first-win-rock')
  })

  it('maps fractional pattern hits onto repeated authored beats', () => {
    const straight = resolveGuitarRoomRhythmPreset('first-win-rock')

    expect(
      guitarRoomRhythmHitsForBeat(straight, 0).map((hit) => hit.beatOffset),
    ).toEqual([0, 0, 0.5])
    expect(
      guitarRoomRhythmHitsForBeat(straight, 4).map((hit) => hit.beatOffset),
    ).toEqual([0, 0, 0.5])
    expect(
      guitarRoomRhythmHitsForBeat(straight, 3).map((hit) => hit.beatOffset),
    ).toEqual([3, 3, 3.5])
  })
})
