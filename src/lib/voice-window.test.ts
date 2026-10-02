import { describe, expect, it } from 'vitest'
import { VOCAL_RANGES } from '@/stores/settings-store'
import { createVoiceWindowFollower, DEFAULT_VOICE_WINDOW, easeMidiWindow, VOICE_WINDOW_LIMITS, VOICE_WINDOW_SETTLE_MS, VOICE_WINDOW_SPAN, voiceWindowFor, } from './voice-window'

/** Frames at the detector's ~60 Hz, `ms` long, all at `midi`. */
function sing(
  follower: ReturnType<typeof createVoiceWindowFollower>,
  fromMs: number,
  ms: number,
  midi: number | null,
): number {
  const step = 16
  let at = fromMs
  for (; at <= fromMs + ms; at += step) follower.push(at, midi)
  return at
}

describe('voiceWindowFor', () => {
  it('opens every voice type on its own two octaves', () => {
    for (const [preset, range] of Object.entries(VOCAL_RANGES)) {
      const window = voiceWindowFor(range)
      expect(window.maxMidi - window.minMidi, preset).toBe(VOICE_WINDOW_SPAN)
      expect(window, preset).toEqual({
        minMidi: range.lowMidi,
        maxMidi: range.highMidi,
      })
    }
  })

  it('puts a soprano two octaves above a bass, not on the same rows', () => {
    expect(voiceWindowFor(VOCAL_RANGES.soprano)).toEqual({
      minMidi: 60,
      maxMidi: 84,
    })
    expect(voiceWindowFor(VOCAL_RANGES.bass)).toEqual({
      minMidi: 40,
      maxMidi: 64,
    })
  })

  it('falls back to C3 to C5 when no voice type has been chosen', () => {
    expect(voiceWindowFor(null)).toEqual({ minMidi: 48, maxMidi: 72 })
    expect(voiceWindowFor(undefined)).toEqual(DEFAULT_VOICE_WINDOW)
  })

  it('centres a band that is not two octaves wide on two octaves', () => {
    expect(voiceWindowFor({ lowMidi: 55, highMidi: 65 })).toEqual({
      minMidi: 48,
      maxMidi: 72,
    })
  })
})

describe('createVoiceWindowFollower', () => {
  it('holds still while the voice stays inside the window', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    let at = sing(follower, 0, 2000, 50)
    at = sing(follower, at, 2000, 71)
    sing(follower, at, 2000, 48.2)
    expect(follower.window()).toEqual(DEFAULT_VOICE_WINDOW)
  })

  it('moves up when the voice settles above the top row', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    sing(follower, 0, VOICE_WINDOW_SETTLE_MS + 50, 76)
    const window = follower.window()
    expect(window.maxMidi - window.minMidi).toBe(VOICE_WINDOW_SPAN)
    expect(window.maxMidi).toBeGreaterThan(76)
    expect(window.minMidi).toBeGreaterThan(DEFAULT_VOICE_WINDOW.minMidi)
    expect(Number.isInteger(window.minMidi)).toBe(true)
  })

  it('moves down when the voice settles below the bottom row', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    sing(follower, 0, VOICE_WINDOW_SETTLE_MS + 50, 41.6)
    const window = follower.window()
    expect(window.maxMidi - window.minMidi).toBe(VOICE_WINDOW_SPAN)
    expect(window.minMidi).toBeLessThan(41)
    expect(Number.isInteger(window.maxMidi)).toBe(true)
  })

  it('leaves headroom past the note that moved it', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    sing(follower, 0, VOICE_WINDOW_SETTLE_MS + 50, 76)
    // The note that moved the window is not on its edge row.
    expect(follower.window().maxMidi - 76).toBeGreaterThanOrEqual(2)
  })

  it('keeps following a voice that keeps climbing', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    let at = sing(follower, 0, 500, 76)
    at = sing(follower, at, 500, 82)
    sing(follower, at, 500, 88)
    const window = follower.window()
    expect(window.maxMidi).toBeGreaterThan(88)
    expect(window.maxMidi - window.minMidi).toBe(VOICE_WINDOW_SPAN)
  })

  it('ignores an octave blip shorter than the settle time', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    let at = sing(follower, 0, 1000, 60)
    // A detector octave error: the same note, twelve up, for 120 ms.
    at = sing(follower, at, 120, 84)
    at = sing(follower, at, 1000, 60)
    // And twelve down.
    at = sing(follower, at, 120, 36)
    sing(follower, at, 1000, 60)
    expect(follower.window()).toEqual(DEFAULT_VOICE_WINDOW)
  })

  it('never moves on silence, however long', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    sing(follower, 0, 10_000, null)
    expect(follower.window()).toEqual(DEFAULT_VOICE_WINDOW)
  })

  it('does not add up blips that silence separates', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    let at = 0
    for (let i = 0; i < 10; i++) {
      at = sing(follower, at, 150, 84)
      at = sing(follower, at, 400, null)
    }
    expect(follower.window()).toEqual(DEFAULT_VOICE_WINDOW)
  })

  it('restarts the settle clock when the voice crosses to the other side', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    const at = sing(follower, 0, 200, 80)
    sing(follower, at, 200, 40)
    expect(follower.window()).toEqual(DEFAULT_VOICE_WINDOW)
  })

  it('stays inside the canvas limits at the extremes', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    const at = sing(follower, 0, 500, 120)
    expect(follower.window().maxMidi).toBe(VOICE_WINDOW_LIMITS.maxMidi)
    sing(follower, at, 500, 10)
    expect(follower.window().minMidi).toBe(VOICE_WINDOW_LIMITS.minMidi)
    expect(follower.window().maxMidi - follower.window().minMidi).toBe(
      VOICE_WINDOW_SPAN,
    )
  })

  it('goes home on reset, and to a new home when given one', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    sing(follower, 0, 500, 80)
    follower.reset()
    expect(follower.window()).toEqual(DEFAULT_VOICE_WINDOW)
    follower.reset(voiceWindowFor(VOCAL_RANGES.bass))
    expect(follower.window()).toEqual({ minMidi: 40, maxMidi: 64 })
  })

  it('drops a pending shift on reset', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    const at = sing(follower, 0, 200, 80)
    follower.reset()
    sing(follower, at, 150, 80)
    expect(follower.window()).toEqual(DEFAULT_VOICE_WINDOW)
  })

  it('ignores frames that are not numbers', () => {
    const follower = createVoiceWindowFollower(DEFAULT_VOICE_WINDOW)
    sing(follower, 0, 1000, Number.NaN)
    sing(follower, 1000, 1000, Number.POSITIVE_INFINITY)
    expect(follower.window()).toEqual(DEFAULT_VOICE_WINDOW)
  })
})

describe('easeMidiWindow', () => {
  const from = { minMidi: 48, maxMidi: 72 }
  const to = { minMidi: 55, maxMidi: 79 }

  it('starts where it was and ends where it is going', () => {
    expect(easeMidiWindow(from, to, 0)).toEqual(from)
    expect(easeMidiWindow(from, to, 1)).toEqual(to)
    expect(easeMidiWindow(from, to, 2)).toEqual(to)
    expect(easeMidiWindow(from, to, -1)).toEqual(from)
  })

  it('keeps the span while it moves, and front-loads the move', () => {
    const mid = easeMidiWindow(from, to, 0.5)
    expect(mid.maxMidi - mid.minMidi).toBeCloseTo(VOICE_WINDOW_SPAN)
    // Ease-out: past halfway by half time.
    expect(mid.minMidi).toBeGreaterThan(51.5)
    expect(mid.minMidi).toBeLessThan(55)
  })
})
