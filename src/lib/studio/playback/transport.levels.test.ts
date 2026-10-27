// Studio transport level tests — a newly measured master gain and each lane's meter reach the song playing.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { studioReservedMemoryBytes } from '../memory-budget'
import { transportFixture } from './transport.test-fixtures'

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

  it("publishes each lane's peak after its fader and its gain reduction on the meter tick, and none once paused", async () => {
    vi.useFakeTimers()
    const read = vi.fn(() => new Map([['track-1', 0.5]]))
    const dispose = vi.fn()
    const createLaneMeter = vi.fn(() => ({ read, dispose }))
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
      { trackId: 'track-1', peak: 0.5, reductionDb: -3.5 },
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
    const createLaneMeter = vi.fn(() => ({ read, dispose: vi.fn() }))
    const f = transportFixture({ createLaneMeter })
    f.graph.laneOutputs.mockReturnValue(
      new Map([['track-1', f.ctx.createGain() as unknown as AudioNode]]),
    )
    f.graph.readLaneReduction.mockReturnValue(null)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 0.5
    await vi.advanceTimersByTimeAsync(33)
    const heard = [{ trackId: 'track-1', peak: 0.5, reductionDb: null }]
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
      { trackId: 'track-1', peak: 0.25, reductionDb: null },
    ])
    await finish(f)
  })
})
