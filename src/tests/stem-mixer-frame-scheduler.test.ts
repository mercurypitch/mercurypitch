import { describe, expect, it } from 'vitest'
import { createStemMixerFrameScheduler } from '@/features/stem-mixer/frame-scheduler'

describe('Stem Mixer frame scheduler', () => {
  it('presents every browser frame while bounding analysis cadence', () => {
    const scheduler = createStemMixerFrameScheduler(30)
    const frames = Array.from(
      { length: 7 },
      (_, index) => Math.floor(index * (1000 / 60) * 10) / 10_000,
    )
    const decisions = frames.map((timestamp) => scheduler.next(timestamp))

    expect(decisions.every((decision) => decision.present)).toBe(true)
    expect(decisions.filter((decision) => decision.analyze)).toHaveLength(4)
  })

  it('resets analysis without dropping the next presentation frame', () => {
    const scheduler = createStemMixerFrameScheduler(30)

    expect(scheduler.next(1)).toEqual({ present: true, analyze: true })
    expect(scheduler.next(1.01)).toEqual({ present: true, analyze: false })
    scheduler.reset()
    expect(scheduler.next(1.01)).toEqual({ present: true, analyze: true })
  })

  it('rejects invalid clocks without presenting stale state', () => {
    const scheduler = createStemMixerFrameScheduler(30)

    expect(scheduler.next(Number.NaN)).toEqual({
      present: false,
      analyze: false,
    })
  })
})
