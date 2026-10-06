// Shatter tuning tests — opt-in hosts share one bounded preference without changing release play.
import { describe, expect, it, vi } from 'vitest'
import { createShatterPlaybackPreference, SHATTER_PLAYBACK_SPEED_PREFERENCE, } from './shatter-playback-preference'

describe('development shatter preference', () => {
  it('loads the saved multiplier and applies changes to the next-break owner', () => {
    const writePreference = vi.fn()
    const apply = vi.fn()
    const pref = createShatterPlaybackPreference(
      { developmentTuning: true, readPreference: () => '0.6', writePreference },
      apply,
    )
    expect(pref.shatterPlaybackSpeed()).toBe(0.6)
    expect(apply).not.toHaveBeenCalled()
    pref.changeShatterPlaybackSpeed(20)
    expect(pref.shatterPlaybackSpeed()).toBe(1.6)
    expect(writePreference).toHaveBeenLastCalledWith(
      SHATTER_PLAYBACK_SPEED_PREFERENCE,
      '1.6',
    )
    expect(apply).toHaveBeenLastCalledWith(1.6)
    pref.changeShatterPlaybackSpeed(0)
    expect(pref.shatterPlaybackSpeed()).toBe(0.4)
    pref.changeShatterPlaybackSpeed(NaN)
    expect(pref.shatterPlaybackSpeed()).toBe(0.5)
  })
  it.each(['0.4', '0.5', '0.7', '1', '1.6'])(
    'preserves a valid saved choice %sx without rewriting it',
    (saved) => {
      const writePreference = vi.fn()
      const pref = createShatterPlaybackPreference(
        {
          developmentTuning: true,
          readPreference: () => saved,
          writePreference,
        },
        vi.fn(),
      )
      expect(pref.shatterPlaybackSpeed()).toBe(Number(saved))
      expect(writePreference).not.toHaveBeenCalled()
    },
  )
  it('ignores saved development timing and change requests in a release host', () => {
    const readPreference = vi.fn(() => '0.4')
    const writePreference = vi.fn()
    const apply = vi.fn()
    const pref = createShatterPlaybackPreference(
      { developmentTuning: false, readPreference, writePreference },
      apply,
    )
    pref.changeShatterPlaybackSpeed(0.6)
    expect(pref.shatterPlaybackSpeed()).toBe(0.5)
    expect(readPreference).not.toHaveBeenCalled()
    expect(writePreference).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
  })
  it.each([null, '', 'oops', 'Infinity'])(
    'uses half speed for unusable saved value %s',
    (saved) => {
      expect(
        createShatterPlaybackPreference(
          {
            developmentTuning: true,
            readPreference: () => saved,
            writePreference: vi.fn(),
          },
          vi.fn(),
        ).shatterPlaybackSpeed(),
      ).toBe(0.5)
    },
  )
})
