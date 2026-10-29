// Studio transport heard position — the playhead shows the frame at the speakers, while every schedule keeps the render clock.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '../memory-budget'
import { smoothHeardTime } from './heard-clock'
import { heardTime } from './run'
import { FIRST_HEARD, freshGraphs, transportFixture, } from './transport.test-fixtures'

afterEach(() => {
  setStudioWorkingBytes(null)
  vi.useRealTimers()
})

/** The fixture's song as one 2 s take from the start. */
function twoSecondSong(f: ReturnType<typeof transportFixture>) {
  return {
    project: {
      ...f.project,
      clips: [{ ...f.project.clips[0], startFrame: 0, sourceOutFrame: 96000 }],
    },
    asset: {
      ...f.asset,
      normalizedFrameCount: 96000,
      canonicalPcmByteLength: 384032,
    },
  }
}

/** Give the fake clock the output path a browser reports. */
function reportLatency(
  f: ReturnType<typeof transportFixture>,
  outputLatency: unknown,
  baseLatency: unknown,
): void {
  Object.assign(f.ctx, { outputLatency, baseLatency })
}

/** How far a frame is from one computed on the clock: float seconds can round either way. */
function framesOff(actual: number, expected: number): number {
  return Math.abs(actual - expected)
}

async function finish(f: ReturnType<typeof transportFixture>): Promise<void> {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  expect(studioReservedMemoryBytes()).toBe(0)
}

describe('heardTime', () => {
  it('is the clock less the output and base latency, read each call', () => {
    const ctx = { currentTime: 2, outputLatency: 0.04, baseLatency: 0.01 }
    expect(heardTime(ctx as unknown as AudioContext)).toBeCloseTo(1.95, 9)
    ctx.outputLatency = 0.2
    expect(heardTime(ctx as unknown as AudioContext)).toBeCloseTo(1.79, 9)
  })

  it('counts a latency the browser does not report, or reports as nonsense, as none', () => {
    for (const latency of [undefined, null, Number.NaN, -0.5, Infinity])
      expect(
        heardTime({
          currentTime: 2,
          outputLatency: latency,
          baseLatency: latency,
        } as unknown as AudioContext),
      ).toBe(2)
  })
})

describe('Studio transport heard position', () => {
  it('shows the frame at the speakers, re-reading the latency on every tick', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 0)
    // Heard from FIRST_HEARD: the build's settle and 20 ms of chain and
    // master latency.
    reportLatency(f, 0.04, 0.01)
    f.ctx.currentTime = 0.5
    await vi.advanceTimersByTimeAsync(33)
    expect(
      framesOff(
        f.transport.getState().playheadFrame,
        (0.45 - FIRST_HEARD) * 48000,
      ),
    ).toBeLessThanOrEqual(1)
    // A route change moves the output path while the song plays.
    reportLatency(f, 0.09, 0.01)
    await vi.advanceTimersByTimeAsync(33)
    expect(
      framesOff(
        f.transport.getState().playheadFrame,
        (0.4 - FIRST_HEARD) * 48000,
      ),
    ).toBeLessThanOrEqual(1)
    await finish(f)
  })

  it('shows the render position where the browser reports no output path', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 0)
    reportLatency(f, undefined, Number.NaN)
    f.ctx.currentTime = 0.5
    await vi.advanceTimersByTimeAsync(33)
    expect(
      framesOff(
        f.transport.getState().playheadFrame,
        (0.5 - FIRST_HEARD) * 48000,
      ),
    ).toBeLessThanOrEqual(1)
    await finish(f)
  })

  it('holds the playhead on the first frame until that frame reaches the speakers', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 24000)
    reportLatency(f, 0.05, 0.01)
    f.ctx.currentTime = FIRST_HEARD + 0.04
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playheadFrame).toBe(24000)
    f.ctx.currentTime = FIRST_HEARD + 0.16
    await vi.advanceTimersByTimeAsync(33)
    expect(
      framesOff(f.transport.getState().playheadFrame, 24000 + 4800),
    ).toBeLessThanOrEqual(1)
    await finish(f)
  })

  it('pauses on the frame heard, and the next Play starts there', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 0)
    reportLatency(f, 0.04, 0.01)
    f.ctx.currentTime = 0.5
    await vi.advanceTimersByTimeAsync(33)
    f.ctx.currentTime = 0.51
    f.transport.pause()
    const paused = f.transport.getState().playheadFrame
    expect(f.transport.getState().playing).toBe(false)
    expect(framesOff(paused, (0.46 - FIRST_HEARD) * 48000)).toBeLessThanOrEqual(
      1,
    )
    await vi.advanceTimersByTimeAsync(1000)
    expect(await f.transport.play(project, [asset])).toBe(true)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      playheadFrame: paused,
    })
    await finish(f)
  })

  it('ends the song on the render clock and shows its end, though the speakers trail behind', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 0)
    const tail = f.buildGraph.mock.calls[0][1].tailFrames / 48000
    // Longer than the tail, so the speakers are still short of the end.
    reportLatency(f, tail + 0.2, 0.01)
    // The last frame is rendered 2 s after FIRST_HEARD and the tail after it.
    f.ctx.currentTime = FIRST_HEARD + 1.99 + tail
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playing).toBe(true)
    f.ctx.currentTime = FIRST_HEARD + 2.01 + tail
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      playheadFrame: 96000,
    })
    await finish(f)
  })

  it('moves a seek on the render clock and shows the new frame from the click on', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 0)
    reportLatency(f, 0.05, 0.01)
    f.ctx.currentTime = 1
    await vi.advanceTimersByTimeAsync(33)
    await f.transport.seek(48000, project, [asset])
    // The seek lands past the device callback on the render clock: 10 ms of
    // baseLatency and 5 ms to schedule, not the 60 ms the speakers trail by.
    const [, at] = f.graph.seek.mock.calls[0]
    expect(at).toBeCloseTo(1.015, 9)
    expect(f.transport.getState().playheadFrame).toBe(48000)
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playheadFrame).toBe(48000)
    // Heard once the render clock is past the seek by the output path.
    f.ctx.currentTime = 1.2
    await vi.advanceTimersByTimeAsync(33)
    expect(
      framesOff(
        f.transport.getState().playheadFrame,
        48000 + (1.2 - 0.06 - (1.015 + 0.02)) * 48000,
      ),
    ).toBeLessThanOrEqual(1)
    await finish(f)
  })

  it('goes on from the frame rendered when memory drops the playing run for an edit', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    const one = studioReservedMemoryBytes()
    setStudioWorkingBytes(one + Math.floor(one / 2))
    reportLatency(f, 0.05, 0.01)
    f.ctx.currentTime = 1
    const editing = f.transport.setSnapshot(
      {
        ...f.project,
        revision: 1,
        clips: [{ ...f.project.clips[0], startFrame: 960 }],
      },
      [f.asset],
    )
    await vi.advanceTimersByTimeAsync(240)
    await editing
    expect(graphs).toHaveLength(2)
    // The song faded at the render clock, so it goes on from there; the
    // frame heard is 60 ms earlier.
    const { fromFrame } = f.buildGraph.mock.calls[1][4]
    expect(framesOff(fromFrame, (1 - FIRST_HEARD) * 48000)).toBeLessThanOrEqual(
      1,
    )
    await finish(f)
  })
})

describe('smoothHeardTime', () => {
  const clock = (stamp: { contextTime?: number; performanceTime?: number }) =>
    ({
      state: 'running',
      currentTime: 2,
      outputLatency: 0.04,
      baseLatency: 0.01,
      getOutputTimestamp: () => stamp,
    }) as unknown as AudioContext

  it('counts on from the output timestamp between callbacks, never past the render clock', () => {
    const ctx = clock({ contextTime: 1.9, performanceTime: 1000 })
    expect(smoothHeardTime(ctx, 1000)).toBeCloseTo(1.9, 9)
    expect(smoothHeardTime(ctx, 1016)).toBeCloseTo(1.916, 9)
    expect(smoothHeardTime(ctx, 1500)).toBe(2)
  })

  it('reads the clock less latency before the device has played, while suspended, or without timestamps', () => {
    expect(
      smoothHeardTime(clock({ contextTime: 0, performanceTime: 0 }), 50),
    ).toBeCloseTo(1.95, 9)
    const suspended = clock({ contextTime: 1.9, performanceTime: 1000 })
    Object.assign(suspended, { state: 'suspended' })
    expect(smoothHeardTime(suspended, 1100)).toBeCloseTo(1.95, 9)
    expect(
      smoothHeardTime(
        { currentTime: 2, outputLatency: 0.04, baseLatency: 0.01 } as never,
        1100,
      ),
    ).toBeCloseTo(1.95, 9)
  })
})

describe('Studio transport frame now', () => {
  it('moves between ticks by the output clock, while each tick keeps its reading', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 0)
    reportLatency(f, 0.04, 0.01)
    f.ctx.currentTime = 0.5
    await vi.advanceTimersByTimeAsync(33)
    const ticked = f.transport.getState().playheadFrame
    const heard = (0.45 - FIRST_HEARD) * 48000
    expect(framesOff(ticked, heard)).toBeLessThanOrEqual(1)
    // The speakers played render time 0.45 s at performance time 1000 ms.
    Object.assign(f.ctx, {
      getOutputTimestamp: () => ({ contextTime: 0.45, performanceTime: 1000 }),
    })
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    try {
      expect(framesOff(f.transport.frameNow(), heard)).toBeLessThanOrEqual(1)
      now.mockReturnValue(1020)
      expect(
        framesOff(f.transport.frameNow(), heard + 960),
      ).toBeLessThanOrEqual(1)
      expect(f.transport.getState().playheadFrame).toBe(ticked)
    } finally {
      now.mockRestore()
    }
    f.transport.pause()
    expect(f.transport.frameNow()).toBe(f.transport.getState().playheadFrame)
    await finish(f)
  })
})
