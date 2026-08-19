// ============================================================
// The master can be turned up, and cannot be made to crack
// ============================================================
//
// Reported: singing along drops the backing track and there is no way to get
// it back. The app does no ducking — audited, no compressor, no sidechain, no
// gain move tied to `micActive` — so the level is lost to the platform (iOS
// `playAndRecord`, jam's echo cancellation) and the fix is a control that
// takes it back rather than a bug to remove.
//
// Raising a master that used to be pinned at 0.7 is only safe if something
// catches the overshoot, so these two ship together and are tested together.

import { describe, expect, it } from 'vitest'
import { buildSoftClipCurve, loadMusicLevel, MUSIC_LEVEL, persistMusicLevel, SOFT_CLIP_CURVE_SIZE, SOFT_CLIP_THRESHOLD, softClipSample, } from './master-headroom'

describe('the soft clipper', () => {
  it('is the identity below the threshold, to the bit', () => {
    // The whole point of a threshold rather than a plain `tanh`: a mix at
    // today's level must come out of the new node byte-for-byte unchanged, or
    // this "safety net" is a tone change shipped to everyone.
    for (const x of [0, 0.1, 0.25, 0.5, 0.7, 0.79, SOFT_CLIP_THRESHOLD]) {
      expect(softClipSample(x)).toBe(x)
      expect(softClipSample(-x)).toBe(-x)
    }
  })

  it('never lets a sample past full scale', () => {
    // A two-stem mix at level 2.0 lands here. Without the ceiling it wraps or
    // hard-clips in the device, which is the crackle this exists to prevent.
    //
    // Full scale itself is allowed — the curve's asymptote IS 1.0, and by
    // x=1000 `tanh` has saturated to exactly 1 in float64. Landing on 1.0 is
    // the ceiling working; exceeding it is the failure.
    for (const x of [1, 1.5, 2, 4, 10, 1000]) {
      expect(Math.abs(softClipSample(x))).toBeLessThanOrEqual(1)
      expect(Math.abs(softClipSample(-x))).toBeLessThanOrEqual(1)
    }
  })

  it('stays above the threshold once it is past it', () => {
    // Asymptotic, not folding back: a fold turns loud into quiet-and-wrong,
    // which sounds far worse than the clipping it replaces.
    expect(softClipSample(2)).toBeGreaterThan(SOFT_CLIP_THRESHOLD)
    expect(softClipSample(100)).toBeGreaterThan(softClipSample(2))
  })

  it('rises without ever turning back', () => {
    let previous = -Infinity
    for (let x = -2; x <= 2; x += 0.001) {
      const y = softClipSample(x)
      expect(y).toBeGreaterThanOrEqual(previous)
      previous = y
    }
  })

  it('is odd-symmetric, so it adds no DC offset', () => {
    for (const x of [0.3, 0.9, 1.4, 3]) {
      expect(softClipSample(-x)).toBeCloseTo(-softClipSample(x), 12)
    }
  })

  it('has no corner at the threshold', () => {
    // Continuous in value AND in slope. A kink is a harmonic, and a harmonic
    // that switches on at 0.8 is exactly the "it crackles" report again.
    const h = 1e-6
    const below =
      (softClipSample(SOFT_CLIP_THRESHOLD) -
        softClipSample(SOFT_CLIP_THRESHOLD - h)) /
      h
    const above =
      (softClipSample(SOFT_CLIP_THRESHOLD + h) -
        softClipSample(SOFT_CLIP_THRESHOLD)) /
      h
    expect(below).toBeCloseTo(1, 4)
    expect(above).toBeCloseTo(1, 3)
  })
})

describe('the curve handed to the WaveShaper', () => {
  const curve = buildSoftClipCurve()

  it('spans -1..1 across the declared size', () => {
    expect(curve.length).toBe(SOFT_CLIP_CURVE_SIZE)
    expect(curve[0]).toBeCloseTo(softClipSample(-1), 6)
    expect(curve[curve.length - 1]).toBeCloseTo(softClipSample(1), 6)
  })

  it('passes silence through as silence', () => {
    // The midpoint of an even-length curve straddles zero; both neighbours
    // must be within a step of it or the node adds a DC thump on silence.
    const mid = curve[SOFT_CLIP_CURVE_SIZE / 2]
    expect(Math.abs(mid)).toBeLessThan(0.001)
  })

  it('leaves normal listening levels untouched', () => {
    // Index for x = 0.5 — a hot-but-ordinary sample.
    const index = Math.round(((0.5 + 1) / 2) * (SOFT_CLIP_CURVE_SIZE - 1))
    expect(curve[index]).toBeCloseTo(0.5, 3)
  })

  it('is over a real ArrayBuffer', () => {
    // `WaveShaperNode.curve` rejects the `ArrayBufferLike` a bare
    // `new Float32Array(n)` widens to under this TS config.
    expect(curve.buffer).toBeInstanceOf(ArrayBuffer)
  })
})

describe('the music level', () => {
  it('defaults to the value the master was pinned at', () => {
    // Nobody's mix changes until they move the slider. If this drifts, every
    // existing user gets a loudness change they did not ask for.
    expect(MUSIC_LEVEL.spec.defaultValue).toBe(0.7)
  })

  it('reaches far enough up to answer the complaint', () => {
    // 2.1 over 0.7 is +9.5 dB — the headroom the iOS drop needs.
    expect(MUSIC_LEVEL.spec.max).toBe(2.1)
    const dB =
      20 * Math.log10(MUSIC_LEVEL.spec.max / MUSIC_LEVEL.spec.defaultValue)
    expect(dB).toBeGreaterThan(9)
  })

  it('reaches down as well as up', () => {
    // The other half of singing along is wanting the backing quieter, which
    // was equally impossible with a hardcoded master.
    expect(MUSIC_LEVEL.spec.min).toBeLessThan(MUSIC_LEVEL.spec.defaultValue)
    expect(MUSIC_LEVEL.spec.min).toBeGreaterThan(0)
  })

  it('is a round multiple of the shipped level at every bound', () => {
    // The control reads out as a percentage of the default, and a ceiling
    // that landed on 286% was reported as looking like a bug rather than a
    // limit. Every bound is now a round number of percent by construction:
    // half, triple, and a twentieth for the step.
    const percent = (value: number): number =>
      Math.round((value / MUSIC_LEVEL.spec.defaultValue) * 100)
    expect(percent(MUSIC_LEVEL.spec.min)).toBe(50)
    expect(percent(MUSIC_LEVEL.spec.max)).toBe(300)
    expect(percent(MUSIC_LEVEL.spec.step)).toBe(5)
  })

  it('stores under its own key', () => {
    expect(MUSIC_LEVEL.spec.storageKey).toBe('pitchperfect_mixer_music_level')
  })

  it('clamps a shove past the ceiling', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    }
    expect(MUSIC_LEVEL.persist(99, storage)).toBe(2.1)
    expect(MUSIC_LEVEL.persist(0, storage)).toBe(0.35)
  })
})

describe('the two together', () => {
  it('keep a two-stem mix at full level inside full scale', () => {
    // The case that made the clipper necessary: two stems each peaking at 1.0
    // summed and multiplied by the new maximum master.
    const worstCase = 2 * 1 * MUSIC_LEVEL.spec.max
    expect(worstCase).toBeCloseTo(4.2, 6) // over four times full scale, raw
    expect(Math.abs(softClipSample(worstCase))).toBeLessThan(1)
  })

  it('leave the historic level linear even on a loud peak', () => {
    // One stem at full scale times the old fixed master is 0.7 — still under
    // the threshold, so the default configuration is provably unshaped.
    expect(softClipSample(1 * MUSIC_LEVEL.spec.defaultValue)).toBe(0.7)
  })
})

describe('the browser-storage wrappers', () => {
  // The controller calls these, not the spec object — an untested wrapper is
  // how a working preference ends up wired to the wrong key.
  it('round-trip through real storage', () => {
    localStorage.removeItem(MUSIC_LEVEL.spec.storageKey)
    expect(loadMusicLevel()).toBe(MUSIC_LEVEL.spec.defaultValue)

    expect(persistMusicLevel(1.4)).toBe(1.4)
    expect(localStorage.getItem(MUSIC_LEVEL.spec.storageKey)).toBe('1.4')
    expect(loadMusicLevel()).toBe(1.4)

    // And the clamp survives the wrapper.
    expect(persistMusicLevel(50)).toBe(MUSIC_LEVEL.spec.max)
    expect(loadMusicLevel()).toBe(MUSIC_LEVEL.spec.max)

    localStorage.removeItem(MUSIC_LEVEL.spec.storageKey)
  })
})
