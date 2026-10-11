// ============================================================
// Hold target — voiceprint first, preset anchor second, nudges
// ============================================================

import { describe, expect, it } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, nearestNaturalMidi, nudgeTarget, pickHoldTarget, } from './hold-target'

function voiceprint(
  takenAt: string,
  lowMidi: number | null,
  highMidi: number | null,
): VoiceprintRecord {
  return {
    id: `vp-${takenAt}`,
    summary: {
      lowMidi,
      highMidi,
      semitones:
        lowMidi === null || highMidi === null ? null : highMidi - lowMidi,
      accuracy: 61,
      steadiness: 73,
    },
    twin: null,
    source: 'mirror',
    takenAt,
  }
}

describe('pickHoldTarget', () => {
  it('sits 35 % up the voiceprint span, on the nearest natural note', () => {
    // Arrange: C3..C5 -> 48 + 0.35 * 24 = 56.4, between G#3 and A3; the
    // nearest natural is A3 (57, 0.6 away) not G3 (55, 1.4 away).
    const prints = [voiceprint('2026-10-01T10:00:00Z', 48, 72)]

    // Act
    const target = pickHoldTarget(prints, 'bass')

    // Assert
    expect(target).toEqual({ midi: 57, source: 'voiceprint' })
  })

  it('uses the newest voiceprint whatever order the list is in', () => {
    // Arrange: newest is A2..A4 -> 45 + 8.4 = 53.4 -> F3 (53).
    const prints = [
      voiceprint('2026-09-01T10:00:00Z', 48, 72),
      voiceprint('2026-10-05T10:00:00Z', 45, 69),
      voiceprint('2026-09-20T10:00:00Z', 50, 74),
    ]

    // Act
    const target = pickHoldTarget(prints, 'tenor')

    // Assert
    expect(target).toEqual({ midi: 53, source: 'voiceprint' })
  })

  it('skips a newer voiceprint whose range did not measure', () => {
    // Arrange
    const prints = [
      voiceprint('2026-10-05T10:00:00Z', null, null),
      voiceprint('2026-09-01T10:00:00Z', 48, 72),
    ]

    // Act
    const target = pickHoldTarget(prints, 'tenor')

    // Assert
    expect(target).toEqual({ midi: 57, source: 'voiceprint' })
  })

  it('falls back to the preset anchor and says so when there is no voiceprint', () => {
    // Arrange
    const none: VoiceprintRecord[] = []
    const unmeasured = [voiceprint('2026-10-05T10:00:00Z', null, 70)]

    // Act
    const tenor = pickHoldTarget(none, 'tenor')
    const baritone = pickHoldTarget(unmeasured, 'baritone')

    // Assert: tenor anchors on E3, baritone on C3.
    expect(tenor).toEqual({ midi: 52, source: 'preset' })
    expect(baritone).toEqual({ midi: 48, source: 'preset' })
  })

  it('keeps an implausible voiceprint inside the supported range', () => {
    // Arrange: a glitched take far below a bass.
    const prints = [voiceprint('2026-10-05T10:00:00Z', 20, 30)]

    // Act
    const target = pickHoldTarget(prints, 'tenor')

    // Assert
    expect(target).toEqual({ midi: HOLD_TARGET_MIN_MIDI, source: 'voiceprint' })
  })
})

describe('nearestNaturalMidi', () => {
  it('rounds to the closer white key and breaks a tie downward', () => {
    // Arrange
    const values = [56.4, 61.5, 54, 60.2, 59.4]

    // Act
    const rounded = values.map(nearestNaturalMidi)

    // Assert: A3, D4, F3 (F#3 tie), C4, B3.
    expect(rounded).toEqual([57, 62, 53, 60, 59])
  })
})

describe('nudgeTarget', () => {
  it('moves one semitone each way', () => {
    // Arrange
    const midi = 57

    // Act
    const nudged = [nudgeTarget(midi, 1), nudgeTarget(midi, -1)]

    // Assert
    expect(nudged).toEqual([58, 56])
  })

  it('stops at E2 and C6, the edges of the voice types', () => {
    // Arrange
    const bottom = HOLD_TARGET_MIN_MIDI
    const top = HOLD_TARGET_MAX_MIDI

    // Act
    const nudged = [nudgeTarget(bottom, -1), nudgeTarget(top, 1)]

    // Assert
    expect([bottom, top]).toEqual([40, 84])
    expect(nudged).toEqual([40, 84])
  })
})
