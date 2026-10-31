// Studio transport prebuilt run — once the clock exists, the song's graph is built, settled and parked before Play, so the first Play starts it as it starts a kept one.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '../memory-budget'
import type { StudioProject } from '../model/types'
import type { StudioBufferLease } from './buffer-cache'
import { KEEP_IDLE_MS } from './kept-run'
import { RUN_SETTLE_SECONDS } from './run'
import { envelopeOf, freshGraphs, LEAD, transportFixture, } from './transport.test-fixtures'

afterEach(() => {
  setStudioWorkingBytes(null)
  vi.useRealTimers()
})

type Fixture = ReturnType<typeof transportFixture>

/** Whether a gain still feeds the speakers. */
const heard = (f: Fixture, envelope: ReturnType<typeof envelopeOf>) =>
  envelope.targets.includes(f.ctx.destination)

/** The song with its clip moved: an edit only a new graph can play. */
function movedClip(project: StudioProject, startFrame: number): StudioProject {
  return {
    ...project,
    revision: project.revision + 1,
    clips: [{ ...project.clips[0], startFrame }],
  }
}

async function finish(f: Fixture): Promise<void> {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  expect(studioReservedMemoryBytes()).toBe(0)
}

/** Run the audio clock to `time` and the timers with it. */
async function clockTo(f: Fixture, time: number): Promise<void> {
  const ms = (time - f.ctx.currentTime) * 1000
  f.ctx.currentTime = time
  await vi.advanceTimersByTimeAsync(Math.ceil(ms))
}

describe('Studio transport prebuilt run', () => {
  it('builds the graph ahead once the clock exists, and Play starts it with no build', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    f.ctx.currentTime = 2
    await f.transport.warm(f.project, [f.asset])
    expect(f.unlock).not.toHaveBeenCalled()
    expect(f.buildGraph).toHaveBeenCalledOnce()
    // Built and parked: no source ever scheduled, its compressors settling
    // on the silence it renders through a closed envelope.
    expect(f.graph.park).toHaveBeenCalledOnce()
    expect(f.graph.scheduleUntil).not.toHaveBeenCalled()
    expect(f.graph.settle).toHaveBeenCalledExactlyOnceWith(2)
    const envelope = envelopeOf(f.graph)
    expect(envelope.gain.value).toBe(0)
    expect(heard(f, envelope)).toBe(true)
    // Nothing on screen says it is preparing.
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      pending: false,
    })
    const reserved = studioReservedMemoryBytes()
    expect(reserved).toBeGreaterThan(0)

    // Once settled, nothing renders it: it costs memory, not CPU.
    await clockTo(f, 2 + RUN_SETTLE_SECONDS + 0.1)
    expect(heard(f, envelope)).toBe(false)
    expect(f.graph.dispose).not.toHaveBeenCalled()
    expect(studioReservedMemoryBytes()).toBe(reserved)

    f.ctx.currentTime = 3
    const measured = f.measureLatencies.mock.calls.length
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.unlock).toHaveBeenCalledOnce()
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.cache.acquire).toHaveBeenCalledTimes(2)
    expect(f.measureLatencies).toHaveBeenCalledTimes(measured)
    // As a kept run starts: a device callback and 5 ms of scheduling out,
    // on a whole frame.
    expect(f.graph.resume).toHaveBeenCalledExactlyOnceWith(
      0,
      expect.closeTo(3 + LEAD, 9),
      false,
    )
    expect(heard(f, envelope)).toBe(true)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      pending: false,
    })
    await finish(f)
  })

  it('a Play before the compressors settle starts the graph once they have', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    f.ctx.currentTime = 2
    await f.transport.warm(f.project, [f.asset])
    f.ctx.currentTime = 2.01
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.resume).toHaveBeenCalledExactlyOnceWith(
      0,
      expect.closeTo(2 + RUN_SETTLE_SECONDS, 9),
      false,
    )
    await finish(f)
  })

  it('builds nothing ahead before a press has made the clock', async () => {
    vi.useFakeTimers()
    let made = false
    const unlock = vi.fn(() => {
      made = true
      return Promise.resolve(true)
    })
    const f = transportFixture({
      lease: {
        ensure: () => (made ? (f.ctx.liveContext as AudioContext) : null),
        unlock,
      },
    })
    await f.transport.warm(f.project, [f.asset])
    expect(unlock).not.toHaveBeenCalled()
    expect(f.buildGraph).not.toHaveBeenCalled()
    expect(studioReservedMemoryBytes()).toBe(0)
    // The press that plays makes the clock, and builds as it always has.
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(unlock).toHaveBeenCalledOnce()
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.park).not.toHaveBeenCalled()
    await finish(f)
  })

  it('builds nothing ahead on a clock that is not running', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    f.ctx.state = 'suspended'
    await f.transport.warm(f.project, [f.asset])
    expect(f.buildGraph).not.toHaveBeenCalled()
    expect(studioReservedMemoryBytes()).toBe(0)
    f.ctx.state = 'running'
    await finish(f)
  })

  it('builds nothing ahead while the page is hidden', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    f.transport.setPageHidden(true)
    await f.transport.warm(f.project, [f.asset])
    expect(f.buildGraph).not.toHaveBeenCalled()
    expect(studioReservedMemoryBytes()).toBe(0)
    await finish(f)
  })

  it('keeps the graph Pause kept rather than building another', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset], 0)
    await clockTo(f, 1)
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    await f.transport.warm(f.project, [f.asset])
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.dispose).not.toHaveBeenCalled()
    await finish(f)
  })

  it('builds ahead again after an edit while paused that the kept graph cannot follow', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    await clockTo(f, 1)
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    const moved = movedClip(f.project, 4800)
    await f.transport.setSnapshot(moved, [f.asset])
    // The fake graph cannot move its lanes, so the kept graph goes.
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    await f.transport.warm(moved, [f.asset])
    expect(graphs).toHaveLength(2)
    expect(graphs[1].park).toHaveBeenCalledOnce()
    await clockTo(f, 2)
    expect(await f.transport.play(moved, [f.asset])).toBe(true)
    expect(graphs).toHaveLength(2)
    expect(graphs[1].resume).toHaveBeenCalledOnce()
    await finish(f)
  })

  it('a Play while the graph is still being built ahead waits for it and starts it', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    let settle!: (lease: StudioBufferLease) => void
    const prebuildRelease = vi.fn()
    // The warm-up's own read, then the prebuild's, which waits.
    vi.mocked(f.cache.acquire)
      .mockResolvedValueOnce({ buffers: new Map(), release: f.release })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settle = resolve
          }),
      )
    const warming = f.transport.warm(f.project, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledTimes(2))
    const playing = f.transport.play(f.project, [f.asset])
    await Promise.resolve()
    // Play reads nothing of its own while the warm-up's read is in flight:
    // the cache takes one read at a time.
    expect(f.cache.acquire).toHaveBeenCalledTimes(2)
    settle({ buffers: new Map(), release: prebuildRelease })
    await warming
    expect(await playing).toBe(true)
    expect(graphs).toHaveLength(1)
    expect(graphs[0].park).toHaveBeenCalledOnce()
    expect(graphs[0].resume).toHaveBeenCalledOnce()
    expect(f.cache.acquire).toHaveBeenCalledTimes(2)
    expect(prebuildRelease).not.toHaveBeenCalled()
    await finish(f)
    expect(prebuildRelease).toHaveBeenCalledOnce()
  })

  it('lets a graph built ahead go after the same idle wait as a kept one', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.warm(f.project, [f.asset])
    expect(studioReservedMemoryBytes()).toBeGreaterThan(0)
    // The warm-up's own read went back to the cache; the graph holds its own.
    expect(f.release).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(KEEP_IDLE_MS)
    expect(f.graph.dispose).toHaveBeenCalledOnce()
    expect(f.release).toHaveBeenCalledTimes(2)
    expect(studioReservedMemoryBytes()).toBe(0)
    await finish(f)
  })

  it('releasing audio frees a graph built ahead', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.warm(f.project, [f.asset])
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    expect(f.graph.dispose).toHaveBeenCalledOnce()
    expect(studioReservedMemoryBytes()).toBe(0)
    f.transport.dispose()
  })
})
