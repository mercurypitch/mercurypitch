// Studio playback quality tests — Auto's pick, the session step down and the device's stored choice.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FULL_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { autoTierLimitUs, createUnderrunWatch, livePlaybackProfile, needsPlaybackBenchmark, notePlayout, pickAutoTier, playbackQualityState, readStoredChoice, recordPlaybackBenchmark, resetPlaybackQualityForTests, setPlaybackChoice, stepDown, subscribePlaybackQuality, TIER_PROFILES, } from './playback-quality'

/** A context whose playout statistics count `events` fallbacks so far. */
function playing(events: () => number) {
  return {
    get playoutStats() {
      return { fallbackFramesEvents: events() }
    },
  } as unknown as BaseAudioContext
}

beforeEach(() => {
  localStorage.clear()
  resetPlaybackQualityForTests({ cores: 16, memoryGb: 8 })
})
afterEach(() => localStorage.clear())

describe('Auto playback quality', () => {
  it('takes the lower of what the device reports and what it measured', () => {
    const best = autoTierLimitUs('best')
    const balanced = autoTierLimitUs('balanced')
    const light = autoTierLimitUs('light')
    expect(best).toBeLessThan(balanced)
    expect(balanced).toBeLessThan(light)
    // Fast enough for a 12-lane song at Best within half the audio thread.
    expect(
      pickAutoTier({ cores: 16, memoryGb: 8, voiceChainUs: best - 1 }),
    ).toBe('best')
    // The same speed with 4 GB: Balanced at most.
    expect(
      pickAutoTier({ cores: 16, memoryGb: 4, voiceChainUs: best - 1 }),
    ).toBe('balanced')
    // Two cores or 2 GB: Light whatever it measured.
    expect(pickAutoTier({ cores: 2, memoryGb: 8, voiceChainUs: 1 })).toBe(
      'light',
    )
    expect(pickAutoTier({ cores: 8, memoryGb: 2, voiceChainUs: 1 })).toBe(
      'light',
    )
    // A slower chain render pulls a strong device down a tier at a time.
    expect(
      pickAutoTier({ cores: 16, memoryGb: 8, voiceChainUs: best + 1 }),
    ).toBe('balanced')
    expect(
      pickAutoTier({ cores: 16, memoryGb: 8, voiceChainUs: balanced + 1 }),
    ).toBe('light')
    expect(
      pickAutoTier({ cores: 16, memoryGb: 8, voiceChainUs: light * 4 }),
    ).toBe('light')
  })

  it('stays at Balanced until the device has shown it can carry Best', () => {
    expect(pickAutoTier({ cores: 16, memoryGb: 8 })).toBe('balanced')
    // A browser that reports nothing at all.
    expect(pickAutoTier({})).toBe('balanced')
  })

  it('measures once per device and plays the result from the next session', () => {
    expect(needsPlaybackBenchmark()).toBe(true)
    recordPlaybackBenchmark(autoTierLimitUs('best') - 1)
    // The session keeps its tier: a paused graph is not built again for it.
    expect(playbackQualityState()).toMatchObject({
      choice: 'auto',
      tier: 'balanced',
    })
    expect(needsPlaybackBenchmark()).toBe(false)
    resetPlaybackQualityForTests({ cores: 16, memoryGb: 8 })
    expect(needsPlaybackBenchmark()).toBe(false)
    expect(playbackQualityState().tier).toBe('best')
  })
})

describe('stepping down on underruns', () => {
  it('needs three fallbacks within five seconds of playing, after its first two', () => {
    const watch = createUnderrunWatch()
    watch.restart(0)
    expect(watch.read({ fallbackFramesEvents: 4 }, 500)).toBe(false)
    expect(watch.read({ fallbackFramesEvents: 4 }, 2500)).toBe(false)
    expect(watch.read({ fallbackFramesEvents: 6 }, 3500)).toBe(false)
    expect(watch.read({ fallbackFramesEvents: 7 }, 4500)).toBe(true)
  })

  it('forgets fallbacks older than its window', () => {
    const watch = createUnderrunWatch()
    watch.restart(0)
    watch.read({ fallbackFramesEvents: 0 }, 2500)
    expect(watch.read({ fallbackFramesEvents: 2 }, 3000)).toBe(false)
    expect(watch.read({ fallbackFramesEvents: 3 }, 9000)).toBe(false)
  })

  it('steps Auto down one tier for the session and says so', () => {
    recordPlaybackBenchmark(autoTierLimitUs('best') - 1)
    resetPlaybackQualityForTests({ cores: 16, memoryGb: 8 })
    const seen: string[] = []
    subscribePlaybackQuality((state) => seen.push(state.tier))
    let events = 0
    const ctx = playing(() => events)
    notePlayout(ctx, 0)
    notePlayout(ctx, 2500)
    events = 3
    notePlayout(ctx, 3000)
    expect(playbackQualityState()).toMatchObject({
      choice: 'auto',
      tier: 'balanced',
      autoTier: 'best',
    })
    expect(playbackQualityState().notice).toMatch(/Balanced for this session/)
    expect(livePlaybackProfile()).toBe(TIER_PROFILES.balanced)
    expect(seen).toEqual(['balanced'])
    // The next session starts from Auto's own pick again.
    resetPlaybackQualityForTests({ cores: 16, memoryGb: 8 })
    expect(playbackQualityState()).toMatchObject({ tier: 'best', notice: null })
  })

  it('never steps a tier the listener chose, nor below Light', () => {
    setPlaybackChoice('best')
    let events = 0
    const ctx = playing(() => events)
    notePlayout(ctx, 2500)
    events = 10
    notePlayout(ctx, 3000)
    expect(playbackQualityState().tier).toBe('best')
    expect(stepDown('light')).toBe('light')
  })

  it('reads nothing where the browser keeps no playout statistics', () => {
    expect(() =>
      notePlayout({} as unknown as BaseAudioContext, 3000),
    ).not.toThrow()
    expect(playbackQualityState().notice).toBeNull()
  })
})

describe('the stored choice', () => {
  it('is kept on this device, and Auto is the default', () => {
    expect(readStoredChoice()).toBe('auto')
    setPlaybackChoice('light')
    expect(readStoredChoice()).toBe('light')
    expect(livePlaybackProfile()).toBe(TIER_PROFILES.light)
    setPlaybackChoice('auto')
    expect(localStorage.length).toBe(0)
  })

  it('plays Best as export renders it', () => {
    setPlaybackChoice('best')
    expect(livePlaybackProfile()).toBe(FULL_FX_PROFILE)
  })

  it('lasts the session when storage throws', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      expect(() => setPlaybackChoice('light')).not.toThrow()
      expect(playbackQualityState().tier).toBe('light')
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
