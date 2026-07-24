import { describe, expect, it, vi } from 'vitest'
import { createStemMixerPerformanceDiagnostics } from '@/features/stem-mixer/performance-diagnostics'

describe('Stem Mixer performance diagnostics', () => {
  it('reports animation cadence, long frames, and measured stages', () => {
    const now = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(13)
    const diagnostics = createStemMixerPerformanceDiagnostics(25)
    diagnostics.start(0)

    diagnostics.recordFrame(0)
    diagnostics.recordFrame(16)
    diagnostics.recordFrame(32)
    diagnostics.recordFrame(72)
    diagnostics.measure('analysis', () => 'result')

    const snapshot = diagnostics.snapshot(100)
    expect(snapshot.animation.frames).toBe(4)
    expect(snapshot.animation.fps).toBeCloseTo(41.67, 1)
    expect(snapshot.animation.averageIntervalMs).toBe(24)
    expect(snapshot.animation.worstIntervalMs).toBe(40)
    expect(snapshot.animation.longFrames).toBe(1)
    expect(snapshot.stages.analysis).toMatchObject({
      calls: 1,
      callsPerSecond: 10,
      averageMs: 3,
      worstMs: 3,
    })

    now.mockRestore()
  })

  it('adds no timing work until explicitly enabled', () => {
    const now = vi.spyOn(performance, 'now')
    const diagnostics = createStemMixerPerformanceDiagnostics()

    expect(diagnostics.measure('overview', () => 42)).toBe(42)
    diagnostics.recordFrame(10)

    expect(now).not.toHaveBeenCalled()
    expect(diagnostics.snapshot(100)).toMatchObject({
      sampledMs: 0,
      animation: { frames: 0 },
    })
    now.mockRestore()
  })

  it('stops collection and can reset a sampling window', () => {
    const diagnostics = createStemMixerPerformanceDiagnostics()
    diagnostics.start(0)
    diagnostics.recordFrame(0)
    diagnostics.recordFrame(20)

    expect(diagnostics.stop(20).animation.frames).toBe(2)
    diagnostics.recordFrame(40)
    expect(diagnostics.snapshot(40).animation.frames).toBe(2)

    diagnostics.reset(40)
    expect(diagnostics.snapshot(50).animation.frames).toBe(0)
  })
})
