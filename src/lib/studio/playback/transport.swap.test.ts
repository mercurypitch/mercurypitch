// Studio transport swap tests — a new effect list crosses only its lane to a new chain on the running graph, its latency measured first.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '../memory-budget'
import { studioLaneSpec } from '../model/arrangement-plan'
import { applyStudioCommand } from '../model/commands'
import type { StudioAsset, StudioProject } from '../model/types'
import type { StudioChainSwap } from './graph'
import { studioChainWorkingBytes } from './graph'
import { freshGraphs, LEAD, transportFixture } from './transport.test-fixtures'

type Fixture = ReturnType<typeof transportFixture>
type Graph = ReturnType<typeof freshGraphs>[number]

afterEach(() => {
  setStudioWorkingBytes(null)
  vi.useRealTimers()
})

/** The song with its lane given another role: another effect list and balance. */
function withRole(project: StudioProject, asset: StudioAsset): StudioProject {
  const [track] = project.tracks
  return applyStudioCommand(
    project,
    { type: 'set-track-role', trackId: track.id, role: 'voice' },
    { assets: [asset] },
  )
}

/** The song with its lane's volume changed: a mix edit. */
function withVolume(project: StudioProject, gainDb: number): StudioProject {
  const [track] = project.tracks
  return {
    ...project,
    revision: project.revision + 1,
    tracks: [{ ...track, gainDb }],
  }
}

/** A graph that swaps chains as the real one does, and frees each new chain's memory when it goes. */
function swaps(graph: Graph): void {
  const releases: (() => void)[] = []
  graph.swapChains.mockImplementation(
    (chains: readonly StudioChainSwap[], earliest: number) => {
      for (const { release } of chains) releases.push(release)
      return earliest + 0.3
    },
  )
  graph.dispose.mockImplementation(() => {
    for (const release of releases) release()
  })
}

async function finish(f: Fixture): Promise<void> {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  expect(studioReservedMemoryBytes()).toBe(0)
}

describe('Studio transport swap', () => {
  it('crosses the lane to a chain of its new role on the running graph, its latency measured first, and builds no run', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    swaps(graphs[0])
    const one = studioReservedMemoryBytes()
    f.ctx.currentTime = 1
    const voice = withRole(f.project, f.asset)
    const spec = studioLaneSpec(voice.tracks[0], voice.mix.macros)
    await f.transport.setSnapshot(voice, [f.asset])

    expect(graphs).toHaveLength(1)
    expect(f.measureLatencies).toHaveBeenLastCalledWith([spec], 44100)
    expect(graphs[0].swapChains).toHaveBeenCalledOnce()
    const [[swap], earliest] = graphs[0].swapChains.mock.calls[0]
    // The fixture measures every chain at 441 frames: 10 ms at 44.1 kHz.
    expect(swap).toMatchObject({ trackId: 'track-1', spec, latency: 0.01 })
    // A device callback (10 ms) and 5 ms of scheduling ahead of the clock,
    // on a whole frame.
    expect(earliest).toBeCloseTo(1 + LEAD, 9)
    expect(graphs[0].scheduleUntil).toHaveBeenLastCalledWith(3)
    // The new chain holds memory of its own beside the run's.
    expect(studioReservedMemoryBytes()).toBe(
      one + studioChainWorkingBytes(spec, 44100),
    )
    // The lane is given the new role's balance; the graph holds the old one
    // until the new chain is heard.
    expect(graphs[0].setLaneMix).toHaveBeenLastCalledWith(
      expect.objectContaining({
        balanceGainDb: voice.tracks[0].balanceGainDb,
      }),
      true,
    )
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      pending: false,
    })
    // The run plays the new song: a mix edit goes in place, with nothing to
    // measure or swap.
    const calls = f.measureLatencies.mock.calls.length
    await f.transport.setSnapshot(withVolume(voice, -3), [f.asset])
    expect(graphs[0].swapChains).toHaveBeenCalledOnce()
    expect(f.measureLatencies.mock.calls).toHaveLength(calls)
    expect(graphs[0].setLaneMix).toHaveBeenLastCalledWith(
      expect.objectContaining({ gainDb: -3 }),
      true,
    )
    await finish(f)
  })

  it('leaves the old chain as it was while the new one is measured, and a newer edit meanwhile wins', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    swaps(graphs[0])
    let measured!: (frames: number[]) => void
    f.measureLatencies.mockImplementationOnce(
      () =>
        new Promise<number[]>((resolve) => {
          measured = resolve
        }),
    )
    f.ctx.currentTime = 1
    const voice = withRole(f.project, f.asset)
    graphs[0].setLaneMix.mockClear()
    const editing = f.transport.setSnapshot(voice, [f.asset])
    await vi.advanceTimersByTimeAsync(0)
    expect(graphs[0].swapChains).not.toHaveBeenCalled()
    expect(graphs[0].setLaneMix).not.toHaveBeenCalled()

    const louder = withVolume(voice, 2)
    const moving = f.transport.setSnapshot(louder, [f.asset])
    measured([441])
    await Promise.all([editing, moving])
    expect(graphs).toHaveLength(1)
    expect(graphs[0].swapChains).toHaveBeenCalledOnce()
    expect(graphs[0].setLaneMix).toHaveBeenLastCalledWith(
      expect.objectContaining({ gainDb: 2 }),
      true,
    )
    await finish(f)
  })

  it('hands over to a new run when the graph cannot swap the chain, and frees what it reserved for it', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    await f.transport.setSnapshot(withRole(f.project, f.asset), [f.asset])
    expect(graphs[0].swapChains).toHaveBeenCalledOnce()
    expect(graphs).toHaveLength(2)
    await finish(f)
  })

  it('hands over to a new run when the clips change along with the effect list', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    swaps(graphs[0])
    f.ctx.currentTime = 1
    const voice = withRole(f.project, f.asset)
    const both = {
      ...voice,
      clips: [{ ...voice.clips[0], gainDb: voice.clips[0].gainDb - 6 }],
    }
    await f.transport.setSnapshot(both, [f.asset])
    expect(graphs[0].swapChains).not.toHaveBeenCalled()
    expect(graphs[0].replan).not.toHaveBeenCalled()
    expect(graphs).toHaveLength(2)
    await finish(f)
  })

  it('hands over to a new run when memory cannot hold the new chain beside the old one', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    swaps(graphs[0])
    const voice = withRole(f.project, f.asset)
    const chain = studioChainWorkingBytes(
      studioLaneSpec(voice.tracks[0], voice.mix.macros),
      44100,
    )
    setStudioWorkingBytes(studioReservedMemoryBytes() + chain - 1)
    f.ctx.currentTime = 1
    const editing = f.transport.setSnapshot(voice, [f.asset])
    // Nor do two runs fit: the song fades out, and the new run starts once
    // the old one is free.
    await vi.advanceTimersByTimeAsync(240)
    await editing
    expect(graphs[0].swapChains).not.toHaveBeenCalled()
    expect(graphs).toHaveLength(2)
    expect(f.transport.getState()).toMatchObject({ playing: true })
    await finish(f)
  })

  it('hands over to a new run when the new effect list cannot be measured, and that run measures it again', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    swaps(graphs[0])
    f.ctx.currentTime = 1
    const calls = f.measureLatencies.mock.calls.length
    f.measureLatencies.mockRejectedValueOnce(new Error('No latency.'))
    await f.transport.setSnapshot(withRole(f.project, f.asset), [f.asset])
    expect(graphs[0].swapChains).not.toHaveBeenCalled()
    expect(f.measureLatencies.mock.calls).toHaveLength(calls + 2)
    expect(graphs).toHaveLength(2)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      error: null,
    })
    await finish(f)
  })

  it('hands a seek to a new run while a lane is still crossing to its new chain', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    swaps(graphs[0])
    f.ctx.currentTime = 1
    const voice = withRole(f.project, f.asset)
    await f.transport.setSnapshot(voice, [f.asset])
    graphs[0].swapping.mockReturnValue(true)
    await f.transport.seek(24000, voice, [f.asset])
    expect(graphs[0].seek).not.toHaveBeenCalled()
    expect(graphs).toHaveLength(2)
    await finish(f)
  })

  it('lets a graph Pause kept go for a new effect list, which a parked graph could not settle, and Play builds afresh', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    swaps(graphs[0])
    f.ctx.currentTime = 1
    await vi.advanceTimersByTimeAsync(33)
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    const voice = withRole(f.project, f.asset)
    await f.transport.setSnapshot(voice, [f.asset])
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    expect(graphs[0].swapChains).not.toHaveBeenCalled()
    f.ctx.currentTime = 3
    expect(await f.transport.play(voice, [f.asset])).toBe(true)
    expect(graphs).toHaveLength(2)
    await finish(f)
  })
})
