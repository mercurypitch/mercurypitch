// Studio transport with nothing heard — a song whose every lane is muted, or whose Solo leaves nothing audible, plays its clock silently to its end, as REAPER does; an empty song still refuses.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '../memory-budget'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { createStudioTrack } from '../model/defaults'
import { FIRST_HEARD, transportFixture, withQuietLane, } from './transport.test-fixtures'

afterEach(() => vi.useRealTimers())

type Fixture = ReturnType<typeof transportFixture>

async function finish(f: Fixture): Promise<void> {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  expect(studioReservedMemoryBytes()).toBe(0)
}

describe('Studio transport with nothing heard', () => {
  it('plays a song whose every lane is muted: the playhead moves and the run ends at the song’s end, with no error', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const project = {
      ...f.project,
      tracks: f.project.tracks.map((track) => ({ ...track, mute: true })),
    }

    expect(await f.transport.play(project, [f.asset], 0)).toBe(true)
    f.ctx.currentTime = FIRST_HEARD + 1
    await vi.advanceTimersByTimeAsync(33)
    const moving = f.transport.getState()
    f.ctx.currentTime = 30
    await vi.advanceTimersByTimeAsync(33)

    expect(moving).toMatchObject({ playing: true, error: null })
    expect(moving.playheadFrame).toBe(48000)
    const plan = f.buildGraph.mock.calls[0][1] as StudioArrangementPlan
    // The muted take still sets where the song ends.
    expect(plan.endFrame).toBe(96100)
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      playheadFrame: 96100,
      error: null,
    })
    await finish(f)
  })

  it('plays silently when Solo is on a lane with no clips, and leaves every take out of earshot', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const soloed = createStudioTrack({
      id: 'track-2',
      name: 'Empty',
      order: 1,
      role: 'other',
    })
    const project = {
      ...f.project,
      tracks: [...f.project.tracks, { ...soloed, solo: true }],
    }

    expect(await f.transport.play(project, [f.asset], 0)).toBe(true)

    expect(f.transport.getState()).toMatchObject({ playing: true, error: null })
    const plan = f.buildGraph.mock.calls[0][1] as StudioArrangementPlan
    expect(
      plan.lanes.filter((lane) => lane.audible && lane.segments.length > 0),
    ).toHaveLength(0)
    await finish(f)
  })

  it('brings in a lane unmuted during a silent run without a restart', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const quiet = withQuietLane(f)
    const project = {
      ...quiet,
      tracks: quiet.tracks.map((track) => ({ ...track, mute: true })),
    }
    const quietAsset = { ...f.asset, id: 'quiet-asset' }
    await f.transport.play(project, [f.asset, quietAsset], 0)
    expect(f.buildGraph.mock.calls[0][4]).toMatchObject({ silentLanes: true })

    const unmuted = {
      ...project,
      revision: 1,
      tracks: [{ ...project.tracks[0], mute: false }, project.tracks[1]],
    }
    await f.transport.setSnapshot(unmuted, [f.asset, quietAsset])

    expect(f.graph.setLaneMix).toHaveBeenCalledWith(unmuted.tracks[0], true)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.transport.getState().playing).toBe(true)
    await finish(f)
  })

  it('loops a muted song with Repeat on, as it loops one heard', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const project = {
      ...f.project,
      tracks: f.project.tracks.map((track) => ({ ...track, mute: true })),
    }
    f.transport.setRepeat(true)

    expect(await f.transport.play(project, [f.asset], 0)).toBe(true)
    f.ctx.currentTime = FIRST_HEARD + 3
    await vi.advanceTimersByTimeAsync(33)

    expect(f.buildGraph.mock.calls[0][4]).toMatchObject({ repeat: true })
    // Past the song's end (96100 frames, about 2 s), still playing.
    expect(f.transport.getState()).toMatchObject({ playing: true, error: null })
    await finish(f)
  })

  it('still refuses a song with no clips at all, asking for a take or some notes', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const project = { ...f.project, clips: [] }

    expect(await f.transport.play(project, [])).toBe(false)

    expect(f.transport.getState()).toMatchObject({
      playing: false,
      error: 'Add a take or draw some notes before playing.',
    })
    expect(f.buildGraph).not.toHaveBeenCalled()
    await finish(f)
  })
})
