// Studio offline ownership tests keep reservations through native cancellation and returned-buffer use.
import { describe, expect, it, vi } from 'vitest'
import { toneAudio } from '../audio/audio.fixture'
import { encodeCanonicalPcm, sha256Bytes } from '../audio/canonical-pcm'
import { studioReservedMemoryBytes } from '../memory-budget'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { withStudioAutomation } from '../model/automation'
import { studioFixture } from '../model/model.test-fixtures'
import { encodeFrozenLane, laneFreezeKey } from './lane-freeze'
import { renderStudioArrangement } from './offline-render'
import type { PlaybackParam, PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'

async function fixture() {
  const f = studioFixture()
  const blob = await encodeCanonicalPcm(toneAudio(1000))
  const asset = {
    ...f.asset,
    canonicalPcmSha256: await sha256Bytes(await blob.arrayBuffer()),
  }
  const project = {
    ...f.project,
    tracks: f.project.tracks.map((track) => ({
      ...track,
      fx: { ...track.fx, baseSpec: { version: 1 as const, effects: [] } },
    })),
  }
  const ctx = new PlaybackContext()
  ctx.state = 'suspended'
  let settle!: (buffer: AudioBuffer) => void
  const startRendering = vi.fn(
    () =>
      new Promise<AudioBuffer>((resolve) => {
        settle = resolve
      }),
  )
  Object.assign(ctx, { startRendering })
  let totalFrames = 0
  const createContext = (options: OfflineAudioContextOptions) => {
    totalFrames = options.length
    return ctx as unknown as OfflineAudioContext
  }
  const finish = () =>
    settle(ctx.createBuffer(2, totalFrames, 48000) as unknown as AudioBuffer)
  return { project, asset, blob, ctx, startRendering, createContext, finish }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

/** `seconds` of the fixture's lane, and a render of it keyed `key` (its own key when absent). */
function frozenSong(f: Fixture, seconds: number, key?: string) {
  const frames = seconds * 48000
  const asset = {
    ...f.asset,
    normalizedFrameCount: frames,
    canonicalPcmByteLength: frames * 4 + 32,
  }
  const project = {
    ...f.project,
    clips: f.project.clips.map((clip) => ({
      ...clip,
      startFrame: 0,
      sourceInFrame: 0,
      sourceOutFrame: frames,
    })),
  }
  const [lane] = compileStudioArrangement(project, [asset]).lanes
  const level = new Float32Array(frames).fill(0.25)
  const render = encodeFrozenLane(
    { trackId: lane.track.id, key: key ?? laneFreezeKey(lane), spec: '[]' },
    [level, level],
    0,
  )
  return { project, asset, frozen: new Map([[lane.track.id, render]]) }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Studio offline arrangement ownership', () => {
  it('cannot release native render admission early when cancelled', async () => {
    const f = await fixture()
    const abort = new AbortController()
    const rendering = renderStudioArrangement(
      f.project,
      [f.asset],
      () => Promise.resolve(f.blob),
      {
        signal: abort.signal,
        createContext: f.createContext,
        measureLatencies: async () => [0],
      },
    )
    await vi.waitFor(() => expect(f.startRendering).toHaveBeenCalledOnce())
    const held = studioReservedMemoryBytes()
    abort.abort()
    expect(studioReservedMemoryBytes()).toBe(held)
    f.finish()
    await expect(rendering).rejects.toMatchObject({ name: 'AbortError' })
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('returns a revision-bound buffer lease and releases intermediates first', async () => {
    const f = await fixture()
    const rendering = renderStudioArrangement(
      f.project,
      [f.asset],
      () => Promise.resolve(f.blob),
      { createContext: f.createContext, measureLatencies: async () => [0] },
    )
    await vi.waitFor(() => expect(f.startRendering).toHaveBeenCalledOnce())
    f.finish()
    const result = await rendering
    expect(result).toMatchObject({
      projectId: f.project.id,
      revision: f.project.revision,
    })
    expect(studioReservedMemoryBytes()).toBe(result.buffer.length * 2 * 4)
    result.release()
    result.release()
    expect(studioReservedMemoryBytes()).toBe(0)
  })
  it("plays a lane's matching render instead of its chain, reads none of its takes, and makes chunks audio only as the render nears them", async () => {
    // Arrange: twelve seconds, three four-second chunks.
    const f = await fixture()
    const song = frozenSong(f, 12)
    const steps: { at: number; resume: () => void }[] = []
    Object.assign(f.ctx, {
      suspend: (at: number) =>
        new Promise<void>((resume) => steps.push({ at, resume })),
      resume: () => Promise.resolve(),
    })
    const read = vi.fn(() => Promise.resolve(f.blob))
    const playing = () => f.ctx.ofType<PlaybackSource>('source').length

    // Act: the render stops every two seconds for the next four.
    const rendering = renderStudioArrangement(
      song.project,
      [song.asset],
      read,
      {
        createContext: f.createContext,
        measureLatencies: async () => [0],
        frozen: song.frozen,
      },
    )
    await vi.waitFor(() => expect(f.startRendering).toHaveBeenCalledOnce())
    const counts = [playing()]
    for (const step of steps) {
      f.ctx.currentTime = step.at
      step.resume()
      await flush()
      counts.push(playing())
    }
    f.finish()
    ;(await rendering).release()

    // Assert
    expect(read).not.toHaveBeenCalled()
    expect(steps.map((step) => step.at)).toEqual([2, 4, 6, 8, 10, 12])
    expect(counts).toEqual([1, 2, 2, 3, 3, 3, 3])
  })

  it("writes a lane's line as the render nears it, a few seconds ahead, as Play writes it", async () => {
    // Arrange: twelve seconds, the lane's volume line falling a decibel every 200 ms.
    const f = await fixture()
    const frames = 12 * 48000
    const blob = await encodeCanonicalPcm(toneAudio(frames))
    const asset = {
      ...f.asset,
      normalizedFrameCount: frames,
      canonicalPcmByteLength: blob.size,
      canonicalPcmSha256: await sha256Bytes(await blob.arrayBuffer()),
    }
    const project = {
      ...f.project,
      tracks: [
        withStudioAutomation(f.project.tracks[0], 'volume', [
          { frame: 0, value: 0 },
          { frame: frames, value: -60 },
        ]),
      ],
      clips: f.project.clips.map((clip) => ({
        ...clip,
        startFrame: 0,
        sourceInFrame: 0,
        sourceOutFrame: frames,
        fades: { curve: 'linear-amplitude' as const },
      })),
    }
    const steps: { at: number; resume: () => void }[] = []
    Object.assign(f.ctx, {
      suspend: (at: number) =>
        new Promise<void>((resume) => steps.push({ at, resume })),
      resume: () => Promise.resolve(),
    })
    type Gain = ReturnType<PlaybackContext['createGain']>
    /** How far the stage's line is written: the gain told the most ramps is a stage. */
    const written = () => {
      const params = f.ctx
        .ofType<Gain>('gain')
        .map((gain) => gain.gain as PlaybackParam)
      const stage = params.reduce((most, param) =>
        param.linearRamps.length > most.linearRamps.length ? param : most,
      )
      return Math.max(...stage.linearRamps.map((ramp) => ramp.time))
    }

    // Act: the render stops every two seconds and writes on to four past it.
    const rendering = renderStudioArrangement(
      project,
      [asset],
      () => Promise.resolve(blob),
      { createContext: f.createContext, measureLatencies: async () => [0] },
    )
    await vi.waitFor(() => expect(f.startRendering).toHaveBeenCalledOnce())
    const ends = [written()]
    for (const step of steps) {
      f.ctx.currentTime = step.at
      step.resume()
      await flush()
      ends.push(written())
    }
    f.finish()
    ;(await rendering).release()

    // Assert: knots every 200 ms from 0.5 s, written to the first past each horizon.
    expect(steps.map((step) => step.at)).toEqual([2, 4, 6, 8, 10, 12])
    expect(ends.map((end) => Number(end.toFixed(6)))).toEqual([
      4.1, 6.1, 8.1, 10.1, 12.1, 12.5, 12.5,
    ])
  })

  it('renders a lane live when its render no longer matches it', async () => {
    // Arrange
    const f = await fixture()
    const stale = frozenSong(f, 1, 'a render from an edit ago').frozen
    const read = vi.fn(() => Promise.resolve(f.blob))

    // Act
    const rendering = renderStudioArrangement(f.project, [f.asset], read, {
      createContext: f.createContext,
      measureLatencies: async () => [0],
      frozen: stale,
    })
    await vi.waitFor(() => expect(f.startRendering).toHaveBeenCalledOnce())
    f.finish()
    ;(await rendering).release()

    // Assert
    expect(read).toHaveBeenCalledExactlyOnceWith(f.asset.id)
  })
})
