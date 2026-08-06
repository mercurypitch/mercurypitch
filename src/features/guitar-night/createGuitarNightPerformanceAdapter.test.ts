// Guitar Night performance-adapter tests protect native seconds and honest score absence.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import { createGuitarNightPerformanceAdapter } from './createGuitarNightPerformanceAdapter'

describe('createGuitarNightPerformanceAdapter', () => {
  it('keeps backing time in seconds and leaves beat data absent without a score', async () => {
    const play = vi.fn(async () => true)
    const seek = vi.fn()
    const controller = {
      status: () => 'armed',
      positionSeconds: () => 42.5,
      durationSeconds: () => 180,
      playbackRate: () => 1,
      play,
      pause: vi.fn(),
      stop: vi.fn(),
      seek,
      setPlaybackRate: vi.fn(async () => true),
    } as unknown as GuitarBackingTransportController

    const performance = createGuitarNightPerformanceAdapter(
      () => controller,
      () => 'Room song',
      () => [],
    )

    expect(performance.transport.timeline.positionSeconds()).toBe(42.5)
    expect(performance.transport.timeline.durationSeconds()).toBe(180)
    expect(performance.transport.timeline.playheadBeat()).toBeNull()
    expect(performance.transport.timeline.tempoBpm()).toBeNull()
    expect(performance.transport.phase()).toBe('ready')
    await expect(performance.transport.play()).resolves.toBe(true)
    performance.transport.seekSeconds(9)
    expect(play).toHaveBeenCalledOnce()
    expect(seek).toHaveBeenCalledWith(9)
  })
})
