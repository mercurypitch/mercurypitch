// Studio transport re-plan tests — a clip edit moves the running or kept graph's lanes instead of building a new run.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '../memory-budget'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioProject } from '../model/types'
import { RUN_SETTLE_SECONDS } from './run'
import { crossfadeRamps, envelopeOf, FIRST_HEARD, freshGraphs, LEAD, transportFixture, } from './transport.test-fixtures'

// The fixture's first run: its sources start at GRAPH_EPOCH, and frame 0
// is heard at FIRST_HEARD, after 20 ms of lane and master latency.
const GRAPH_EPOCH = RUN_SETTLE_SECONDS

type Fixture = ReturnType<typeof transportFixture>

afterEach(() => {
  setStudioWorkingBytes(null)
  vi.useRealTimers()
})

/** The song with its clip changed by `edit`. */
function editedClip(
  project: StudioProject,
  edit: Partial<StudioProject['clips'][number]>,
): StudioProject {
  return {
    ...project,
    revision: project.revision + 1,
    clips: [{ ...project.clips[0], ...edit }],
  }
}

/**
 * A graph that moves its lanes as the real one does and keeps `anchor`,
 * frame 0 entering at GRAPH_EPOCH unless a test says otherwise. Like the
 * real one, it refuses a plan with a lane heard now that it has no chain for.
 */
function replans(
  graph: ReturnType<typeof freshGraphs>[number],
  anchor = { fromFrame: 0, epoch: GRAPH_EPOCH },
) {
  graph.replan.mockImplementation(
    (plan: StudioArrangementPlan, earliest: number) =>
      plan.lanes.some(
        (lane) =>
          lane.audible &&
          lane.segments.length > 0 &&
          !graph.hasLane(lane.track.id),
      )
        ? null
        : { at: earliest, ...anchor },
  )
}

async function finish(f: Fixture): Promise<void> {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  expect(studioReservedMemoryBytes()).toBe(0)
}

describe('Studio transport re-plan', () => {
  it('moves the playing graph for a clip edit, builds no run, and ends the song where the new plan does', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    replans(graphs[0])
    f.ctx.currentTime = 1
    // Half the take: the song, from frame 100, now ends a second sooner.
    const shorter = editedClip(f.project, { sourceOutFrame: 48000 })
    await f.transport.setSnapshot(shorter, [f.asset])

    expect(graphs).toHaveLength(1)
    expect(graphs[0].replan).toHaveBeenCalledOnce()
    const [plan, earliest] = graphs[0].replan.mock.calls[0]
    // The whole song's plan, as the graph was built from: a device callback
    // (10 ms) and 5 ms of scheduling ahead of the clock, on a whole frame.
    expect(plan.startFrame).toBe(0)
    expect(plan.endFrame).toBe(48100)
    expect(earliest).toBeCloseTo(1 + LEAD, 9)
    expect(graphs[0].scheduleUntil).toHaveBeenLastCalledWith(3)
    expect(crossfadeRamps(envelopeOf(graphs[0]).gain)).toEqual([])
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      pending: false,
    })
    // The run plays the edited song now: a mix edit after it goes in place.
    const [track] = shorter.tracks
    await f.transport.setSnapshot(
      { ...shorter, tracks: [{ ...track, gainDb: -3 }] },
      [f.asset],
    )
    expect(graphs[0].replan).toHaveBeenCalledOnce()

    const { tailFrames } = compileStudioArrangement(shorter, [f.asset])
    const end = FIRST_HEARD + (48100 + tailFrames) / 48000
    f.ctx.currentTime = end - 0.01
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playing).toBe(true)
    f.ctx.currentTime = end + 0.01
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      playheadFrame: 48100,
    })
    await finish(f)
  })

  it('counts the song from the pass the graph counts from, so Repeat off ends the pass playing', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    f.transport.setRepeat(true)
    await f.transport.play(f.project, [f.asset], 0)
    // 2.5 s in, pass 1 plays: a re-plan counts passes again from its start.
    const loop = 96100 / 48000
    replans(graphs[0], { fromFrame: 0, epoch: GRAPH_EPOCH + loop })
    for (const now of [1, 2, 2.5]) {
      f.ctx.currentTime = now
      await vi.advanceTimersByTimeAsync(33)
    }
    await f.transport.setSnapshot(editedClip(f.project, { gainDb: -12 }), [
      f.asset,
    ])
    expect(graphs[0].replan).toHaveBeenCalledOnce()
    graphs[0].stopRepeating.mockReturnValue(0)
    f.transport.setRepeat(false)
    const { tailFrames } = compileStudioArrangement(f.project, [f.asset])
    const end = FIRST_HEARD + loop + (96100 + tailFrames) / 48000
    f.ctx.currentTime = end - 0.01
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playing).toBe(true)
    f.ctx.currentTime = end + 0.01
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playing).toBe(false)
    expect(graphs).toHaveLength(1)
    await finish(f)
  })

  it('hands over to a new run when a muted lane that got clips while playing comes in', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    const [track] = f.project.tracks
    const [clip] = f.project.clips
    const quiet = { ...track, id: 'quiet', order: 1, mute: true }
    const song = { ...f.project, tracks: [track, quiet] }
    await f.transport.play(song, [f.asset], 0)
    replans(graphs[0])
    f.ctx.currentTime = 1
    const withClip = {
      ...song,
      revision: 1,
      clips: [clip, { ...clip, id: 'quiet-clip', trackId: 'quiet' }],
    }
    await f.transport.setSnapshot(withClip, [f.asset])
    expect(graphs).toHaveLength(1)
    // The graph has no chain for it: bringing it in needs a run that has.
    await f.transport.setSnapshot(
      { ...withClip, revision: 2, tracks: [track, { ...quiet, mute: false }] },
      [f.asset],
    )
    expect(graphs).toHaveLength(2)
    await finish(f)
  })

  it('asks no re-plan of a mix edit, which the graph follows in place', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    const [track] = f.project.tracks
    const quieter = { ...f.project, tracks: [{ ...track, gainDb: -6 }] }
    await f.transport.setSnapshot(quieter, [f.asset])
    expect(f.graph.replan).not.toHaveBeenCalled()
    expect(f.graph.setLaneMix).toHaveBeenLastCalledWith(quieter.tracks[0], true)
    await finish(f)
  })

  it('hands over to a new run when the graph cannot move its lanes', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    await f.transport.setSnapshot(editedClip(f.project, { startFrame: 960 }), [
      f.asset,
    ])
    expect(graphs[0].replan).toHaveBeenCalledOnce()
    expect(graphs).toHaveLength(2)
    await finish(f)
  })

  it('builds a new run for another effect list on a lane it built, without asking for a re-plan', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    replans(graphs[0])
    f.ctx.currentTime = 1
    const [track] = f.project.tracks
    const edited = editedClip(f.project, { gainDb: -12 })
    const fewer = {
      ...edited,
      tracks: [
        {
          ...track,
          fx: {
            ...track.fx,
            baseSpec: {
              ...track.fx.baseSpec,
              effects: track.fx.baseSpec.effects.slice(1),
            },
          },
        },
      ],
    }
    await f.transport.setSnapshot(fewer, [f.asset])
    expect(graphs[0].replan).not.toHaveBeenCalled()
    expect(graphs).toHaveLength(2)
    await finish(f)
  })

  it('moves the kept graph for a clip edit while paused, and Play starts it without a build', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    await vi.advanceTimersByTimeAsync(33)
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    expect(graphs[0].park).toHaveBeenCalledOnce()
    replans(graphs[0])

    const moved = editedClip(f.project, { startFrame: 960 })
    await f.transport.setSnapshot(moved, [f.asset])
    expect(graphs[0].replan).toHaveBeenCalledOnce()
    expect(graphs[0].dispose).not.toHaveBeenCalled()
    expect(
      graphs[0].replan.mock.calls[0][0].lanes[0].segments[0],
    ).toMatchObject({ startFrame: 960 })

    f.ctx.currentTime = 3
    expect(await f.transport.play(moved, [f.asset])).toBe(true)
    expect(graphs).toHaveLength(1)
    expect(graphs[0].resume).toHaveBeenCalledOnce()
    await finish(f)
  })

  it('moves the kept graph when Play brings an edit it has not followed yet', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    await vi.advanceTimersByTimeAsync(33)
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    replans(graphs[0])
    f.ctx.currentTime = 3
    const moved = editedClip(f.project, { startFrame: 960 })
    expect(await f.transport.play(moved, [f.asset])).toBe(true)
    expect(graphs[0].replan).toHaveBeenCalledOnce()
    expect(graphs).toHaveLength(1)
    await finish(f)
  })
})
