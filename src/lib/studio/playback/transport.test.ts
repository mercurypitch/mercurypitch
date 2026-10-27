// Studio transport lifecycle tests cover delayed preparation, ownership, real clock latency and teardown races.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '../memory-budget'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioBufferCache, StudioBufferLease } from './buffer-cache'
import { PlaybackContext } from './playback.test-fixtures'
import { createStudioTransport } from './transport'

function fixture() {
  const { project, asset } = studioFixture()
  const ctx = new PlaybackContext(44100)
  const release = vi.fn()
  const cache = {
    acquire: vi.fn().mockResolvedValue({ buffers: new Map(), release }),
    clear: vi.fn(),
    dispose: vi.fn(),
  } as unknown as StudioBufferCache
  const graph = {
    output: ctx.createGain() as unknown as GainNode,
    scheduleUntil: vi.fn(),
    readPeaks: () => [0.2, 0.4] as const,
    dispose: vi.fn(),
  }
  const buildGraph = vi.fn().mockReturnValue(graph)
  const unlock = vi.fn().mockResolvedValue(true)
  const changed = vi.fn()
  const measureLatencies = vi.fn().mockResolvedValue([441])
  const transport = createStudioTransport({
    lease: { ensure: () => ctx.liveContext, unlock },
    readCanonicalAsset: vi.fn(),
    changed,
    cache,
    buildGraph,
    measureLatencies,
  })
  return {
    measureLatencies,
    project,
    asset,
    ctx,
    cache,
    graph,
    buildGraph,
    unlock,
    changed,
    release,
    transport,
  }
}

afterEach(() => vi.useRealTimers())

describe('Studio borrowed transport', () => {
  it('measures each chain once and restarts a seek while the old run still fades', async () => {
    vi.useFakeTimers()
    const f = fixture()
    await f.transport.play(f.project, [f.asset])
    const measured = f.measureLatencies.mock.calls.length
    await f.transport.seek(100, f.project, [f.asset])
    // The first run's 240 ms release timer has not run yet.
    expect(f.graph.dispose).not.toHaveBeenCalled()
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    expect(f.measureLatencies).toHaveBeenCalledTimes(measured)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      playheadFrame: 100,
    })
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('warms the cache and chain timing before Play, without unlocking audio', async () => {
    const f = fixture()
    await f.transport.warm(f.project, [f.asset])
    expect(f.unlock).not.toHaveBeenCalled()
    expect(f.cache.acquire).toHaveBeenCalledOnce()
    expect(f.release).toHaveBeenCalledOnce()
    const measured = f.measureLatencies.mock.calls.length
    expect(measured).toBeGreaterThan(0)
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.measureLatencies).toHaveBeenCalledTimes(measured)
    await f.transport.releaseAudio()
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('only starts the newest edit when revisions change during preparation', async () => {
    vi.useFakeTimers()
    const f = fixture()
    let settle!: (value: StudioBufferLease) => void
    vi.mocked(f.cache.acquire).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve
        }),
    )
    const initial = f.transport.play(f.project, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledOnce())
    const firstEdit = f.transport.setSnapshot({ ...f.project, revision: 1 }, [
      f.asset,
    ])
    const lastEdit = f.transport.setSnapshot({ ...f.project, revision: 2 }, [
      f.asset,
    ])
    settle({ buffers: new Map(), release: vi.fn() })
    expect(await initial).toBe(false)
    await Promise.all([firstEdit, lastEdit])
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.buildGraph.mock.calls[0][1].revision).toBe(2)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('does not autoplay and schedules its attack after the first warmup plus measured 44.1k latency', async () => {
    vi.useFakeTimers()
    const f = fixture()
    expect(f.unlock).not.toHaveBeenCalled()
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.buildGraph.mock.calls[0][1].lanes[0].chainLatencySeconds).toBe(
      0.01,
    )
    const envelope = f.ctx.created
      .filter((node) => node.nodeType === 'gain')
      .at(-1) as ReturnType<PlaybackContext['createGain']>
    expect(envelope.gain.ramps).toEqual([{ value: 1, time: 0.35 }])
    f.ctx.currentTime = 0.27
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playheadFrame).toBe(480)
    expect(f.transport.getState()).toMatchObject({ peakL: 0.2, peakR: 0.4 })
    const released = f.transport.releaseAudio()
    expect(f.graph.dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(239)
    expect(f.release).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await released
    expect(f.release).toHaveBeenCalledOnce()
    f.transport.dispose()
    expect(f.ctx.closeCount).toBe(0)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('retains an explicitly measured gain while paused and invalidates it on an edit', async () => {
    vi.useFakeTimers()
    const f = fixture()
    f.transport.setMasterGain({
      projectId: f.project.id,
      revision: f.project.revision,
      gainDb: 3,
      safetyGainDb: -1,
    })
    await f.transport.setSnapshot(f.project, [f.asset])
    expect(f.transport.getState()).toMatchObject({
      masterReady: true,
      playing: false,
    })
    expect(f.unlock).not.toHaveBeenCalled()
    await f.transport.play(f.project, [f.asset])
    const master = f.buildGraph.mock.calls[0][6].spec as {
      effects: { id: string; params: Record<string, number> }[]
    }
    expect(
      master.effects.find((effect) => effect.id === 'loudness')?.params.gainDb,
    ).toBe(3)
    expect(
      master.effects.find((effect) => effect.id === 'peak-safety')?.params
        .gainDb,
    ).toBe(-1)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    expect(f.transport.getState().masterReady).toBe(true)
    await f.transport.setSnapshot({ ...f.project, revision: 1 }, [f.asset])
    expect(f.transport.getState()).toMatchObject({
      masterReady: false,
      playing: false,
    })
    expect(f.buildGraph).toHaveBeenCalledOnce()
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('holds native preparation admission through cancellation and rejects stale completion', async () => {
    const f = fixture()
    let settle!: (value: StudioBufferLease) => void
    vi.mocked(f.cache.acquire).mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve
        }),
    )
    const playing = f.transport.play(f.project, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalled())
    const held = studioReservedMemoryBytes()
    expect(held).toBeGreaterThan(0)
    f.transport.pause()
    expect(studioReservedMemoryBytes()).toBe(held)
    expect(await f.transport.play(f.project, [f.asset])).toBe(false)
    settle({ buffers: new Map(), release: f.release })
    expect(await playing).toBe(false)
    expect(f.buildGraph).not.toHaveBeenCalled()
    expect(f.release).toHaveBeenCalledOnce()
    expect(studioReservedMemoryBytes()).toBe(0)
    f.transport.dispose()
  })

  it('a retired generation cannot stop the next run and interruption never resumes itself', async () => {
    vi.useFakeTimers()
    const f = fixture()
    await f.transport.play(f.project, [f.asset])
    f.transport.pause()
    const nextGraph = { ...f.graph, dispose: vi.fn() }
    f.buildGraph.mockReturnValueOnce(nextGraph)
    await f.transport.play(f.project, [f.asset])
    await vi.advanceTimersByTimeAsync(240)
    expect(f.graph.dispose).toHaveBeenCalledOnce()
    expect(nextGraph.dispose).not.toHaveBeenCalled()
    f.ctx.changeState('suspended')
    expect(f.transport.getState().playing).toBe(false)
    expect(nextGraph.dispose).toHaveBeenCalledOnce()
    f.ctx.changeState('running')
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })
  it('wraps the displayed audio-clock position while one graph keeps repeating', async () => {
    vi.useFakeTimers()
    const f = fixture()
    const project = {
      ...f.project,
      clips: [{ ...f.project.clips[0], startFrame: 0, sourceOutFrame: 96000 }],
    }
    const asset = {
      ...f.asset,
      normalizedFrameCount: 96000,
      canonicalPcmByteLength: 384032,
    }
    f.transport.setRepeat(true)
    await f.transport.play(project, [asset], 48000)
    expect(f.buildGraph.mock.calls[0][5]).toBe(48000)
    f.ctx.currentTime = 2.76
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playing).toBe(true)
    expect(f.transport.getState().playheadFrame).toBe(72000)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})
