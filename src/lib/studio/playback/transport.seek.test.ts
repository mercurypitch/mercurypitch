// Studio transport seek tests — a seek while playing moves the running graph; a run that cannot follow hands over.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '../memory-budget'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import type { StudioProject } from '../model/types'
import type { StudioBufferLease } from './buffer-cache'
import { RUN_LOOKAHEAD_SECONDS } from './run'
import { envelopeOf, freshGraphs, transportFixture, } from './transport.test-fixtures'

// The fixture's chains: 10 ms of lane and 10 ms of master latency.
const LATENCY = 0.02
// Its context reports no device callback: a seek allows 10 ms, and 5 ms to schedule.
const LEAD = 0.015

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

async function finish(f: ReturnType<typeof transportFixture>) {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  await vi.advanceTimersByTimeAsync(240)
  expect(studioReservedMemoryBytes()).toBe(0)
}

/** Hold the next audio read until the test lets it go, so an edit stays in preparation. */
function holdNextRead(f: ReturnType<typeof transportFixture>) {
  let settle!: (value: StudioBufferLease) => void
  vi.mocked(f.cache.acquire).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve
      }),
  )
  return () => settle({ buffers: new Map(), release: f.release })
}

afterEach(() => vi.useRealTimers())

describe('Studio transport seek', () => {
  it('moves the playing run on its running graph: no new build, measurement or fade, and the playhead shows the frame at once', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset], 0)
    const measured = f.measureLatencies.mock.calls.length
    f.ctx.currentTime = 0.5

    await f.transport.seek(4800, f.project, [f.asset])

    expect(f.graph.seek).toHaveBeenCalledExactlyOnceWith(4800, 0.5 + LEAD)
    expect(f.graph.scheduleUntil).toHaveBeenLastCalledWith(
      0.5 + RUN_LOOKAHEAD_SECONDS,
    )
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.measureLatencies).toHaveBeenCalledTimes(measured)
    expect(faded(envelopeOf(f.graph))).toBe(false)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      pending: false,
      playheadFrame: 4800,
    })
    // Heard once the lanes and master pass it on, and on from there.
    f.ctx.currentTime = 0.5 + LEAD + LATENCY + 0.125
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playheadFrame).toBeCloseTo(4800 + 6000, -1)
    await finish(f)
  })

  it('ends a song that plays once at the end of the pass from the seek frame, and keeps a repeating one going', async () => {
    vi.useFakeTimers()
    const once = transportFixture()
    await once.transport.play(once.project, [once.asset], 0)
    const { endFrame, tailFrames } = once.buildGraph.mock
      .calls[0][1] as StudioArrangementPlan
    once.ctx.currentTime = 0.5
    await once.transport.seek(90000, once.project, [once.asset])
    const end = 0.5 + LEAD + LATENCY + (endFrame - 90000 + tailFrames) / 48000
    once.ctx.currentTime = end - 0.01
    await vi.advanceTimersByTimeAsync(33)
    expect(once.transport.getState().playing).toBe(true)
    once.ctx.currentTime = end + 0.01
    await vi.advanceTimersByTimeAsync(33)
    expect(once.transport.getState().playing).toBe(false)
    await finish(once)

    const looping = transportFixture()
    looping.transport.setRepeat(true)
    await looping.transport.play(looping.project, [looping.asset], 0)
    looping.ctx.currentTime = 0.5
    await looping.transport.seek(90000, looping.project, [looping.asset])
    looping.ctx.currentTime = end + 0.01
    await vi.advanceTimersByTimeAsync(33)
    expect(looping.transport.getState().playing).toBe(true)
    await finish(looping)
  })

  it('only moves the playhead of a stopped song, and stops a playing one at the end when a seek goes there', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.seek(4800, f.project, [f.asset])
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      playheadFrame: 4800,
    })
    expect(f.buildGraph).not.toHaveBeenCalled()

    await f.transport.play(f.project, [f.asset], 0)
    const { endFrame } = f.buildGraph.mock.calls[0][1] as StudioArrangementPlan
    await f.transport.seek(200000, f.project, [f.asset])
    expect(f.graph.seek).not.toHaveBeenCalled()
    expect(faded(envelopeOf(f.graph))).toBe(true)
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      playheadFrame: endFrame,
    })
    await finish(f)
  })

  it("moves a run held for an edit at once, and builds the edit's run to take over from the new frame", async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    const release = holdNextRead(f)
    f.ctx.currentTime = 1
    const edited = movedClip(f.project, 960, 1)
    const editing = f.transport.setSnapshot(edited, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledTimes(2))

    const seeking = f.transport.seek(48000, edited, [f.asset])
    expect(graphs[0].seek).toHaveBeenCalledExactlyOnceWith(48000, 1 + LEAD)
    expect(faded(envelopeOf(graphs[0]))).toBe(false)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      playheadFrame: 48000,
    })
    release()
    await Promise.all([editing, seeking])

    // One run for the edit, built after the seek, joins the held run where it plays then.
    expect(graphs).toHaveLength(2)
    const [, plan, , epoch, options] = f.buildGraph.mock.calls[1]
    expect(
      (plan as StudioArrangementPlan).lanes[0].segments[0].startFrame,
    ).toBe(960)
    const heard = 1 + LEAD + LATENCY
    expect(options.fromFrame).toBe(
      Math.round(48000 + (epoch + LATENCY - heard) * 48000),
    )
    expect(faded(envelopeOf(graphs[0]))).toBe(false)
    await finish(f)
  })

  it('hands over to a run built at the frame when the held run cannot reach it, and shows that frame from the click', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    const release = holdNextRead(f)
    f.ctx.currentTime = 1
    // The edit makes the song a second longer than the run playing it.
    const longer = movedClip(f.project, 48000, 1)
    const editing = f.transport.setSnapshot(longer, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledTimes(2))

    const seeking = f.transport.seek(120000, longer, [f.asset])
    expect(graphs[0].seek).not.toHaveBeenCalled()
    expect(f.transport.getState().playheadFrame).toBe(120000)
    release()
    await Promise.all([editing, seeking])

    expect(graphs).toHaveLength(2)
    const [, , , epoch, options] = f.buildGraph.mock.calls[1]
    expect(options.fromFrame).toBe(120000)
    const at = epoch + LATENCY
    const [held, next] = graphs.map(envelopeOf)
    expect(faded(held)).toBe(false)
    expect(held.gain.linearRamps).toEqual([{ value: 0, time: at + 0.03 }])
    expect(next.gain.linearRamps).toEqual([{ value: 1, time: at + 0.03 }])
    // The old place plays until the handover, but the playhead stays on the new one.
    f.ctx.currentTime = at - 0.02
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playheadFrame).toBe(120000)
    f.ctx.currentTime = at + 0.125
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playheadFrame).toBeCloseTo(126000, -1)
    await finish(f)
  })

  it("keeps a seek whose handover an edit takes back, so the edit's run starts at the seek frame", async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    const release = holdNextRead(f)
    f.ctx.currentTime = 1
    const longer = movedClip(f.project, 48000, 1)
    const editing = f.transport.setSnapshot(longer, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledTimes(2))
    const seeking = f.transport.seek(120000, longer, [f.asset])
    release()
    await Promise.all([editing, seeking])
    expect(graphs).toHaveLength(2)

    // Another edit comes before the handover to the seek's run begins.
    await f.transport.setSnapshot(movedClip(f.project, 48960, 2), [f.asset])

    expect(graphs).toHaveLength(3)
    expect(graphs[1].dispose).toHaveBeenCalledOnce()
    const [, , , , options] = f.buildGraph.mock.calls[2]
    expect(options.fromFrame).toBe(120000)
    expect(faded(envelopeOf(graphs[0]))).toBe(false)
    expect(f.transport.getState().playheadFrame).toBe(120000)
    await finish(f)
  })
})
