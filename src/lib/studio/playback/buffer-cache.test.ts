// Studio cache tests cover hash identity, direct canonical loading and deferred cancellation cleanup.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toneAudio } from '../audio/audio.fixture'
import { encodeCanonicalPcm, sha256Bytes } from '../audio/canonical-pcm'
import { reserveStudioMemory, setStudioWorkingBytes, StudioMemoryError, studioReservedMemoryBytes, } from '../memory-budget'
import { studioFixture } from '../model/model.test-fixtures'
import { createStudioBufferCache } from './buffer-cache'
import { PlaybackContext } from './playback.test-fixtures'

afterEach(() => setStudioWorkingBytes(null))

describe('Studio buffer ownership', () => {
  it('gives up buffers no run is playing when another reservation needs the room', async () => {
    const { asset } = studioFixture()
    const blob = await encodeCanonicalPcm(toneAudio(1000))
    const metadata = {
      ...asset,
      canonicalPcmSha256: await sha256Bytes(await blob.arrayBuffer()),
    }
    const ctx = new PlaybackContext()
    const cache = createStudioBufferCache()
    const read = vi.fn().mockResolvedValue(blob)
    setStudioWorkingBytes(100_000)
    const lease = await cache.acquire(
      [metadata],
      ctx.asContext,
      read,
      new AbortController().signal,
    )
    lease.release()
    const cached = studioReservedMemoryBytes()
    expect(cached).toBeGreaterThan(0)
    const other = reserveStudioMemory(100_000 - cached + 1)
    expect(studioReservedMemoryBytes()).toBe(100_000 - cached + 1)
    other()
    const again = await cache.acquire(
      [metadata],
      ctx.asContext,
      read,
      new AbortController().signal,
    )
    expect(read).toHaveBeenCalledTimes(2)
    again.release()
    cache.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('loads validated canonical samples once and shares duplicate asset content without gain mutation', async () => {
    const { asset } = studioFixture()
    const pcm = toneAudio(1000)
    const blob = await encodeCanonicalPcm(pcm)
    const metadata = {
      ...asset,
      canonicalPcmSha256: await sha256Bytes(await blob.arrayBuffer()),
    }
    const ctx = new PlaybackContext()
    const cache = createStudioBufferCache()
    const read = vi.fn().mockResolvedValue(blob)
    const first = await cache.acquire(
      [metadata],
      ctx.asContext,
      read,
      new AbortController().signal,
    )
    expect(first.buffers.get(asset.id)?.getChannelData(0)).toEqual(
      pcm.getChannelData(0),
    )
    first.release()
    const second = await cache.acquire(
      [{ ...metadata, id: 'duplicate' }],
      ctx.asContext,
      read,
      new AbortController().signal,
    )
    expect(second.buffers.get('duplicate')).toBe(first.buffers.get(asset.id))
    expect(read).toHaveBeenCalledOnce()
    cache.dispose()
    expect(studioReservedMemoryBytes()).toBe(4000)
    second.release()
    second.release()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('retains pending read reservations until an aborted read settles and never caches stale data', async () => {
    const { asset } = studioFixture()
    const ctx = new PlaybackContext()
    const cache = createStudioBufferCache()
    const abort = new AbortController()
    let resolve!: (blob: Blob) => void
    const read = () =>
      new Promise<Blob>((done) => {
        resolve = done
      })
    const loading = cache.acquire([asset], ctx.asContext, read, abort.signal)
    abort.abort()
    cache.dispose()
    expect(studioReservedMemoryBytes()).toBeGreaterThan(0)
    resolve(new Blob())
    await expect(loading).rejects.toMatchObject({ name: 'AbortError' })
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('evicts unrelated released buffers before admitting a new arrangement', async () => {
    const { asset } = studioFixture()
    const firstBlob = await encodeCanonicalPcm(toneAudio(1000))
    const changed = toneAudio(1000)
    changed.getChannelData(0)[0] = 0.5
    const secondBlob = await encodeCanonicalPcm(changed)
    const firstAsset = {
      ...asset,
      canonicalPcmSha256: await sha256Bytes(await firstBlob.arrayBuffer()),
    }
    const secondAsset = {
      ...asset,
      id: 'second',
      canonicalPcmSha256: await sha256Bytes(await secondBlob.arrayBuffer()),
    }
    const cache = createStudioBufferCache()
    const ctx = new PlaybackContext()
    const first = await cache.acquire(
      [firstAsset],
      ctx.asContext,
      async () => firstBlob,
      new AbortController().signal,
    )
    first.release()
    expect(studioReservedMemoryBytes()).toBe(4000)
    const second = await cache.acquire(
      [secondAsset],
      ctx.asContext,
      async () => secondBlob,
      new AbortController().signal,
    )
    expect(studioReservedMemoryBytes()).toBe(4000)
    expect(second.buffers.get('second')).not.toBe(first.buffers.get(asset.id))
    second.release()
    cache.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('keeps the buffers it holds when a set is too large to admit, so a smaller set that shares them reads nothing again', async () => {
    const { asset } = studioFixture()
    const blob = await encodeCanonicalPcm(toneAudio(1000))
    const small = {
      ...asset,
      canonicalPcmSha256: await sha256Bytes(await blob.arrayBuffer()),
    }
    // 480 MB of decoded samples: more than the cache ever holds.
    const huge = {
      ...small,
      id: 'huge',
      canonicalPcmSha256: 'f'.repeat(64),
      normalizedFrameCount: 120_000_000,
    }
    const ctx = new PlaybackContext()
    const cache = createStudioBufferCache()
    const read = vi.fn().mockResolvedValue(blob)
    const signal = new AbortController().signal
    ;(await cache.acquire([small], ctx.asContext, read, signal)).release()
    await expect(
      cache.acquire([small, huge], ctx.asContext, read, signal),
    ).rejects.toBeInstanceOf(StudioMemoryError)
    expect(studioReservedMemoryBytes()).toBe(4000)
    const lease = await cache.acquire([small], ctx.asContext, read, signal)
    expect(read).toHaveBeenCalledTimes(1)
    lease.release()
    cache.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})
