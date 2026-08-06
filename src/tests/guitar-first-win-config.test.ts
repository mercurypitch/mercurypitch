// Guitar first-win configuration tests protect safe defaults and bounded overrides.
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_GUITAR_FIRST_WIN_CONFIG, resolveGuitarFirstWinConfig, } from '@/features/guitar-night/first-win-config'

describe('resolveGuitarFirstWinConfig', () => {
  it('returns an independent copy of the bundled defaults for unknown input', () => {
    const resolved = resolveGuitarFirstWinConfig(null)

    expect(resolved).toEqual(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    expect(resolved).not.toBe(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    expect(resolved.exerciseSteps).not.toBe(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.exerciseSteps,
    )
  })

  it('accepts bounded field overrides and compatible custom notes', () => {
    const resolved = resolveGuitarFirstWinConfig({
      configVersion: 'lesson-2',
      tempoBpm: 92,
      countInBeats: 2,
      freshHitsRequested: 6,
      passHits: 5,
      tuningMidiHighToLow: [62, 57, 53, 48, 43, 38],
      inputFallbacks: ['keyboard', 'touch'],
      exerciseSteps: [
        {
          ...DEFAULT_GUITAR_FIRST_WIN_CONFIG.exerciseSteps[0],
          frets: [0, 2, 4],
          expectedMidi: [38, 40, 42],
        },
      ],
    })

    expect(resolved.configVersion).toBe('lesson-2')
    expect(resolved.tempoBpm).toBe(92)
    expect(resolved.countInBeats).toBe(2)
    expect(resolved.freshHitsRequested).toBe(6)
    expect(resolved.passHits).toBe(5)
    expect(resolved.tuningMidiHighToLow).toEqual([62, 57, 53, 48, 43, 38])
    expect(resolved.inputFallbacks).toEqual(['keyboard', 'touch'])
    expect(resolved.exerciseSteps[0].expectedMidi).toEqual([38, 40, 42])
  })

  it('falls back field-by-field when values are unsafe or out of bounds', () => {
    const resolved = resolveGuitarFirstWinConfig({
      configVersion: 'https://unapproved.example/config',
      tempoBpm: 300,
      countInBeats: -1,
      freshHitsRequested: 0,
      passHits: 99,
      timingToleranceMs: 900,
      tuningMidiHighToLow: [1, 2, 3],
      percussionPreset: '<script>',
      inputFallbacks: ['unsupported'],
      completionActions: ['unsupported'],
      exerciseSteps: [
        {
          id: '<unsafe>',
          stringIndex: 9,
          stringLabel: '<unsafe>',
          frets: [25],
          expectedMidi: [999],
        },
      ],
    })

    expect(resolved.configVersion).toBe(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.configVersion,
    )
    expect(resolved.tempoBpm).toBe(DEFAULT_GUITAR_FIRST_WIN_CONFIG.tempoBpm)
    expect(resolved.countInBeats).toBe(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.countInBeats,
    )
    expect(resolved.freshHitsRequested).toBe(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.freshHitsRequested,
    )
    expect(resolved.passHits).toBe(DEFAULT_GUITAR_FIRST_WIN_CONFIG.passHits)
    expect(resolved.timingToleranceMs).toBe(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.timingToleranceMs,
    )
    expect(resolved.tuningMidiHighToLow).toEqual(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.tuningMidiHighToLow,
    )
    expect(resolved.percussionPreset).toBe(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.percussionPreset,
    )
    expect(resolved.inputFallbacks).toEqual(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.inputFallbacks,
    )
    expect(resolved.completionActions).toEqual(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.completionActions,
    )
    expect(resolved.exerciseSteps[0]).toEqual(
      DEFAULT_GUITAR_FIRST_WIN_CONFIG.exerciseSteps[0],
    )
  })

  it('keeps the pass threshold within a smaller requested hit count', () => {
    const resolved = resolveGuitarFirstWinConfig({
      freshHitsRequested: 2,
      passHits: 8,
    })

    expect(resolved.freshHitsRequested).toBe(2)
    expect(resolved.passHits).toBe(2)
  })
})
