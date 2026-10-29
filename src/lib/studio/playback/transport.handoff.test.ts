// Studio transport handoff tests — an edit the running graph cannot follow keeps the song playing while the next run takes over.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '../memory-budget'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { applyStudioCommand } from '../model/commands'
import type { StudioProject } from '../model/types'
import type { StudioBufferLease } from './buffer-cache'
import { crossfadeRamps, envelopeOf, freshGraphs, openingEnds, transportFixture, } from './transport.test-fixtures'

// The fixture's first run: frame 0 is heard at 0.26 s, after 0.24 s of
// warmup and 20 ms of lane and master latency, and fully open at 0.35 s.
const FIRST_HEARD = 0.26
const LATENCY = 0.02

/** The song with its clip moved: an edit only a new graph can play. */
function movedClip(
  project: StudioProject,
  startFrame: number,
  revision: number,
): StudioProject {
  return {
    ...project,
    revision,
    clips: [{ ...project.clips[0], startFrame }],
  }
}

const faded = (envelope: ReturnType<typeof envelopeOf>) =>
  envelope.gain.events.some((event) => event.kind === 'target')

afterEach(() => {
  setStudioWorkingBytes(null)
  vi.useRealTimers()
})

describe('Studio transport handoff', () => {
  it('keeps the song playing through a clip edit and hands over on the same frame with a 30 ms crossfade', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    await f.transport.setSnapshot(movedClip(f.project, 960, 1), [f.asset])

    expect(graphs).toHaveLength(2)
    const [first, next] = graphs.map(envelopeOf)
    const [start] = next.gain.events
    const at = start.time
    expect(start).toMatchObject({ kind: 'set', value: 0 })
    expect(at).toBeGreaterThan(1)
    expect(faded(first)).toBe(false)
    expect(crossfadeRamps(first.gain)).toEqual([{ value: 0, time: at + 0.03 }])
    expect(next.gain.linearRamps).toEqual([{ value: 1, time: at + 0.03 }])
    // The new run starts on the frame the playing run reaches at `at`.
    const [, , , epoch, options] = f.buildGraph.mock.calls[1]
    expect(options.fromFrame).toBe(Math.round((at - FIRST_HEARD) * 48000))
    expect(at - epoch).toBeCloseTo(LATENCY, 9)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      pending: false,
    })

    // The playing run is freed once its crossfade has run out.
    expect(graphs[0].dispose).not.toHaveBeenCalled()
    f.ctx.currentTime = at + 0.03
    await vi.advanceTimersByTimeAsync((at + 0.03 - 1) * 1000 + 60)
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    expect(graphs[1].dispose).not.toHaveBeenCalled()
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('replaces a run not heard yet when edits come fast, so only one run is built beside the one playing', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    for (const [index, startFrame] of [960, 1920, 2880].entries()) {
      await f.transport.setSnapshot(
        movedClip(f.project, startFrame, index + 1),
        [f.asset],
      )
      const live = graphs.filter((graph) => !graph.dispose.mock.calls.length)
      expect(live).toEqual([graphs[0], graphs.at(-1)])
    }

    expect(graphs).toHaveLength(4)
    const plan = f.buildGraph.mock.calls[3][1] as StudioArrangementPlan
    expect(plan.lanes[0].segments[0].startFrame).toBe(2880)
    // The playing run never faded: the first two handovers were taken back.
    const first = envelopeOf(graphs[0])
    expect(faded(first)).toBe(false)
    expect(
      first.gain.events.filter((event) => event.kind === 'cancel'),
    ).toHaveLength(2)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('lets a handover that begins within 50 ms happen, and takes over from the new run', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    await f.transport.setSnapshot(movedClip(f.project, 960, 1), [f.asset])
    const [, second] = graphs.map(envelopeOf)
    const at = second.gain.events[0].time
    f.ctx.currentTime = at - 0.02
    await f.transport.setSnapshot(movedClip(f.project, 1920, 2), [f.asset])

    expect(graphs).toHaveLength(3)
    expect(graphs[1].dispose).not.toHaveBeenCalled()
    const third = envelopeOf(graphs[2])
    // The next handover waits for the one under way to finish.
    expect(third.gain.events[0].time).toBeGreaterThanOrEqual(at + 0.03)
    expect(second.gain.linearRamps.at(-1)).toEqual({
      value: 0,
      time: third.gain.events[0].time + 0.03,
    })
    f.transport.dispose()
    await vi.advanceTimersByTimeAsync(240)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('fades out and restarts where it was when memory cannot hold the playing run and the next one', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    const one = studioReservedMemoryBytes()
    setStudioWorkingBytes(one + Math.floor(one / 2))
    f.ctx.currentTime = 1
    const editing = f.transport.setSnapshot(movedClip(f.project, 960, 1), [
      f.asset,
    ])
    await vi.advanceTimersByTimeAsync(239)
    expect(graphs).toHaveLength(1)
    expect(faded(envelopeOf(graphs[0]))).toBe(true)
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      pending: true,
    })
    await vi.advanceTimersByTimeAsync(1)
    await editing

    expect(graphs).toHaveLength(2)
    const { fromFrame } = f.buildGraph.mock.calls[1][4]
    expect(Math.abs(fromFrame - (1 - FIRST_HEARD) * 48000)).toBeLessThan(1)
    const restarted = envelopeOf(graphs[1])
    // Opened from silence, with no crossfade beside it.
    expect(openingEnds(restarted.gain)).toHaveLength(1)
    expect(restarted.gain.linearRamps).toHaveLength(64)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      pending: false,
      error: null,
    })
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('plays out a song that ends before the next run could take over', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    // The song's last frame, 96100, is heard at about 2.26 s, and a run
    // built now could start no sooner than 2.32 s.
    f.ctx.currentTime = 2.2
    await f.transport.setSnapshot(movedClip(f.project, 0, 1), [f.asset])
    expect(graphs).toHaveLength(1)
    expect(faded(envelopeOf(graphs[0]))).toBe(false)
    expect(f.transport.getState().playing).toBe(true)
    f.transport.dispose()
    await vi.advanceTimersByTimeAsync(240)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  const stops: [string, (f: ReturnType<typeof transportFixture>) => unknown][] =
    [
      ['Pause', (f) => f.transport.pause()],
      ['Stop', (f) => f.transport.stop()],
      ['releasing audio', (f) => f.transport.releaseAudio()],
      ['closing Studio', (f) => f.transport.dispose()],
    ]
  it.each(stops)(
    '%s fades out a run still playing while the next one prepares',
    async (_name, act) => {
      vi.useFakeTimers()
      const f = transportFixture()
      const graphs = freshGraphs(f)
      await f.transport.play(f.project, [f.asset], 0)
      let settle!: (value: StudioBufferLease) => void
      vi.mocked(f.cache.acquire).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settle = resolve
          }),
      )
      f.ctx.currentTime = 1
      const editing = f.transport.setSnapshot(movedClip(f.project, 960, 1), [
        f.asset,
      ])
      await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledTimes(2))
      const held = envelopeOf(graphs[0])
      expect(faded(held)).toBe(false)
      expect(f.transport.getState()).toMatchObject({
        playing: true,
        pending: false,
      })

      const acted = act(f)
      expect(faded(held)).toBe(true)
      settle({ buffers: new Map(), release: f.release })
      await vi.advanceTimersByTimeAsync(240)
      await Promise.all([editing, acted])
      expect(graphs[0].dispose).toHaveBeenCalledOnce()
      // The edit's run was never built: what was being prepared is dropped.
      expect(
        f.buildGraph.mock.calls.every(([, plan]) => {
          const [segment] = (plan as StudioArrangementPlan).lanes[0].segments
          return segment.startFrame !== 960
        }),
      ).toBe(true)
      f.transport.dispose()
      await vi.advanceTimersByTimeAsync(240)
      expect(studioReservedMemoryBytes()).toBe(0)
    },
  )

  it('keeps the playing run at the balance of its own sound while a new sound role is built, and moves its fader at once', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    let settle!: (value: StudioBufferLease) => void
    vi.mocked(f.cache.acquire).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve
        }),
    )
    const options = { assets: [f.asset] }
    const [guitar] = f.project.tracks
    const voice = applyStudioCommand(
      f.project,
      { type: 'set-track-role', trackId: guitar.id, role: 'voice' },
      options,
    )
    expect(voice.tracks[0].balanceGainDb).not.toBe(guitar.balanceGainDb)
    f.ctx.currentTime = 1
    graphs[0].setLaneMix.mockClear()
    const editing = f.transport.setSnapshot(voice, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledTimes(2))

    // The old chain plays on at the balance that goes with it: the new
    // role's balance comes in with the new chain, at the handover.
    expect(graphs[0].setLaneMix).toHaveBeenLastCalledWith(
      expect.objectContaining({ balanceGainDb: guitar.balanceGainDb }),
      true,
    )
    const quieter = applyStudioCommand(
      voice,
      { type: 'update-track', trackId: guitar.id, changes: { gainDb: -3 } },
      options,
    )
    const moving = f.transport.setSnapshot(quieter, [f.asset])
    expect(graphs[0].setLaneMix).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gainDb: -3,
        balanceGainDb: guitar.balanceGainDb,
      }),
      true,
    )
    settle({ buffers: new Map(), release: f.release })
    await Promise.all([editing, moving])
    expect(graphs).toHaveLength(2)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('stops a held run at once when the audio device is interrupted', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    let settle!: (value: StudioBufferLease) => void
    vi.mocked(f.cache.acquire).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve
        }),
    )
    f.ctx.currentTime = 1
    const editing = f.transport.setSnapshot(movedClip(f.project, 960, 1), [
      f.asset,
    ])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledTimes(2))
    expect(graphs[0].dispose).not.toHaveBeenCalled()
    f.ctx.changeState('suspended')
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      error: 'Audio was interrupted. Press Play to continue.',
    })
    settle({ buffers: new Map(), release: f.release })
    await editing
    expect(graphs).toHaveLength(1)
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('stops the held run with the error when the next run cannot be built', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.buildGraph.mockImplementationOnce(() => {
      throw new Error('This effect could not start.')
    })
    f.ctx.currentTime = 1
    await f.transport.setSnapshot(movedClip(f.project, 960, 1), [f.asset])
    expect(faded(envelopeOf(graphs[0]))).toBe(true)
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      pending: false,
      error: 'This effect could not start.',
    })
    await vi.advanceTimersByTimeAsync(240)
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})
