import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EAR_VOLUME, formatEarVolume, persistEarVolume, playToneFor, } from './ear-sound'

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
