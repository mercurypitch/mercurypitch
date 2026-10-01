// Mobile render governor tests — only sustained eligible slow frames spend bounded fidelity.

import { describe, expect, it } from 'vitest'
import { createRenderPerformanceGovernor, PERFORMANCE_MAXIMUM_SAMPLE_SECONDS, PERFORMANCE_SAMPLE_COUNT, } from './render-performance-governor'

function samples(
  governor: ReturnType<typeof createRenderPerformanceGovernor>,
  count: number,
  seconds: number,
  eligible = true,
): boolean[] {
  return Array.from({ length: count }, () =>
    governor.observe(seconds, eligible),
  )
}

describe('mobile render performance governor', () => {
  it('waits for loading activation and sustained low-rate evidence', () => {
    const governor = createRenderPerformanceGovernor('auto', 'balanced')
    expect(samples(governor, PERFORMANCE_SAMPLE_COUNT, 1 / 15)).not.toContain(
      true,
    )
    governor.activate()
    expect(
      samples(governor, PERFORMANCE_SAMPLE_COUNT - 1, 1 / 15),
    ).not.toContain(true)
    expect(governor.observe(1 / 15, true)).toBe(true)
    expect(governor.metrics()).toMatchObject({
      adapted: true,
      active: true,
      sampleCount: PERFORMANCE_SAMPLE_COUNT,
      slowSampleCount: PERFORMANCE_SAMPLE_COUNT,
    })
  })

  it('keeps a healthy device unchanged and never oscillates after adapting', () => {
    const governor = createRenderPerformanceGovernor('balanced', 'balanced')
    governor.activate()
    expect(
      samples(governor, PERFORMANCE_SAMPLE_COUNT * 2, 1 / 60),
    ).not.toContain(true)
    expect(
      samples(governor, PERFORMANCE_SAMPLE_COUNT * 2, 1 / 30),
    ).not.toContain(true)
    expect(governor.metrics().adapted).toBe(false)
    expect(samples(governor, PERFORMANCE_SAMPLE_COUNT, 1 / 15)).toContain(true)
    expect(
      samples(governor, PERFORMANCE_SAMPLE_COUNT * 2, 1 / 60),
    ).not.toContain(true)
    expect(governor.metrics().adapted).toBe(true)
  })

  it('does not let one hitch or a mostly healthy window trigger adaptation', () => {
    const governor = createRenderPerformanceGovernor('auto', 'balanced')
    governor.activate()
    governor.observe(PERFORMANCE_MAXIMUM_SAMPLE_SECONDS * 4, true)
    samples(governor, PERFORMANCE_SAMPLE_COUNT - 1, 1 / 60)
    expect(governor.metrics().adapted).toBe(false)
  })

  it('adapts to uneven shadow-update cadence with a slow recurring tail', () => {
    const governor = createRenderPerformanceGovernor('auto', 'balanced')
    governor.activate()
    const decisions = Array.from(
      { length: PERFORMANCE_SAMPLE_COUNT },
      (_, index) => governor.observe(index % 2 === 0 ? 0.07 : 0.016, true),
    )
    expect(decisions).toContain(true)
    expect(governor.metrics()).toMatchObject({
      adapted: true,
      sampleCount: PERFORMANCE_SAMPLE_COUNT,
      slowSampleCount: PERFORMANCE_SAMPLE_COUNT / 2,
    })
  })

  it('still relieves a sustained foreground scene below four frames per second', () => {
    const governor = createRenderPerformanceGovernor('auto', 'balanced')
    governor.activate()
    expect(samples(governor, PERFORMANCE_SAMPLE_COUNT, 0.4)).toContain(true)
    expect(governor.metrics()).toMatchObject({
      adapted: true,
      sampleCount: PERFORMANCE_SAMPLE_COUNT,
      sampleWindowSeconds:
        PERFORMANCE_SAMPLE_COUNT * PERFORMANCE_MAXIMUM_SAMPLE_SECONDS,
      slowSampleCount: PERFORMANCE_SAMPLE_COUNT,
    })
  })

  it('resets partial evidence across pause, hidden or cinematic boundaries', () => {
    const governor = createRenderPerformanceGovernor('auto', 'balanced')
    governor.activate()
    samples(governor, PERFORMANCE_SAMPLE_COUNT - 1, 1 / 15)
    governor.observe(1 / 15, false)
    expect(governor.metrics()).toMatchObject({
      sampleCount: 0,
      slowSampleCount: 0,
    })
    expect(governor.observe(1 / 15, true)).toBe(false)
  })

  it('starts fresh after the foreground lifecycle resumes with a zero-delta frame', () => {
    const governor = createRenderPerformanceGovernor('auto', 'balanced')
    governor.activate()
    samples(governor, PERFORMANCE_SAMPLE_COUNT - 1, 1 / 15)

    expect(governor.observe(0, true)).toBe(false)
    expect(governor.metrics()).toMatchObject({
      adapted: false,
      sampleCount: 0,
      slowSampleCount: 0,
    })
    expect(governor.observe(1 / 15, true)).toBe(false)
  })

  it('lets manual High opt out and starts a fresh window on return', () => {
    const governor = createRenderPerformanceGovernor('balanced', 'balanced')
    governor.activate()
    expect(samples(governor, PERFORMANCE_SAMPLE_COUNT, 1 / 15)).toContain(true)
    governor.configure('high', 'high')
    expect(governor.metrics()).toMatchObject({ adapted: false, sampleCount: 0 })
    expect(samples(governor, PERFORMANCE_SAMPLE_COUNT, 1 / 15)).not.toContain(
      true,
    )
    governor.configure('balanced', 'balanced')
    expect(samples(governor, PERFORMANCE_SAMPLE_COUNT, 1 / 15)).toContain(true)
  })

  it('stops accepting evidence after disposal', () => {
    const governor = createRenderPerformanceGovernor('auto', 'balanced')
    governor.activate()
    samples(governor, PERFORMANCE_SAMPLE_COUNT - 1, 1 / 15)
    governor.dispose()
    expect(governor.observe(1 / 15, true)).toBe(false)
    expect(governor.metrics()).toEqual({
      adapted: false,
      active: false,
      sampleCount: 0,
      sampleWindowSeconds: 0,
      slowSampleCount: 0,
    })
  })
})
