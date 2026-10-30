// Studio playback quality tests — Auto's pick per song, the session step down and the device's stored choice.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FULL_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { AUTO_LOAD_CEILING, autoPlaybackTier, createUnderrunWatch, livePlaybackProfile, livePlaybackTier, needsPlaybackBenchmark, notePlayout, pickAutoTier, PLAYBACK_TIERS, playbackQualityState, readStoredChoice, recordPlaybackBenchmark, resetPlaybackQualityForTests, setPlaybackChoice, stepDown, subscribePlaybackQuality, TIER_PROFILES, } from './playback-quality'
import { LARGE_SONG, MEDIUM_SONG, roleSong, SMALL_SONG, THIS_DESKTOP_US, } from './song.test-fixtures'

/** A context whose playout statistics count `events` fallbacks so far. */
function playing(events: () => number) {
  return {
    get playoutStats() {
      return { fallbackFramesEvents: events() }
    },
  } as unknown as BaseAudioContext
}

/** Three underruns in a row from `at` ms, while a run built at `tier` plays. */
function breakUp(tier: 'best' | 'balanced' | 'light', at = 0): void {
  let events = 0
  const ctx = playing(() => events)
  notePlayout(ctx, at, tier)
  notePlayout(ctx, at + 2500, tier)
  events = 3
  notePlayout(ctx, at + 3000, tier)
}

const DESKTOP = { cores: 24, memoryGb: 8, voiceChainUs: THIS_DESKTOP_US }
const small = roleSong(SMALL_SONG)
const medium = roleSong(MEDIUM_SONG)
const large = roleSong(LARGE_SONG)

beforeEach(() => {
  localStorage.clear()
  resetPlaybackQualityForTests({ cores: 24, memoryGb: 8 })
})
afterEach(() => localStorage.clear())

describe('Auto playback quality', () => {
  it('plays each profiling fixture at the best tier that played it clean on this desktop', () => {
    // Realtime on this desktop: the 4-lane song played clean at every tier,
    // the 12-lane one only at Light (Balanced underran 0.4 s in every 15),
    // and the 24-lane one underran at every tier. The benchmark read 161.9
    // to 180.3 us over the day; the picks hold across that range.
    for (const voiceChainUs of [161.9, THIS_DESKTOP_US, 180.3]) {
      const hints = { ...DESKTOP, voiceChainUs }
      expect(pickAutoTier(hints, small)).toBe('best')
      expect(pickAutoTier(hints, medium)).toBe('light')
      expect(pickAutoTier(hints, large)).toBe('light')
    }
    expect(AUTO_LOAD_CEILING).toBe(0.55)
  })

  it('raises the tier when lanes are muted or soloed out', () => {
    expect(pickAutoTier(DESKTOP, medium)).toBe('light')
    // Half the 12-lane song muted: what sounds is about the 4-lane song's load.
    expect(
      pickAutoTier(DESKTOP, roleSong(MEDIUM_SONG, [0, 2, 4, 6, 8, 10])),
    ).toBe('best')
    const soloed = {
      ...medium,
      tracks: medium.tracks.map((track, index) => ({
        ...track,
        solo: index < 2,
      })),
    }
    expect(pickAutoTier(DESKTOP, soloed)).toBe('best')
    // A lane without clips builds nothing, so it costs nothing either.
    expect(
      pickAutoTier(DESKTOP, { ...medium, clips: medium.clips.slice(0, 4) }),
    ).toBe('best')
  })

  it('plays the same song at a lower tier on a slower device, and a higher one on a faster', () => {
    const tierOn = (speed: number, song = small) =>
      pickAutoTier({ ...DESKTOP, voiceChainUs: THIS_DESKTOP_US * speed }, song)
    const slower = [1, 1.25, 1.5, 2, 3].map((speed) => tierOn(speed))
    expect(slower[0]).toBe('best')
    expect(slower.at(-1)).toBe('light')
    for (let i = 1; i < slower.length; i++)
      expect(PLAYBACK_TIERS.indexOf(slower[i])).toBeGreaterThanOrEqual(
        PLAYBACK_TIERS.indexOf(slower[i - 1]),
      )
    // The 12-lane song, Light here, fits Balanced and then Best on faster devices.
    expect(tierOn(0.8, medium)).toBe('balanced')
    expect(tierOn(0.6, medium)).toBe('best')
  })

  it('lets the hints cap it until the benchmark is in, Balanced at most', () => {
    expect(pickAutoTier({ cores: 24, memoryGb: 8 }, small)).toBe('balanced')
    expect(pickAutoTier({}, small)).toBe('balanced')
    expect(pickAutoTier({ cores: 2, memoryGb: 8 }, small)).toBe('light')
    expect(pickAutoTier({ cores: 8, memoryGb: 2 }, small)).toBe('light')
    // With a benchmark, the song and the device's speed decide, not the hints.
    expect(
      pickAutoTier({ cores: 4, memoryGb: 4, voiceChainUs: 90 }, small),
    ).toBe('best')
  })

  it('sizes songs with the benchmark from the next Play, and keeps it on the device', () => {
    expect(needsPlaybackBenchmark()).toBe(true)
    expect(autoPlaybackTier(small)).toBe('balanced')
    recordPlaybackBenchmark(THIS_DESKTOP_US)
    expect(needsPlaybackBenchmark()).toBe(false)
    expect(playbackQualityState().measured).toBe(true)
    expect(autoPlaybackTier(small)).toBe('best')
    expect(livePlaybackProfile(medium)).toBe(TIER_PROFILES.light)
    // The next session reads it back.
    resetPlaybackQualityForTests({ cores: 24, memoryGb: 8 })
    expect(needsPlaybackBenchmark()).toBe(false)
    expect(autoPlaybackTier(small)).toBe('best')
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

  it('steps Auto down one tier from the playing run for the session, and says so', () => {
    resetPlaybackQualityForTests(DESKTOP)
    const seen: (string | null)[] = []
    subscribePlaybackQuality((state) => seen.push(state.steppedTo))
    expect(autoPlaybackTier(small)).toBe('best')
    breakUp('best')
    expect(playbackQualityState()).toMatchObject({
      choice: 'auto',
      steppedTo: 'balanced',
    })
    expect(playbackQualityState().notice).toMatch(/Balanced for this session/)
    expect(autoPlaybackTier(small)).toBe('balanced')
    expect(livePlaybackProfile(small)).toBe(TIER_PROFILES.balanced)
    // A song already below the step plays where it was.
    expect(autoPlaybackTier(medium)).toBe('light')
    expect(seen).toEqual(['balanced'])
    // The next session starts from Auto's own pick again.
    resetPlaybackQualityForTests(DESKTOP)
    expect(autoPlaybackTier(small)).toBe('best')
    expect(playbackQualityState().notice).toBeNull()
  })

  it('steps no further while the run built before the step plays on', () => {
    resetPlaybackQualityForTests(DESKTOP)
    breakUp('best')
    // The same Best run still breaking up: Balanced has not been heard yet.
    breakUp('best', 10_000)
    expect(playbackQualityState().steppedTo).toBe('balanced')
    // A run built at Balanced that breaks up too goes on down.
    breakUp('balanced', 20_000)
    expect(playbackQualityState().steppedTo).toBe('light')
    expect(playbackQualityState().notice).toMatch(/Light for this session/)
  })

  it('never steps a tier the listener chose, nor below Light', () => {
    resetPlaybackQualityForTests(DESKTOP)
    setPlaybackChoice('best')
    breakUp('best')
    expect(livePlaybackTier(medium)).toBe('best')
    expect(playbackQualityState().steppedTo).toBeNull()
    expect(stepDown('light')).toBe('light')
  })

  it('reads nothing where the browser keeps no playout statistics', () => {
    expect(() =>
      notePlayout({} as unknown as BaseAudioContext, 3000, 'best'),
    ).not.toThrow()
    expect(playbackQualityState().notice).toBeNull()
  })
})

describe('the stored choice', () => {
  it('is kept on this device, and Auto is the default', () => {
    expect(readStoredChoice()).toBe('auto')
    setPlaybackChoice('light')
    expect(readStoredChoice()).toBe('light')
    expect(livePlaybackProfile(small)).toBe(TIER_PROFILES.light)
    setPlaybackChoice('auto')
    expect(localStorage.length).toBe(0)
  })

  it('plays Best as export renders it, whatever the song', () => {
    setPlaybackChoice('best')
    expect(livePlaybackProfile(large)).toBe(FULL_FX_PROFILE)
  })

  it('lasts the session when storage throws', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      expect(() => setPlaybackChoice('light')).not.toThrow()
      expect(livePlaybackTier(small)).toBe('light')
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
