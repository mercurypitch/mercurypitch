// Studio transport kept run — Pause keeps the built graph, Play starts it again without a build, and the graph goes when it no longer fits or is not needed.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { reserveStudioMemory, setStudioWorkingBytes, studioReservedMemoryBytes, } from '../memory-budget'
import { applyStudioCommand } from '../model/commands'
import type { StudioProject } from '../model/types'
import { KEEP_HIDDEN_MS, KEEP_IDLE_MS } from './kept-run'
import { PlaybackContext } from './playback.test-fixtures'
import { envelopeOf, freshGraphs, transportFixture, } from './transport.test-fixtures'

afterEach(() => {
  setStudioWorkingBytes(null)
  vi.useRealTimers()
})

type Fixture = ReturnType<typeof transportFixture>

const faded = (envelope: ReturnType<typeof envelopeOf>) =>
  envelope.gain.events.some((event) => event.kind === 'target')

/** How far a frame is from one computed on the clock: float seconds can round either way. */
const framesOff = (actual: number, expected: number) =>
  Math.abs(actual - expected)

/** The song with its clip moved: an edit only a new graph can play. */
function movedClip(project: StudioProject, startFrame: number): StudioProject {
  return {
    ...project,
    revision: project.revision + 1,
    clips: [{ ...project.clips[0], startFrame }],
  }
}

/** Play from the top, pause at 1 s, and let the fade finish. */
async function pausedAtOneSecond(f: Fixture): Promise<number> {
  await f.transport.play(f.project, [f.asset], 0)
  f.ctx.currentTime = 1
  await vi.advanceTimersByTimeAsync(33)
  f.transport.pause()
  await vi.advanceTimersByTimeAsync(240)
  return f.transport.getState().playheadFrame
}

async function finish(f: Fixture): Promise<void> {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  expect(studioReservedMemoryBytes()).toBe(0)
}

describe('Studio transport kept run', () => {
  it('keeps the graph through Pause and starts it again on Play, with no build', async () => {
    vi.useFakeTimers()
    const laneMeter = {
      read: vi.fn(() => null),
      restart: vi.fn(),
      dispose: vi.fn(),
      measurement: 1,
    }
    const createLaneMeter = vi.fn(() => laneMeter)
    const f = transportFixture({ createLaneMeter })
    await f.transport.play(f.project, [f.asset], 0)
    const measured = f.measureLatencies.mock.calls.length
    const reserved = studioReservedMemoryBytes()
    f.ctx.currentTime = 1
    await vi.advanceTimersByTimeAsync(33)
    f.transport.pause()
    const paused = f.transport.getState().playheadFrame
    // Heard from 0.26 s: paused 0.74 s into the song.
    expect(framesOff(paused, 0.74 * 48000)).toBeLessThanOrEqual(1)
    expect(f.transport.getState().playing).toBe(false)
    expect(faded(envelopeOf(f.graph))).toBe(true)
    expect(f.graph.park).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(240)
    // Silent: its sources and meters stop; chains, audio and memory stay.
    expect(f.graph.park).toHaveBeenCalledOnce()
    expect(laneMeter.dispose).toHaveBeenCalledOnce()
    expect(f.graph.dispose).not.toHaveBeenCalled()
    expect(f.release).not.toHaveBeenCalled()
    expect(studioReservedMemoryBytes()).toBe(reserved)

    f.ctx.currentTime = 3
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.cache.acquire).toHaveBeenCalledOnce()
    expect(f.measureLatencies).toHaveBeenCalledTimes(measured)
    // New sources a device callback (10 ms) and 5 ms of scheduling ahead,
    // heard 20 ms of chain and master latency later through the house attack.
    expect(f.graph.resume).toHaveBeenCalledExactlyOnceWith(
      paused,
      expect.closeTo(3.015, 9),
      false,
    )
    expect(envelopeOf(f.graph).gain.ramps.at(-1)).toEqual({
      value: 1,
      time: expect.closeTo(3.035 + 0.09, 9),
    })
    expect(f.graph.scheduleUntil).toHaveBeenLastCalledWith(5)
    expect(createLaneMeter).toHaveBeenLastCalledWith(
      f.ctx.liveContext,
      expect.any(Map),
      expect.closeTo(3.035, 9),
    )
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      pending: false,
      playheadFrame: paused,
    })
    f.ctx.currentTime = 3.535
    await vi.advanceTimersByTimeAsync(33)
    expect(
      framesOff(f.transport.getState().playheadFrame, paused + 0.5 * 48000),
    ).toBeLessThanOrEqual(1)
    await finish(f)
  })

  it('builds afresh when Play comes before the kept run is silent', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 1
    f.transport.pause()
    f.ctx.currentTime = 1.1
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(graphs).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(240)
    expect(graphs[0].park).not.toHaveBeenCalled()
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    expect(graphs[1].dispose).not.toHaveBeenCalled()
    await finish(f)
  })

  it('stops rendering the kept graph once its tails have rung out, and connects it again on Play', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await pausedAtOneSecond(f)
    const envelope = envelopeOf(f.graph)
    const tailMs = (f.buildGraph.mock.calls[0][1].tailFrames / 48000) * 1000
    // Still rendered while a reverb could ring on through the closed envelope.
    await vi.advanceTimersByTimeAsync(tailMs + 999)
    expect(envelope.targets).toContain(f.ctx.destination)
    await vi.advanceTimersByTimeAsync(1)
    expect(envelope.targets).not.toContain(f.ctx.destination)
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(envelope.targets).toContain(f.ctx.destination)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    await finish(f)
  })

  it('starts the kept graph where a seek while paused put the playhead', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await pausedAtOneSecond(f)
    await f.transport.seek(4800, f.project, [f.asset])
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.resume.mock.calls[0][0]).toBe(4800)
    await finish(f)
  })

  it('lets the kept graph go for an edit to the clips while paused, and Play builds afresh', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await pausedAtOneSecond(f)
    const moved = movedClip(f.project, 960)
    await f.transport.setSnapshot(moved, [f.asset])
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    expect(f.release).toHaveBeenCalledOnce()
    expect(studioReservedMemoryBytes()).toBe(0)
    expect(await f.transport.play(moved, [f.asset])).toBe(true)
    expect(graphs).toHaveLength(2)
    expect(graphs[0].resume).not.toHaveBeenCalled()
    await finish(f)
  })

  it('moves the kept graph for a mix or sound edit while paused, and Play starts it', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await pausedAtOneSecond(f)
    const [track] = f.project.tracks
    const quieter = {
      ...f.project,
      revision: 1,
      tracks: [{ ...track, gainDb: -6 }],
    }
    await f.transport.setSnapshot(quieter, [f.asset])
    expect(f.graph.setLaneMix).toHaveBeenLastCalledWith(quieter.tracks[0], true)
    const warm = applyStudioCommand(
      quieter,
      { type: 'set-sound-flavour', flavourId: 'warm' },
      { assets: [f.asset] },
    )
    await f.transport.setSnapshot(warm, [f.asset])
    expect(f.graph.setMasterSpec).toHaveBeenLastCalledWith(
      resolveStudioSoundGraph(warm).full,
    )
    expect(f.graph.dispose).not.toHaveBeenCalled()
    expect(await f.transport.play(warm, [f.asset])).toBe(true)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.resume).toHaveBeenCalledOnce()
    await finish(f)
  })

  it('starts the kept graph looping when Repeat came on while paused, and builds afresh when it cannot loop', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    await pausedAtOneSecond(f)
    f.transport.setRepeat(true)
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(graphs).toHaveLength(1)
    expect(graphs[0].resume.mock.calls[0][2]).toBe(true)
    // It repeats: the song never plays out.
    f.ctx.currentTime = 60
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playing).toBe(true)

    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    graphs[0].resume.mockReturnValue(false)
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(graphs).toHaveLength(2)
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    expect(f.buildGraph.mock.calls[1][4].repeat).toBe(true)
    await finish(f)
  })

  it('waits at the end of a song played out, and Play starts the same graph from the top', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset], 0)
    f.ctx.currentTime = 30
    await vi.advanceTimersByTimeAsync(33)
    const { endFrame } = f.buildGraph.mock.calls[0][1]
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      playheadFrame: endFrame,
    })
    await vi.advanceTimersByTimeAsync(240)
    expect(f.graph.park).toHaveBeenCalledOnce()
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.resume.mock.calls[0][0]).toBe(0)
    await finish(f)
  })

  it('builds afresh when Play gets another audio context', async () => {
    vi.useFakeTimers()
    let replaced: PlaybackContext | null = null
    const f: Fixture = transportFixture({
      lease: {
        ensure: () => (replaced ?? f.ctx).liveContext,
        unlock: vi.fn().mockResolvedValue(true),
      },
    })
    const graphs = freshGraphs(f)
    await pausedAtOneSecond(f)
    replaced = new PlaybackContext(48000)
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(graphs).toHaveLength(2)
    expect(graphs[0].dispose).toHaveBeenCalledOnce()
    expect(graphs[0].resume).not.toHaveBeenCalled()
    await finish(f)
  })

  it('lets the kept graph go after five minutes without Play', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await pausedAtOneSecond(f)
    await vi.advanceTimersByTimeAsync(KEEP_IDLE_MS - 241)
    expect(f.graph.dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(f.graph.dispose).toHaveBeenCalledOnce()
    expect(studioReservedMemoryBytes()).toBe(0)
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    await finish(f)
  })

  it('lets the kept graph go after thirty seconds with the page hidden', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await pausedAtOneSecond(f)
    f.transport.setPageHidden(true)
    await vi.advanceTimersByTimeAsync(KEEP_HIDDEN_MS - 1)
    expect(f.graph.dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(f.graph.dispose).toHaveBeenCalledOnce()
    await finish(f)
  })

  it('gives its memory back when the budget needs the room', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await pausedAtOneSecond(f)
    const reserved = studioReservedMemoryBytes()
    expect(reserved).toBeGreaterThan(0)
    setStudioWorkingBytes(reserved + 1024)
    // Only fits once the kept graph is gone.
    const release = reserveStudioMemory(reserved)
    expect(f.graph.dispose).toHaveBeenCalledOnce()
    expect(f.cache.clear).toHaveBeenCalled()
    release()
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    await finish(f)
  })

  it.each([
    ['Stop', (f: Fixture) => f.transport.stop()],
    ['releasing audio', (f: Fixture) => f.transport.releaseAudio()],
    ['closing Studio', (f: Fixture) => f.transport.dispose()],
  ])('lets the kept graph go on %s', async (_name, act) => {
    vi.useFakeTimers()
    const f = transportFixture()
    await pausedAtOneSecond(f)
    await act(f)
    expect(f.graph.dispose).toHaveBeenCalledOnce()
    expect(studioReservedMemoryBytes()).toBe(0)
    f.transport.dispose()
  })
})
