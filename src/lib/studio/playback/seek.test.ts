// Studio seek tests — every run heard moves to one frame from one shared moment, and its meters start again there.
import { describe, expect, it, vi } from 'vitest'
import type { StudioHandoff } from './handoff'
import type { StudioRun } from './run'
import { RUN_LOOKAHEAD_SECONDS } from './run'
import { seekEarliest, seekInPlace, seekRuns, seekTiming } from './seek'

/** A run as a seek sees it: a graph that moves, its latency, its plan's reach, and its meters. */
function fakeRun(
  ctx: { currentTime: number; baseLatency?: number; sampleRate: number },
  options: {
    latency: number
    firstFrame?: number
    untilFrame?: number
    unheardSeekAt?: number
  },
) {
  const pending = options.unheardSeekAt ?? -Infinity
  return {
    ctx,
    graph: {
      seekTime: vi.fn((earliest: number) => Math.max(earliest, pending)),
      seek: vi.fn((_frame: number, at: number): number | null => at),
      scheduleUntil: vi.fn(),
    },
    latency: options.latency,
    firstFrame: options.firstFrame ?? 0,
    endFrame: 96000,
    untilFrame: options.untilFrame ?? 96000,
    startFrame: 0,
    audibleEpoch: 0.26,
    openAt: 0.35,
    meter: { restart: vi.fn() },
    laneMeter: { restart: vi.fn() },
  }
}

const asRuns = (...runs: ReturnType<typeof fakeRun>[]) =>
  runs as unknown as StudioRun[]

describe('Studio seek', () => {
  it('starts no sooner than the device callback the audio thread may be rendering, plus time to schedule', () => {
    const chromium = {
      currentTime: 2,
      baseLatency: 512 / 48000,
      sampleRate: 48000,
    }
    expect(seekEarliest(chromium as AudioContext)).toBeCloseTo(
      2 + 512 / 48000 + 0.005,
      9,
    )
    // A context that does not report it is given 10 ms.
    const quiet = { currentTime: 2, sampleRate: 48000 }
    expect(seekEarliest(quiet as AudioContext)).toBeCloseTo(2.015, 9)
  })

  it('moves every run to the frame from one moment heard, so their handover stays on the same frames, and restarts their meters there', () => {
    const ctx = { currentTime: 1, sampleRate: 48000 }
    const quick = fakeRun(ctx, { latency: 0.02 })
    const slow = fakeRun(ctx, { latency: 0.05 })

    expect(seekRuns(asRuns(quick, slow), 48000)).toBe(true)

    // The slower chain sets the moment: 15 ms of lead plus its 50 ms.
    expect(slow.graph.seek).toHaveBeenCalledExactlyOnceWith(48000, 1.015)
    expect(quick.graph.seek).toHaveBeenCalledExactlyOnceWith(
      48000,
      expect.closeTo(1.045, 9),
    )
    for (const run of [quick, slow]) {
      expect(run.startFrame).toBe(48000)
      expect(run.audibleEpoch).toBeCloseTo(1.065, 9)
      expect(run.meter.restart).toHaveBeenCalledWith(run.audibleEpoch)
      expect(run.laneMeter.restart).toHaveBeenCalledWith(run.audibleEpoch)
      expect(run.graph.scheduleUntil).toHaveBeenCalledWith(
        1 + RUN_LOOKAHEAD_SECONDS,
      )
    }
  })

  it('waits for a seek one graph has not let be heard yet, so the newer one takes its moment', () => {
    const ctx = { currentTime: 1, sampleRate: 48000 }
    const waiting = fakeRun(ctx, { latency: 0.02, unheardSeekAt: 1.03 })
    const other = fakeRun(ctx, { latency: 0.02 })
    expect(seekRuns(asRuns(waiting, other), 4800)).toBe(true)
    expect(waiting.graph.seek).toHaveBeenCalledWith(4800, 1.03)
    expect(other.graph.seek).toHaveBeenCalledWith(4800, 1.03)
  })

  it('moves nothing when one plan does not reach the frame', () => {
    const ctx = { currentTime: 1, sampleRate: 48000 }
    const whole = fakeRun(ctx, { latency: 0.02 })
    const short = fakeRun(ctx, { latency: 0.02, firstFrame: 48000 })
    expect(seekRuns(asRuns(whole, short), 24000)).toBe(false)
    expect(seekRuns(asRuns(whole), 96000)).toBe(false)
    expect(whole.graph.seek).not.toHaveBeenCalled()
    expect(short.graph.seek).not.toHaveBeenCalled()
    expect(whole.meter.restart).not.toHaveBeenCalled()
  })

  it('lets a song that plays once end a pass after the frame, and leaves a repeating one repeating', () => {
    const ctx = { currentTime: 1, sampleRate: 48000 }
    // Repeat turned off three passes in: the run would stop at the end of the fourth.
    const once = fakeRun(ctx, { latency: 0.02, untilFrame: 4 * 96000 })
    const looping = fakeRun(ctx, { latency: 0.02, untilFrame: Infinity })
    seekRuns(asRuns(once, looping), 4800)
    expect(once.untilFrame).toBe(96000)
    expect(looping.untilFrame).toBe(Infinity)
  })

  it('moves the outgoing run of a handover still heard, and leaves one whose crossfade is over', () => {
    const ctx = { currentTime: 1, sampleRate: 48000 }
    const done = fakeRun(ctx, { latency: 0.02 })
    const fading = fakeRun(ctx, { latency: 0.02 })
    const newest = fakeRun(ctx, { latency: 0.02 })
    const middle = { ...fakeRun(ctx, { latency: 0.02 }), openAt: 0.9 }
    const handoffs = [
      { from: done, to: middle, at: 0.87, seek: false },
      { from: fading, to: newest, at: 1.2, seek: true },
    ] as unknown as StudioHandoff[]
    newest.openAt = 1.23

    expect(seekInPlace(handoffs, newest as unknown as StudioRun, 4800)).toBe(
      true,
    )
    expect(done.graph.seek).not.toHaveBeenCalled()
    expect(fading.graph.seek).toHaveBeenCalledOnce()
    expect(newest.graph.seek).toHaveBeenCalledOnce()
    // Both now play the same frames: the handover is no longer a seek's.
    expect(handoffs.every((handoff) => !handoff.seek)).toBe(true)
  })

  it('hands a seek the held run cannot follow to the new run at that frame, once the held run is fully open', () => {
    const ctx = { currentTime: 1, sampleRate: 48000 }
    const held = fakeRun(ctx, { latency: 0.02 }) as unknown as StudioRun
    expect(seekTiming(held, 144000, 120000, 1.3)).toEqual({
      fromFrame: 120000,
      audibleEpoch: 1.3,
    })
    expect(seekTiming(held, 144000, 120000, 0.3)).toEqual({
      fromFrame: 120000,
      audibleEpoch: 0.35,
    })
    // A song that now ends before the frame starts from the top.
    expect(seekTiming(held, 96000, 120000, 1.3).fromFrame).toBe(0)
  })
})
