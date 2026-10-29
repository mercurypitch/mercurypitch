// Studio transport lifecycle tests cover delayed preparation, ownership, real clock latency and teardown races.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NEUTRAL_MACROS } from '@/lib/studio-fx/mix-macros'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { setStudioWorkingBytes, StudioMemoryError, studioReservedMemoryBytes, } from '../memory-budget'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { studioLaneSpec } from '../model/arrangement-plan'
import { applyStudioCommand } from '../model/commands'
import { createStudioTrack } from '../model/defaults'
import type { StudioBufferLease } from './buffer-cache'
import type { PlaybackContext } from './playback.test-fixtures'
import { RUN_OPEN_SECONDS, RUN_SETTLE_SECONDS } from './run'
import { FIRST_HEARD, openingEnds, transportFixture, withQuietLane, } from './transport.test-fixtures'

afterEach(() => vi.useRealTimers())

describe('Studio borrowed transport', () => {
  it('measures each chain once and starts again while the old run still fades', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset])
    const measured = f.measureLatencies.mock.calls.length
    f.transport.pause()
    await f.transport.play(f.project, [f.asset], 100)
    // The first run's 240 ms release timer has not run yet.
    expect(f.graph.dispose).not.toHaveBeenCalled()
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    expect(f.measureLatencies).toHaveBeenCalledTimes(measured)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      playheadFrame: 100,
    })
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('moves volume, pan and Solo on the running graph without restarting', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset])
    const [track] = f.project.tracks
    const louder = { ...track, gainDb: -3, pan: 0.5, solo: true }
    await f.transport.setSnapshot(
      { ...f.project, revision: 1, tracks: [louder] },
      [f.asset],
    )
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.setLaneMix).toHaveBeenCalledWith(louder, true)
    expect(f.transport.getState().playing).toBe(true)
    const muted = { ...louder, mute: true }
    await f.transport.setSnapshot(
      { ...f.project, revision: 2, tracks: [muted] },
      [f.asset],
    )
    expect(f.graph.setLaneMix).toHaveBeenLastCalledWith(muted, false)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    // Any other edit, here a moved clip, still restarts.
    await f.transport.setSnapshot(
      {
        ...f.project,
        revision: 3,
        tracks: [louder],
        clips: [{ ...f.project.clips[0], startFrame: 960 }],
      },
      [f.asset],
    )
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('keeps playing through a flavour and Reset sound, moving the running chains instead', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset])
    const [track] = f.project.tracks
    const warm = applyStudioCommand(
      f.project,
      { type: 'set-sound-flavour', flavourId: 'warm' },
      { assets: [f.asset] },
    )
    await f.transport.setSnapshot(warm, [f.asset])
    expect(f.graph.setLaneSpec).toHaveBeenLastCalledWith(
      track.id,
      studioLaneSpec(track, warm.mix.macros),
    )
    expect(f.graph.setMasterSpec).toHaveBeenLastCalledWith(
      resolveStudioSoundGraph(warm).full,
    )
    const reset = applyStudioCommand(
      warm,
      { type: 'set-sound-flavour', flavourId: 'natural' },
      { assets: [f.asset] },
    )
    await f.transport.setSnapshot(reset, [f.asset])
    expect(f.graph.setLaneSpec).toHaveBeenLastCalledWith(
      track.id,
      studioLaneSpec(track, NEUTRAL_MACROS),
    )
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.graph.dispose).not.toHaveBeenCalled()
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      pending: false,
    })
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('keeps playing when an empty lane is added, and restarts for a new effect list', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset])
    const lane = createStudioTrack({ id: 'lane-2', name: 'Lane 2', order: 1 })
    const added = applyStudioCommand(
      f.project,
      { type: 'add-track', track: lane },
      { assets: [f.asset] },
    )
    await f.transport.setSnapshot(added, [f.asset])
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.transport.getState().playing).toBe(true)
    // A new role brings other effects, other latency: that needs a new graph.
    const drums = applyStudioCommand(
      added,
      { type: 'set-track-role', trackId: 'track-1', role: 'drums' },
      { assets: [f.asset] },
    )
    await f.transport.setSnapshot(drums, [f.asset])
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('plays a moving fader and dial without saving, and returns to the saved values after', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset])
    const [track] = f.project.tracks
    f.transport.previewLane(track.id, { gainDb: -20, pan: 0.5 })
    expect(f.graph.setLaneMix).toHaveBeenLastCalledWith(
      { ...track, gainDb: -20, pan: 0.5 },
      true,
    )
    f.transport.previewMacro('space', 60)
    expect(f.graph.setLaneSpec).toHaveBeenLastCalledWith(
      track.id,
      studioLaneSpec(track, { ...f.project.mix.macros, space: 60 }),
    )
    // The gesture commits its last value, then its preview ends.
    const saved = {
      ...f.project,
      revision: 1,
      tracks: [{ ...track, gainDb: -20, pan: 0.5 }],
    }
    await f.transport.setSnapshot(saved, [f.asset])
    f.transport.previewLane(track.id, null)
    expect(f.graph.setLaneMix).toHaveBeenLastCalledWith(saved.tracks[0], true)
    // A dial let go without a saved change returns to the saved sound.
    f.transport.previewMacro('space', null)
    expect(f.graph.setLaneSpec).toHaveBeenLastCalledWith(
      track.id,
      studioLaneSpec(track, f.project.mix.macros),
    )
    expect(f.buildGraph).toHaveBeenCalledOnce()
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('starts as a control already sounds when Play comes mid-gesture', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const [track] = f.project.tracks
    f.transport.previewLane(track.id, { gainDb: -12 })
    expect(f.graph.setLaneMix).not.toHaveBeenCalled()
    await f.transport.play(f.project, [f.asset])
    expect(f.graph.setLaneMix).toHaveBeenLastCalledWith(
      { ...track, gainDb: -12 },
      true,
    )
    f.transport.stop()
    await f.transport.play(f.project, [f.asset])
    expect(f.graph.setLaneMix).toHaveBeenCalledTimes(1)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('brings in a lane that was muted when Play built the graph by gliding its gain, without a restart', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const project = withQuietLane(f)
    const quietAsset = { ...f.asset, id: 'quiet-asset' }
    f.measureLatencies.mockResolvedValue([441])
    await f.transport.play(project, [f.asset, quietAsset])
    expect(f.buildGraph.mock.calls[0][4]).toMatchObject({ silentLanes: true })
    const plan = f.buildGraph.mock.calls[0][1] as StudioArrangementPlan
    // Measured and aligned with the rest, though silent for now.
    expect(plan.lanes[1].chainLatencySeconds).toBe(0.01)
    expect(f.cache.acquire).toHaveBeenCalledWith(
      [f.asset, quietAsset],
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
    const unmuted = {
      ...project,
      revision: 1,
      tracks: [project.tracks[0], { ...project.tracks[1], mute: false }],
    }
    await f.transport.setSnapshot(unmuted, [f.asset, quietAsset])
    expect(f.graph.setLaneMix).toHaveBeenCalledWith(unmuted.tracks[1], true)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    // Solo on the first lane silences the second again, still in place.
    const soloed = {
      ...unmuted,
      revision: 2,
      tracks: [{ ...unmuted.tracks[0], solo: true }, unmuted.tracks[1]],
    }
    await f.transport.setSnapshot(soloed, [f.asset, quietAsset])
    expect(f.graph.setLaneMix).toHaveBeenLastCalledWith(soloed.tracks[1], false)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('builds only the lanes heard when the muted ones do not fit in memory, and restarts to bring one in', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const project = withQuietLane(f)
    const quietAsset = { ...f.asset, id: 'quiet-asset' }
    vi.mocked(f.cache.acquire).mockRejectedValueOnce(
      new StudioMemoryError('Studio needs more memory for this audio.'),
    )
    expect(await f.transport.play(project, [f.asset, quietAsset])).toBe(true)
    expect(f.cache.acquire).toHaveBeenLastCalledWith(
      [f.asset],
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
    expect(f.buildGraph.mock.calls[0][4]).toMatchObject({ silentLanes: false })
    await f.transport.setSnapshot(
      {
        ...project,
        revision: 1,
        tracks: [project.tracks[0], { ...project.tracks[1], mute: false }],
      },
      [f.asset, quietAsset],
    )
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('plays on from the playhead with the lanes heard when the whole song does not fit, and restarts to loop', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    const full = new StudioMemoryError(
      'Studio needs more memory for this audio.',
    )
    vi.mocked(f.cache.acquire)
      .mockRejectedValueOnce(full)
      .mockRejectedValueOnce(full)
    expect(await f.transport.play(project, [asset], 48000)).toBe(true)
    const plan = f.buildGraph.mock.calls[0][1] as StudioArrangementPlan
    expect(plan.startFrame).toBe(48000)
    expect(f.buildGraph.mock.calls[0][4]).toMatchObject({
      fromFrame: 48000,
      silentLanes: false,
    })
    // Its graph cannot loop to the start, so Repeat starts again from there.
    f.transport.setRepeat(true)
    await f.transport.setSnapshot(project, [asset])
    expect(f.graph.repeat).not.toHaveBeenCalled()
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    expect(
      (f.buildGraph.mock.calls[1][1] as StudioArrangementPlan).startFrame,
    ).toBe(0)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('waits for the fading run when Play cannot hold two graphs at once', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset])
    const one = studioReservedMemoryBytes()
    setStudioWorkingBytes(one + Math.floor(one / 2))
    try {
      f.transport.pause()
      const playing = f.transport.play(f.project, [f.asset], 100)
      await vi.advanceTimersByTimeAsync(239)
      expect(f.buildGraph).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(1)
      await playing
      expect(f.buildGraph).toHaveBeenCalledTimes(2)
      expect(f.transport.getState()).toMatchObject({
        playing: true,
        error: null,
      })
      const released = f.transport.releaseAudio()
      await vi.advanceTimersByTimeAsync(240)
      await released
    } finally {
      setStudioWorkingBytes(null)
    }
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('warms the cache and chain timing before Play, without unlocking audio', async () => {
    const f = transportFixture()
    await f.transport.warm(f.project, [f.asset])
    expect(f.unlock).not.toHaveBeenCalled()
    expect(f.cache.acquire).toHaveBeenCalledOnce()
    expect(f.release).toHaveBeenCalledOnce()
    const measured = f.measureLatencies.mock.calls.length
    expect(measured).toBeGreaterThan(0)
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.measureLatencies).toHaveBeenCalledTimes(measured)
    await f.transport.releaseAudio()
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('stops a warm-up in flight and waits for it before releasing audio', async () => {
    const f = transportFixture()
    let seen: AbortSignal | undefined
    let settle!: (value: StudioBufferLease) => void
    vi.mocked(f.cache.acquire).mockImplementationOnce(
      (_assets, _ctx, _read, signal) => {
        seen = signal
        return new Promise((resolve) => {
          settle = resolve
        })
      },
    )
    const warming = f.transport.warm(f.project, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledOnce())
    let released = false
    const release = f.transport.releaseAudio().then(() => {
      released = true
    })
    expect(seen?.aborted).toBe(true)
    await Promise.resolve()
    expect(released).toBe(false)
    settle({ buffers: new Map(), release: f.release })
    await Promise.all([warming, release])
    expect(f.release).toHaveBeenCalledOnce()
    expect(f.cache.clear).toHaveBeenCalled()
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('only starts the newest edit when revisions change during preparation', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    let settle!: (value: StudioBufferLease) => void
    vi.mocked(f.cache.acquire).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve
        }),
    )
    const initial = f.transport.play(f.project, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalledOnce())
    const firstEdit = f.transport.setSnapshot({ ...f.project, revision: 1 }, [
      f.asset,
    ])
    const lastEdit = f.transport.setSnapshot({ ...f.project, revision: 2 }, [
      f.asset,
    ])
    settle({ buffers: new Map(), release: vi.fn() })
    expect(await initial).toBe(false)
    await Promise.all([firstEdit, lastEdit])
    expect(f.buildGraph).toHaveBeenCalledOnce()
    expect(f.buildGraph.mock.calls[0][1].revision).toBe(2)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('does not autoplay, and starts a Play from silence once its graph is built and settled, after measured 44.1k latency', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    expect(f.unlock).not.toHaveBeenCalled()
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    expect(f.buildGraph.mock.calls[0][1].lanes[0].chainLatencySeconds).toBe(
      0.01,
    )
    const envelope = f.ctx.created
      .filter((node) => node.nodeType === 'gain')
      .at(-1) as ReturnType<PlaybackContext['createGain']>
    // Built at 0: its compressors settle from then, its sources start
    // 60 ms later, and it is heard 20 ms after that, fully open 10 ms on.
    expect(f.buildGraph.mock.calls[0][3]).toBeCloseTo(RUN_SETTLE_SECONDS, 9)
    expect(f.graph.settle).toHaveBeenCalledWith(0)
    expect(f.graph.retime).not.toHaveBeenCalled()
    expect(openingEnds(envelope.gain)).toEqual([
      expect.closeTo(FIRST_HEARD + RUN_OPEN_SECONDS, 9),
    ])
    f.ctx.currentTime = FIRST_HEARD + 0.01
    await vi.advanceTimersByTimeAsync(33)
    expect(
      Math.abs(f.transport.getState().playheadFrame - 480),
    ).toBeLessThanOrEqual(1)
    expect(f.transport.getState()).toMatchObject({ peakL: 0.2, peakR: 0.4 })
    const released = f.transport.releaseAudio()
    expect(f.graph.dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(239)
    expect(f.release).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await released
    expect(f.release).toHaveBeenCalledOnce()
    f.transport.dispose()
    expect(f.ctx.closeCount).toBe(0)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('starts a Play whose build outlasted its lead after the build, never with its first frames cut', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    f.buildGraph.mockImplementationOnce(() => {
      // A slow device: the audio clock runs on 0.3 s while the graph is built.
      f.ctx.currentTime = 0.3
      return f.graph
    })
    expect(await f.transport.play(f.project, [f.asset])).toBe(true)
    const envelope = f.ctx.created
      .filter((node) => node.nodeType === 'gain')
      .at(-1) as ReturnType<PlaybackContext['createGain']>
    expect(f.graph.settle).toHaveBeenCalledWith(0.3)
    const [[epoch]] = f.graph.retime.mock.calls
    expect(epoch).toBeCloseTo(0.3 + RUN_SETTLE_SECONDS, 9)
    expect(openingEnds(envelope.gain)).toEqual([
      expect.closeTo(0.3 + RUN_SETTLE_SECONDS + 0.02 + RUN_OPEN_SECONDS, 9),
    ])
    expect(f.transport.getState()).toMatchObject({ playing: true, error: null })
    f.ctx.currentTime = 0.4
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('retains an explicitly measured gain while paused and invalidates it on an edit', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    f.transport.setMasterGain({
      projectId: f.project.id,
      revision: f.project.revision,
      gainDb: 3,
      safetyGainDb: -1,
    })
    await f.transport.setSnapshot(f.project, [f.asset])
    expect(f.transport.getState()).toMatchObject({
      masterReady: true,
      playing: false,
    })
    expect(f.unlock).not.toHaveBeenCalled()
    await f.transport.play(f.project, [f.asset])
    const master = f.buildGraph.mock.calls[0][4].master.spec as {
      effects: { id: string; params: Record<string, number> }[]
    }
    expect(
      master.effects.find((effect) => effect.id === 'loudness')?.params.gainDb,
    ).toBe(3)
    expect(
      master.effects.find((effect) => effect.id === 'peak-safety')?.params
        .gainDb,
    ).toBe(-1)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    expect(f.transport.getState().masterReady).toBe(true)
    await f.transport.setSnapshot({ ...f.project, revision: 1 }, [f.asset])
    expect(f.transport.getState()).toMatchObject({
      masterReady: false,
      playing: false,
    })
    expect(f.buildGraph).toHaveBeenCalledOnce()
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('holds native preparation admission through cancellation and rejects stale completion', async () => {
    const f = transportFixture()
    let settle!: (value: StudioBufferLease) => void
    vi.mocked(f.cache.acquire).mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve
        }),
    )
    const playing = f.transport.play(f.project, [f.asset])
    await vi.waitFor(() => expect(f.cache.acquire).toHaveBeenCalled())
    const held = studioReservedMemoryBytes()
    expect(held).toBeGreaterThan(0)
    f.transport.pause()
    expect(studioReservedMemoryBytes()).toBe(held)
    expect(await f.transport.play(f.project, [f.asset])).toBe(false)
    settle({ buffers: new Map(), release: f.release })
    expect(await playing).toBe(false)
    expect(f.buildGraph).not.toHaveBeenCalled()
    expect(f.release).toHaveBeenCalledOnce()
    expect(studioReservedMemoryBytes()).toBe(0)
    f.transport.dispose()
  })

  it('a retired generation cannot stop the next run and interruption never resumes itself', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    await f.transport.play(f.project, [f.asset])
    f.transport.pause()
    const nextGraph = { ...f.graph, dispose: vi.fn() }
    f.buildGraph.mockReturnValueOnce(nextGraph)
    await f.transport.play(f.project, [f.asset])
    await vi.advanceTimersByTimeAsync(240)
    expect(f.graph.dispose).toHaveBeenCalledOnce()
    expect(nextGraph.dispose).not.toHaveBeenCalled()
    f.ctx.changeState('suspended')
    expect(f.transport.getState().playing).toBe(false)
    expect(nextGraph.dispose).toHaveBeenCalledOnce()
    f.ctx.changeState('running')
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })
  it('wraps the displayed audio-clock position while one graph keeps repeating', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const project = {
      ...f.project,
      clips: [{ ...f.project.clips[0], startFrame: 0, sourceOutFrame: 96000 }],
    }
    const asset = {
      ...f.asset,
      normalizedFrameCount: 96000,
      canonicalPcmByteLength: 384032,
    }
    f.transport.setRepeat(true)
    await f.transport.play(project, [asset], 48000)
    expect(f.buildGraph.mock.calls[0][4]).toMatchObject({
      fromFrame: 48000,
      repeat: true,
    })
    f.ctx.currentTime = FIRST_HEARD + 2.5
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playing).toBe(true)
    expect(f.transport.getState().playheadFrame).toBe(72000)
    expect(f.buildGraph).toHaveBeenCalledOnce()
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('loops the running song once Repeat is turned on, and lets it end once turned off, without a restart', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 0)
    expect(f.buildGraph.mock.calls[0][4]).toMatchObject({
      fromFrame: 0,
      repeat: false,
    })
    const plan = f.buildGraph.mock.calls[0][1] as StudioArrangementPlan
    // The first pass is heard from FIRST_HEARD: 2 s of song, then its tail.
    const tail = plan.tailFrames / 48000
    f.ctx.currentTime = 1.5
    f.transport.setRepeat(true)
    expect(f.graph.repeat).toHaveBeenCalledOnce()
    await f.transport.setSnapshot(project, [asset])
    f.ctx.currentTime = FIRST_HEARD + 2 + tail + 0.5
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState()).toMatchObject({
      playing: true,
      playheadFrame: Math.floor((tail + 0.5) * 48000) % 96000,
    })

    // Off during the second pass: it ends after that pass and its tail.
    f.graph.stopRepeating.mockReturnValue(1)
    f.transport.setRepeat(false)
    await f.transport.setSnapshot(project, [asset])
    f.ctx.currentTime = FIRST_HEARD + 3.99 + tail
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState().playing).toBe(true)
    f.ctx.currentTime = FIRST_HEARD + 4.01 + tail
    await vi.advanceTimersByTimeAsync(33)
    expect(f.transport.getState()).toMatchObject({
      playing: false,
      playheadFrame: 96000,
    })
    expect(f.buildGraph).toHaveBeenCalledOnce()
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('starts again from the top when Repeat comes on after the loop point has gone by', async () => {
    vi.useFakeTimers()
    const f = transportFixture()
    const { project, asset } = twoSecondSong(f)
    await f.transport.play(project, [asset], 0)
    f.graph.repeat.mockReturnValue(false)
    f.ctx.currentTime = FIRST_HEARD + 2.04
    f.transport.setRepeat(true)
    await f.transport.setSnapshot(project, [asset])
    expect(f.buildGraph).toHaveBeenCalledTimes(2)
    expect(f.buildGraph.mock.calls[1][4]).toMatchObject({
      fromFrame: 0,
      repeat: true,
    })
    expect(f.transport.getState().playing).toBe(true)
    const released = f.transport.releaseAudio()
    await vi.advanceTimersByTimeAsync(240)
    await released
    f.transport.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})

/** A song of one 2 s take from the start. */
function twoSecondSong(f: ReturnType<typeof transportFixture>) {
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
