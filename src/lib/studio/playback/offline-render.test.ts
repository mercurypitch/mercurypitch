// Studio offline ownership tests keep reservations through native cancellation and returned-buffer use.
import { describe, expect, it, vi } from 'vitest'
import { toneAudio } from '../audio/audio.fixture'
import { encodeCanonicalPcm, sha256Bytes } from '../audio/canonical-pcm'
import { studioReservedMemoryBytes } from '../memory-budget'
import { studioFixture } from '../model/model.test-fixtures'
import { renderStudioArrangement } from './offline-render'
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
})
