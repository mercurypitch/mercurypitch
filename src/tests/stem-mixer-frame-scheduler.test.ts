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

  it('caps presentation when the device asks for one (television tier)', () => {
    const scheduler = createStemMixerFrameScheduler(15, 30)
    // Seven display frames at 60 Hz should present four times at a 30 Hz cap.
    const frames = Array.from(
      { length: 7 },
      (_, index) => Math.floor(index * (1000 / 60) * 10) / 10_000,
    )
    const decisions = frames.map((timestamp) => scheduler.next(timestamp))

    expect(decisions.filter((decision) => decision.present)).toHaveLength(4)
    expect(decisions.filter((decision) => decision.analyze)).toHaveLength(2)
  })

  it('never analyses a frame it is not presenting', () => {
    const scheduler = createStemMixerFrameScheduler(30, 30)
    const decisions = Array.from({ length: 20 }, (_, index) =>
      scheduler.next(index / 60),
    )

    expect(
      decisions.every((decision) => !decision.analyze || decision.present),
    ).toBe(true)
  })
})
