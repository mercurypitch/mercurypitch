import { describe, expect, it } from 'vitest'
import { clampGuitarTrackMixGain, formatGuitarTrackMixDb, GUITAR_TRACK_MIX_MAX_GAIN, GUITAR_TRACK_MIX_MIN_DB, guitarTrackAudibleAfterMuteToggle, guitarTrackMixDbToGain, normalizeGuitarTrackMixDb, } from './guitar-track-mix'

describe('guitar track mix', () => {
  it('uses the slider floor as a canonical hard mute', () => {
    expect(normalizeGuitarTrackMixDb(GUITAR_TRACK_MIX_MIN_DB)).toBe(
      Number.NEGATIVE_INFINITY,
    )
    expect(normalizeGuitarTrackMixDb(-80)).toBe(Number.NEGATIVE_INFINITY)
    expect(guitarTrackMixDbToGain(GUITAR_TRACK_MIX_MIN_DB)).toBe(0)
    expect(formatGuitarTrackMixDb(GUITAR_TRACK_MIX_MIN_DB)).toBe('−∞ dB')
  })

  it('converts finite dB values to direct gain and caps boost', () => {
    expect(guitarTrackMixDbToGain(0)).toBe(1)
    expect(guitarTrackMixDbToGain(6)).toBeCloseTo(10 ** (6 / 20), 8)
    expect(guitarTrackMixDbToGain(99)).toBeLessThanOrEqual(
      GUITAR_TRACK_MIX_MAX_GAIN,
    )
    expect(clampGuitarTrackMixGain(8)).toBe(GUITAR_TRACK_MIX_MAX_GAIN)
    expect(clampGuitarTrackMixGain(-1)).toBe(0)
  })

  it('normalizes unsafe UI values and formats compact labels', () => {
    expect(normalizeGuitarTrackMixDb(Number.NaN)).toBe(0)
    expect(formatGuitarTrackMixDb(0)).toBe('0 dB')
    expect(formatGuitarTrackMixDb(5.96)).toBe('+6 dB')
    expect(formatGuitarTrackMixDb(-4.44)).toBe('-4.4 dB')
  })

  it('keeps another percussion lane gated through both M directions under Solo', () => {
    expect(
      guitarTrackAudibleAfterMuteToggle('track-drums-b', [], 'track-drums-a'),
    ).toBe(false)
    expect(
      guitarTrackAudibleAfterMuteToggle(
        'track-drums-b',
        ['track-drums-b'],
        'track-drums-a',
      ),
    ).toBe(false)
  })

  it('opens and closes a lane normally when no Solo masks it', () => {
    expect(guitarTrackAudibleAfterMuteToggle('track-drums-b', [], null)).toBe(
      false,
    )
    expect(
      guitarTrackAudibleAfterMuteToggle(
        'track-drums-b',
        ['track-drums-b'],
        null,
      ),
    ).toBe(true)
  })

  it('closes a soloed lane on mute and opens it when its retained M is cleared', () => {
    expect(
      guitarTrackAudibleAfterMuteToggle('track-drums-a', [], 'track-drums-a'),
    ).toBe(false)
    expect(
      guitarTrackAudibleAfterMuteToggle(
        'track-drums-a',
        ['track-drums-a'],
        'track-drums-a',
      ),
    ).toBe(true)
  })
})
