// Studio transport level tests — a newly measured master gain and each lane's meter reach the song playing.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { studioReservedMemoryBytes } from '../memory-budget'
import type { StudioBufferLease } from './buffer-cache'
import { freshGraphs, transportFixture } from './transport.test-fixtures'

afterEach(() => vi.useRealTimers())

async function finish(f: ReturnType<typeof transportFixture>) {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  expect(studioReservedMemoryBytes()).toBe(0)
}

describe('Studio transport levels', () => {
  it('glides a playing song to a newly measured master gain, without a restart', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset], 0)
    f.graph.setMasterSpec.mockClear()

    const measured = { gainDb: 4.5, safetyGainDb: -1.5 }
    f.transport.setMasterGain({
      projectId: f.project.id,
      revision: f.project.revision,
      ...measured,
    })
    expect(f.graph.setMasterSpec).toHaveBeenCalledExactlyOnceWith(
      resolveStudioSoundGraph(f.project, measured).full,
    )
    // The hook's setSnapshot that follows has nothing left to move.
    await f.transport.setSnapshot(f.project, [f.asset])
    expect(f.graph.setMasterSpec).toHaveBeenCalledOnce()
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      masterReady: true,
    })
    await finish(f)
  })

  it('keeps a playing song at its measured level when an edit makes the measurement stale', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    f.transport.setMasterGain({
      projectId: f.project.id,
      revision: f.project.revision,
      gainDb: 4.5,
      safetyGainDb: -1.5,
    })
    await f.transport.play(f.project, [f.asset], 0)
    f.graph.setMasterSpec.mockClear()
    const [track] = f.project.tracks
    await f.transport.setSnapshot(
      { ...f.project, revision: 1, tracks: [{ ...track, gainDb: -3 }] },
      [f.asset],
    )
    expect(f.transport.getState().masterReady).toBe(false)
    expect(f.graph.setMasterSpec).not.toHaveBeenCalled()
    expect(f.buildGraph).toHaveBeenCalledOnce()
    await finish(f)
  })

  it("starts the run that takes over at the held run's measured master gain, until a new measurement comes", async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    const measured = { gainDb: 4.5, safetyGainDb: -1.5 }
    f.transport.setMasterGain({
      projectId: f.project.id,
      revision: f.project.revision,
      ...measured,
    })
    await f.transport.play(f.project, [f.asset], 0)
    // A moved clip needs a new graph, and makes the measurement stale.
    const moved = {
      ...f.project,
      revision: 1,
      clips: [{ ...f.project.clips[0], startFrame: 960 }],
    }
    f.ctx.currentTime = 1
    await f.transport.setSnapshot(moved, [f.asset])
    expect(graphs).toHaveLength(2)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      masterReady: false,
    })
    const master = (call: number) =>
      (f.buildGraph.mock.calls[call][4] as { master: { spec: unknown } }).master
        .spec
    // Not the unmeasured 0 dB, which would jump the level at the handover.
    expect(master(1)).toEqual(resolveStudioSoundGraph(moved, measured).full)
    expect(master(1)).toEqual(master(0))

    const fresh = { gainDb: 2, safetyGainDb: -0.5 }
    f.transport.setMasterGain({
      projectId: moved.id,
      revision: moved.revision,
      ...fresh,
    })
    expect(graphs[1].setMasterSpec).toHaveBeenCalledExactlyOnceWith(
      resolveStudioSoundGraph(moved, fresh).full,
    )
    await finish(f)
  })

  it('starts Play after an edit at the last measured master gain, not the 0 dB preview, until another song opens', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    freshGraphs(f)
    const measured = { gainDb: 4.5, safetyGainDb: -1.5 }
    f.transport.setMasterGain({
      projectId: f.project.id,
      revision: f.project.revision,
      ...measured,
    })
    await f.transport.play(f.project, [f.asset], 0)
    const [track] = f.project.tracks
    const edited = {
      ...f.project,
      revision: 1,
      tracks: [{ ...track, gainDb: -3 }],
    }
    await f.transport.setSnapshot(edited, [f.asset])
    expect(f.transport.getState().masterReady).toBe(false)

    f.transport.pause()
    await f.transport.play(edited, [f.asset], 4800)
    const master = (call: number) =>
      (f.buildGraph.mock.calls[call][4] as { master: { spec: unknown } }).master
        .spec
    expect(master(1)).toEqual(resolveStudioSoundGraph(edited, measured).full)
    expect(f.transport.getState().masterReady).toBe(false)

    // Another song opening forgets it.
    f.transport.setMasterGain(null)
    f.transport.pause()
    await f.transport.play(edited, [f.asset], 0)
    expect(master(2)).toEqual(resolveStudioSoundGraph(edited).full)
    await finish(f)
  })

  it('starts a seek that must build a run, with nothing heard yet, at the last measured master gain', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    freshGraphs(f)
    const measured = { gainDb: 4.5, safetyGainDb: -1.5 }
    f.transport.setMasterGain({
      projectId: f.project.id,
      revision: f.project.revision,
      ...measured,
    })
    await f.transport.play(f.project, [f.asset], 0)
    const edited = { ...f.project, revision: 1 }
    await f.transport.setSnapshot(edited, [f.asset])
    f.transport.pause()
    // Play is still reading audio when the seek comes.
    let settle!: (value: StudioBufferLease) => void
    vi.mocked(f.cache.acquire).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve
        }),
    )
    const playing = f.transport.play(edited, [f.asset], 0)
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledTimes(2))
    const seeking = f.transport.seek(4800, edited, [f.asset])
    settle({ buffers: new Map(), release: f.release })
    await Promise.all([playing, seeking])

    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    const [, , , , options] = f.buildGraph.mock.calls[1]
    expect(options.fromFrame).toBe(4800)
    expect(options.master.spec).toEqual(
      resolveStudioSoundGraph(edited, measured).full,
    )
    await finish(f)
  })

  it("publishes each lane's peak after its fader and its gain reduction on the meter tick, and none once paused", async () => {
    vi.useFakeTimers()
    const read = vi.fn(() => new Map([['track-1', 0.5]]))
    const dispose = vi.fn()
    const createLaneMeter = vi.fn(() => ({
      read,
      restart: vi.fn(),
      dispose,
      measurement: 7,
    }))
    const f = transportFixture({ createLaneMeter })
    const outputs = new Map([
      ['track-1', f.ctx.createGain() as unknown as AudioNode],
    ])
    f.graph.laneOutputs.mockReturnValue(outputs)
    f.graph.readLaneReduction.mockReturnValue(-3.5)
    await f.transport.play(f.project, [f.asset], 0)
    // One meter per run, tapping every lane, counting from when it is heard.
    expect(createLaneMeter).toHaveBeenCalledExactlyOnceWith(
      f.ctx.liveContext,
      outputs,
      expect.closeTo(0.26, 9),
    )
    expect(f.transport.getState().lanes).toEqual([])

    f.ctx.currentTime = 0.5
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().lanes).toEqual([
      { trackId: 'track-1', peak: 0.5, reductionDb: -3.5, measurement: 7 },
    ])
    expect(f.graph.readLaneReduction).toHaveBeenCalledWith('track-1')

    f.transport.pause()
    expect(f.transport.getState().lanes).toEqual([])
    await vi.advanceTimersByTimeAsync(240)
    expect(dispose).toHaveBeenCalledOnce()
    await finish(f)
  })

  it('keeps the last levels on a tick that brings no new reading, so the meters do not flicker to the floor', async () => {
    vi.useFakeTimers()
    const read = vi.fn<() => ReadonlyMap<string, number> | null>(
      () => new Map([['track-1', 0.5]]),
    )
    const createLaneMeter = vi.fn(() => ({
      read,
      restart: vi.fn(),
      dispose: vi.fn(),
      measurement: 7,
    }))
    const f = transportFixture({ createLaneMeter })
    f.graph.laneOutputs.mockReturnValue(
      new Map([['track-1', f.ctx.createGain() as unknown as AudioNode]]),
    )
    f.graph.readLaneReduction.mockReturnValue(null)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 0.5
    await vi.advanceTimersByTimeAsync(33)
    const heard = [
      { trackId: 'track-1', peak: 0.5, reductionDb: null, measurement: 7 },
    ]
    expect(f.transport.getState().lanes).toEqual(heard)

    // The audio thread sends about as often as the tick reads, so a tick
    // can come with nothing new; a run just taken over has not sent yet.
    read.mockReturnValueOnce(null)
    await vi.advanceTimersByTimeAsync(33)
    expect(read).toHaveBeenCalledTimes(2)
    expect(f.transport.getState().lanes).toEqual(heard)
    read.mockReturnValueOnce(new Map([['track-1', 0.25]]))
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().lanes).toEqual([
      { trackId: 'track-1', peak: 0.25, reductionDb: null, measurement: 7 },
    ])
    await finish(f)
  })
})
