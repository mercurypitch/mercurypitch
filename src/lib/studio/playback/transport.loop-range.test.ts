// Studio transport loop-range tests — Repeat on a range plays only the range, keeps it through edits and seeks, and hands back to the song.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '../memory-budget'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { FIRST_HEARD, freshGraphs, transportFixture, } from './transport.test-fixtures'

type Fixture = ReturnType<typeof transportFixture>

// A half-second range inside the fixture's two-second song.
const RANGE = { startFrame: 48000, endFrame: 72000 }

afterEach(() => {
  setStudioWorkingBytes(null)
  vi.useRealTimers()
})

/** A song of one 2 s take from the start. */
function twoSecondSong(f: Fixture) {
  return {
    project: {
      ...f.project,
      clips: [{ ...f.project.clips[0], startFrame: 0, sourceOutFrame: 96000 }],
    },
    asset: {
      ...f.asset,
      normalizedFrameCount: 96000,
      canonicalPcmByteLength: 384032,
    },
  }
}

function planOf(f: Fixture, call: number): StudioArrangementPlan {
  return f.buildGraph.mock.calls[call][1] as StudioArrangementPlan
}

async function finish(f: Fixture): Promise<void> {
  const released = f.transport.releaseAudio()
  await vi.advanceTimersByTimeAsync(240)
  await released
  f.transport.dispose()
  expect(studioReservedMemoryBytes()).toBe(0)
}

describe('Studio transport loop range', () => {
  it('plays only the range on Repeat, from its start when Play is outside it, pass after pass', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    f.transport.setRepeat(true)
    f.transport.setLoopRange(RANGE)
    await f.transport.play(project, [asset], 0)
    const plan = planOf(f, 0)
    expect(plan.startFrame).toBe(48000)
    expect(plan.endFrame).toBe(72000)
    expect(f.buildGraph.mock.calls[0][4]).toMatchObject({
      fromFrame: 48000,
      repeat: true,
    })
    // 0.75 s in: the run's count is at 84000, half a range into the second pass.
    f.ctx.currentTime = FIRST_HEARD + 0.75
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      playheadFrame: 60000,
    })
    await finish(f)
  })

  it('plays the song again when the range is cleared or Repeat is off', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    f.transport.setLoopRange(RANGE)
    // Repeat off: the range waits, and Play plays the song from the playhead.
    await f.transport.play(project, [asset], 0)
    expect(planOf(f, 0)).toMatchObject({ startFrame: 0, endFrame: 96000 })
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    f.transport.setRepeat(true)
    f.transport.setLoopRange(null)
    await f.transport.play(project, [asset], 0)
    // The kept song run is laid out for the song: it starts again, repeating.
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.resume).toHaveBeenCalledWith(0, expect.any(Number), true)
    expect(f.transport.getState().playing).toBe(true)
    await finish(f)
  })

  it('keeps a paused run for Play only when it was laid out for the same range', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    f.transport.setRepeat(true)
    f.transport.setLoopRange(RANGE)
    await f.transport.play(project, [asset], 0)
    f.ctx.currentTime = FIRST_HEARD + 0.3
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    // The same range: the kept graph starts again, no build.
    await f.transport.play(project, [asset], 50000)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.resume).toHaveBeenCalledWith(50000, expect.any(Number), true)
    f.transport.pause()
    await vi.advanceTimersByTimeAsync(240)
    // Another range: the kept graph is let go and a run is built for it.
    f.transport.setLoopRange({ startFrame: 24000, endFrame: 72000 })
    await f.transport.play(project, [asset], 50000)
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    expect(planOf(f, 1)).toMatchObject({ startFrame: 24000, endFrame: 72000 })
    await finish(f)
  })

  it('moves a seek outside the range to its start, and seeks inside it in place', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    f.transport.setRepeat(true)
    f.transport.setLoopRange(RANGE)
    await f.transport.play(project, [asset], 0)
    f.ctx.currentTime = FIRST_HEARD + 0.1
    await f.transport.seek(60000, project, [asset])
    expect(f.graph.seek).toHaveBeenLastCalledWith(60000, expect.any(Number))
    expect(f.transport.getState().playheadFrame).toBe(60000)
    await f.transport.seek(1000, project, [asset])
    expect(f.graph.seek).toHaveBeenLastCalledWith(48000, expect.any(Number))
    expect(f.transport.getState().playheadFrame).toBe(48000)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    await finish(f)
  })

  it('hands a range loop over to the song when Repeat goes off, without stopping the loop first', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    const { project, asset } = twoSecondSong(f)
    f.transport.setRepeat(true)
    f.transport.setLoopRange(RANGE)
    await f.transport.play(project, [asset], 0)
    f.ctx.currentTime = FIRST_HEARD + 0.6
    f.transport.setRepeat(false)
    // The range run loops on until the song run takes over.
    expect(graphs[0].stopRepeating).not.toHaveBeenCalled()
    await f.transport.setSnapshot(project, [asset])
    expect(graphs).toHaveLength(2)
    expect(planOf(f, 1)).toMatchObject({ startFrame: 0, endFrame: 96000 })
    // It takes over inside the range, where the loop had got to.
    const from = (f.buildGraph.mock.calls[1][4] as { fromFrame: number })
      .fromFrame
    expect(from).toBeGreaterThanOrEqual(48000)
    expect(from).toBeLessThan(72000)
    expect(f.transport.getState().playing).toBe(true)
    await finish(f)
  })

  it('keeps the range when a clip edit moves the playing graph', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const graphs = freshGraphs(f)
    const { project, asset } = twoSecondSong(f)
    f.transport.setRepeat(true)
    f.transport.setLoopRange(RANGE)
    await f.transport.play(project, [asset], 0)
    graphs[0].replan.mockImplementation(
      (_plan: StudioArrangementPlan, earliest: number) => ({
        at: earliest,
        fromFrame: 48000,
        epoch: 0,
      }),
    )
    f.ctx.currentTime = FIRST_HEARD + 0.2
    const shorter = {
      ...project,
      revision: project.revision + 1,
      clips: [{ ...project.clips[0], sourceOutFrame: 60000 }],
    }
    await f.transport.setSnapshot(shorter, [asset])
    expect(graphs).toHaveLength(1)
    const [plan] = graphs[0].replan.mock.calls[0]
    expect(plan).toMatchObject({ startFrame: 48000, endFrame: 72000 })
    await finish(f)
  })
})
