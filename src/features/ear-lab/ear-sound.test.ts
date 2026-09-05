import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { midiToFreq } from '@/lib/scale-data'
import { chordVoicing, EAR_VOLUME, formatEarVolume, persistEarVolume, playChordMidis, playToneFor, } from './ear-sound'

describe('ear-sound', () => {
  it('keeps the stage volume inside 0..1', () => {
    expect(EAR_VOLUME.defaultValue).toBe(0.7)
    expect(persistEarVolume(1.4)).toBe(1)
    expect(persistEarVolume(-1)).toBe(0)
    expect(persistEarVolume(0.55)).toBe(0.55)
  })

  it('prints the level as a percent', () => {
    expect(formatEarVolume(0.7)).toBe('70%')
    expect(formatEarVolume(1)).toBe('100%')
  })
})

describe('playToneFor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('schedules the tone and resolves only once it has sounded', async () => {
    const engine = {
      playTone: vi.fn<(...args: unknown[]) => Promise<void>>(
        async () => undefined,
      ),
    }
    let done = false
    void playToneFor(engine, 440, 500, [4, 7]).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(engine.playTone).toHaveBeenCalledTimes(1)
    expect(engine.playTone.mock.calls[0]?.[0]).toBe(440)
    expect(engine.playTone.mock.calls[0]?.[1]).toBe(500)
    expect(engine.playTone.mock.calls[0]?.[10]).toEqual([4, 7])
    await vi.advanceTimersByTimeAsync(480)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(30)
    expect(done).toBe(true)
  })
})

describe('playChordMidis', () => {
  it('voices the chord as one call, the lowest note as root', async () => {
    const playTone = vi.fn(async (): Promise<void> => {})
    await playChordMidis({ playTone }, [67, 60, 64], 400)
    expect(playTone).toHaveBeenCalledTimes(1)
    const call = playTone.mock.calls[0] as unknown[]
    expect(call[0]).toBeCloseTo(midiToFreq(60))
    expect(call[1]).toBe(400)
    expect(call[10]).toEqual([4, 7])
  })

  it('names the voicing: a leading-tone V, a doubled octave, a unison', () => {
    expect(chordVoicing([59, 62, 67])).toEqual({
      rootMidi: 59,
      intervals: [3, 8],
    })
    expect(chordVoicing([48, 52, 55, 60])).toEqual({
      rootMidi: 48,
      intervals: [4, 7, 12],
    })
    expect(chordVoicing([60, 60])).toEqual({ rootMidi: 60, intervals: [] })
  })
})
