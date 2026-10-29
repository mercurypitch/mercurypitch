// Studio waveform tests — stored peaks first, a missing pyramid built once from checked audio, two reads at a time and bounded memory.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioAssetFixture } from '@/db/services/studio.fixture'
import { buildStudioPeaks, decodeStudioPeaks, encodeStudioPeaks, studioPeaksByteLength, } from '@/lib/studio/audio/waveform-peaks'
import { reserveStudioMemory, studioReservedMemoryBytes, studioWorkingBytes, } from '@/lib/studio/memory-budget'
import type { StudioAsset } from '@/lib/studio/model/types'
import type { StudioWaveformPeaksStore } from './waveform-resource'
import { createStudioWaveformResource } from './waveform-resource'

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  expect(studioReservedMemoryBytes()).toBe(0)
  vi.unstubAllGlobals()
})

function memoryStore(initial: Record<string, ArrayBuffer> = {}) {
  const rows = new Map(Object.entries(initial))
  return {
    rows,
    read: vi.fn(async (asset: StudioAsset) => rows.get(asset.id) ?? null),
    write: vi.fn(async (asset: StudioAsset, bytes: ArrayBuffer) => {
      rows.set(asset.id, bytes)
    }),
  } satisfies StudioWaveformPeaksStore & { rows: Map<string, ArrayBuffer> }
}

describe('Studio waveform resource', () => {
  it('draws a take from its stored peaks without reading its audio', async () => {
    const data = await studioAssetFixture('song')
    const samples = Float32Array.from({ length: 64 }, (_, frame) =>
      frame === 5 ? 0.5 : 0,
    )
    const store = memoryStore({
      [data.asset.id]: encodeStudioPeaks(
        buildStudioPeaks([samples], 64),
        data.asset.canonicalPcmSha256,
      ),
    })
    const read = vi.fn(() => Promise.resolve(data.canonicalPcm))
    const resource = createStudioWaveformResource(read, store)
    const peaks = await resource.get(data.asset)
    expect(read).not.toHaveBeenCalled()
    expect(peaks.levels[0].maxima[0] * peaks.scale).toBeCloseTo(0.5, 4)
    expect(store.write).not.toHaveBeenCalled()
    resource.dispose()
  })

  it('builds missing or damaged peaks once from the checked audio and keeps them', async () => {
    const data = await studioAssetFixture('song')
    const store = memoryStore({ [data.asset.id]: new ArrayBuffer(40) })
    const read = vi.fn(() => Promise.resolve(data.canonicalPcm))
    const resource = createStudioWaveformResource(read, store)
    const peaks = await resource.get(data.asset)
    expect(read).toHaveBeenCalledTimes(1)
    expect(peaks.frameCount).toBe(data.asset.normalizedFrameCount)
    await vi.waitFor(() => expect(store.write).toHaveBeenCalledTimes(1))
    expect(
      decodeStudioPeaks(store.rows.get(data.asset.id)!, data.asset),
    ).not.toBeNull()
    // The fixture is a 0.2 sine: its peaks say so.
    expect(Math.max(...peaks.levels[0].maxima) * peaks.scale).toBeCloseTo(
      0.2,
      2,
    )
    resource.dispose()
  })

  it('reads at most two takes at once and shares one result between duplicate clips', async () => {
    const takes = await Promise.all(
      ['one', 'two', 'three'].map((id) => studioAssetFixture('song', id)),
    )
    const releases = new Map<string, () => void>()
    const read = vi.fn(
      (id: string) =>
        new Promise<Blob>((resolve) =>
          releases.set(id, () =>
            resolve(takes.find((take) => take.asset.id === id)!.canonicalPcm),
          ),
        ),
    )
    const resource = createStudioWaveformResource(read)
    const first = resource.get(takes[0].asset)
    expect(resource.get(takes[0].asset)).toBe(first)
    const rest = takes.slice(1).map((take) => resource.get(take.asset))
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(read.mock.calls).toEqual([['one'], ['two']])
    releases.get('one')!()
    await first
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(3))
    releases.get('two')!()
    releases.get('three')!()
    await Promise.all(rest)
    resource.dispose()
  })

  it('rejects corrupt samples and retries failed bytes without retaining the failed cache entry', async () => {
    const data = await studioAssetFixture('song')
    const read = vi
      .fn()
      .mockResolvedValueOnce(new Blob(['broken']))
      .mockResolvedValueOnce(data.canonicalPcm)
    const resource = createStudioWaveformResource(read)
    await expect(resource.get(data.asset)).rejects.toThrow()
    await expect(resource.get(data.asset)).resolves.toMatchObject({
      frameCount: data.asset.normalizedFrameCount,
    })
    resource.dispose()
    await expect(
      resource.get({ ...data.asset, id: 'new' }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('admits waveform memory before reading and retains only the peaks afterward', async () => {
    const data = await studioAssetFixture('song')
    const read = vi.fn(() => Promise.resolve(data.canonicalPcm))
    const resource = createStudioWaveformResource(read)
    const releaseOtherAudio = reserveStudioMemory(studioWorkingBytes())
    try {
      await expect(resource.get(data.asset)).rejects.toMatchObject({
        name: 'StudioWaveformBusyError',
      })
      expect(read).not.toHaveBeenCalled()
      expect(studioReservedMemoryBytes()).toBe(studioWorkingBytes())
    } finally {
      releaseOtherAudio()
    }
    await resource.get(data.asset)
    expect(studioReservedMemoryBytes()).toBe(
      studioPeaksByteLength(data.asset.normalizedFrameCount),
    )
    resource.dispose()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('holds an active read reservation after disposal until the uncancellable read settles', async () => {
    const data = await studioAssetFixture('song')
    let finish!: (blob: Blob) => void
    const read = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          finish = resolve
        }),
    )
    const resource = createStudioWaveformResource(read)
    const request = resource.get(data.asset)
    await vi.waitFor(() => expect(read).toHaveBeenCalled())
    const reserved = studioReservedMemoryBytes()
    expect(reserved).toBeGreaterThan(data.canonicalPcm.size)
    resource.dispose()
    expect(studioReservedMemoryBytes()).toBe(reserved)
    finish(data.canonicalPcm)
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})
