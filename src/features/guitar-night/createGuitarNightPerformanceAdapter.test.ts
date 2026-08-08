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

  it('derives score beats from the audio clock once a reference supplies tempo', () => {
    let position = 0
    const controller = {
      status: () => 'playing',
      positionSeconds: () => position,
      durationSeconds: () => 180,
      playbackRate: () => 0.5,
      play: vi.fn(async () => true),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      setPlaybackRate: vi.fn(async () => true),
    } as unknown as GuitarBackingTransportController

    const performance = createGuitarNightPerformanceAdapter(
      () => controller,
      () => 'Room song',
      () => [],
      () => 120,
    )

    expect(performance.transport.timeline.tempoBpm()).toBe(120)
    expect(performance.transport.timeline.playheadBeat()).toBe(0)

    // Two beats per second at 120 BPM: the beat follows real media time, so a
    // half-speed take advances the score at half speed too.
    position = 4
    expect(performance.transport.timeline.playheadBeat()).toBe(8)

    // Seeking backwards moves the score with the audio rather than drifting.
    position = 1.5
    expect(performance.transport.timeline.playheadBeat()).toBe(3)
  })

  it('refuses to invent beats from an unusable tempo', () => {
    const controller = {
      status: () => 'playing',
      positionSeconds: () => 10,
      durationSeconds: () => 180,
      playbackRate: () => 1,
      play: vi.fn(async () => true),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      setPlaybackRate: vi.fn(async () => true),
    } as unknown as GuitarBackingTransportController

    const performance = createGuitarNightPerformanceAdapter(
      () => controller,
      () => 'Room song',
      () => [],
      () => 0,
    )

    expect(performance.transport.timeline.playheadBeat()).toBeNull()
  })
})
