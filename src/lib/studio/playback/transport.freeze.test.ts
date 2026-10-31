// Studio transport with lanes rendered ahead — a run plays the renders it holds; an edit or a dial that changes a frozen lane brings it in live.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '../memory-budget'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import { encodeFrozenLane, laneFreezeKey, laneFreezeKeys } from './lane-freeze'
import type { StudioFreezeLookup } from './lane-freezer'
import { freshGraphs, transportFixture } from './transport.test-fixtures'

afterEach(() => vi.useRealTimers())

/** A freezer holding a render of the fixture's lane, as the song first stands. */
function freezerFor(project: StudioProject, asset: StudioAsset) {
  const [lane] = compileStudioArrangement(project, [asset]).lanes
  const audio = Float32Array.from({ length: 9600 }, () => 0.25)
  const frozen = encodeFrozenLane(
    {
      trackId: lane.track.id,
      key: laneFreezeKey(lane),
      spec: JSON.stringify(lane.spec),
    },
    [audio, audio],
    lane.segments[0].startFrame,
  )
  const release = vi.fn()
  const hold = vi.fn((song: StudioProject, assets: readonly StudioAsset[]) =>
    laneFreezeKeys(song, assets).get(lane.track.id) === frozen.key
      ? { lanes: new Map([[lane.track.id, frozen]]), release }
      : null,
  )
  const lookup: StudioFreezeLookup = { hold, differs: () => false }
  return { lookup, hold, release, frozen }
}

function laneOf(plan: unknown) {
  return (plan as StudioArrangementPlan).lanes[0]
}

describe('Studio transport with frozen lanes', () => {
  it('plays a held render through no chain, with no latency of its own, and lets it go with its audio', async () => {
    vi.useFakeTimers()
    const base = transportFixture({}, 48000)
    const freeze = freezerFor(base.project, base.asset)
    const f = transportFixture({ freezes: freeze.lookup }, 48000)
    await f.transport.play(f.project, [f.asset], 0)

    expect(f.buildGraph).toHaveBeenCalledOnce()
    const lane = laneOf(f.buildGraph.mock.calls[0][1])
    expect(lane.frozen).toBe(true)
    expect(lane.spec.effects).toEqual([])
    expect(lane.chainLatencySeconds).toBe(0)
    expect(lane.segments.map((segment) => segment.assetId)).toEqual(
      freeze.frozen.chunks.map((chunk) => chunk.id),
    )
    // The frozen lane's chain was never measured: it has none.
    expect(f.measureLatencies).toHaveBeenCalledTimes(1)
    // The run's audio serves the chunks the scheduler will ask for.
    const buffers = f.buildGraph.mock.calls[0][2] as ReadonlyMap<
      string,
      unknown
    >
    expect(buffers.has(freeze.frozen.chunks[0].id)).toBe(true)

    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    expect(freeze.release).toHaveBeenCalled()
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('builds a new run with the lane live when its clip changes while it plays', async () => {
    vi.useFakeTimers()
    const base = transportFixture({}, 48000)
    const freeze = freezerFor(base.project, base.asset)
    const f = transportFixture({ freezes: freeze.lookup }, 48000)
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    // Even a graph that could move its lanes cannot move a frozen one.
    graphs[0].replan.mockImplementation((_plan, earliest) => ({
      at: earliest,
      fromFrame: 0,
      epoch: 0.06,
    }))
    f.ctx.currentTime = 0.5
    const trimmed = {
      ...f.project,
      revision: f.project.revision + 1,
      clips: [{ ...f.project.clips[0], sourceOutFrame: 48000 }],
    }
    await f.transport.setSnapshot(trimmed, [f.asset])

    expect(graphs[0].replan).not.toHaveBeenCalled()
    expect(graphs).toHaveLength(2)
    const lane = laneOf(f.buildGraph.mock.calls[1][1])
    expect(lane.frozen).toBeUndefined()
    expect(lane.spec.effects.length).toBeGreaterThan(0)
    f.transport.dispose()
  })

  it('brings a frozen lane in live when a macro dial changes its sound', async () => {
    vi.useFakeTimers()
    const base = transportFixture({}, 48000)
    const freeze = freezerFor(base.project, base.asset)
    const f = transportFixture({ freezes: freeze.lookup }, 48000)
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    await f.transport.setSnapshot(f.project, [f.asset])
    expect(graphs).toHaveLength(1)

    f.ctx.currentTime = 0.5
    f.transport.previewMacro('space', 0.9)
    await vi.waitFor(() => expect(graphs).toHaveLength(2))
    // The run built for the dial plays the lane live, under the dial's sound.
    expect(laneOf(f.buildGraph.mock.calls[1][1]).frozen).toBeUndefined()
    expect(freeze.hold).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mix: expect.objectContaining({
          macros: expect.objectContaining({ space: 0.9 }),
        }),
      }),
      [f.asset],
    )
    f.transport.dispose()
  })
})
