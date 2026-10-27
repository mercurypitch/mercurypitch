// Studio waveform tests — real samples, sequential ownership reads and bounded retained envelopes.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioAssetFixture } from '@/db/services/studio.fixture'
import { reserveStudioMemory, STUDIO_WORKING_BYTES, studioReservedMemoryBytes, } from '@/lib/studio/memory-budget'
import { buildStudioWaveform, createStudioWaveformResource, STUDIO_WAVEFORM_BUCKETS, } from './waveform-resource'

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  expect(studioReservedMemoryBytes()).toBe(0)
  vi.unstubAllGlobals()
})

describe('Studio waveform resource', () => {
  it('keeps actual stereo amplitude and silence within a fixed envelope allocation', async () => {
    const left = new Float32Array(20000)
    const right = new Float32Array(20000)
    left[100] = -0.25
    right[100] = 0.5
    const wave = await buildStudioWaveform({
      sampleRate: 48000,
      numberOfChannels: 2,
      length: left.length,
      getChannelData: (channel) => (channel === 0 ? left : right),
    })
    expect(wave.minima.length).toBeLessThanOrEqual(STUDIO_WAVEFORM_BUCKETS)
    expect(Math.min(...wave.minima)).toBe(-0.25)
    expect(Math.max(...wave.maxima)).toBe(0.5)
    expect(wave.maxima[0]).toBe(0)
    expect(wave.rms[0]).toBe(0)
    expect(Math.max(...wave.rms)).toBeGreaterThan(0)
    expect(Math.max(...wave.rms)).toBeLessThanOrEqual(0.5)
  })

  it('serializes canonical reads and shares one result between duplicate clips', async () => {
    const first = await studioAssetFixture('song', 'one')
    const second = await studioAssetFixture('song', 'two')
    let release!: (blob: Blob) => void
    const held = new Promise<Blob>((resolve) => {
      release = resolve
    })
    const read = vi.fn((id: string) =>
      id === 'one' ? held : Promise.resolve(second.canonicalPcm),
    )
    const resource = createStudioWaveformResource(read)
    const a = resource.get(first.asset)
    expect(resource.get(first.asset)).toBe(a)
    const b = resource.get(second.asset)
    await Promise.resolve()
    expect(read).toHaveBeenCalledTimes(1)
    release(first.canonicalPcm)
    await Promise.all([a, b])
    expect(read.mock.calls).toEqual([['one'], ['two']])
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

  it('admits waveform memory before reading and retains only the bounded envelope afterward', async () => {
    const data = await studioAssetFixture('song')
    const read = vi.fn(() => Promise.resolve(data.canonicalPcm))
    const resource = createStudioWaveformResource(read)
    const releaseOtherAudio = reserveStudioMemory(STUDIO_WORKING_BYTES)
    try {
      await expect(resource.get(data.asset)).rejects.toMatchObject({
        name: 'StudioWaveformBusyError',
      })
      expect(read).not.toHaveBeenCalled()
      expect(studioReservedMemoryBytes()).toBe(STUDIO_WORKING_BYTES)
    } finally {
      releaseOtherAudio()
    }
    const result = await resource.get(data.asset)
    expect(studioReservedMemoryBytes()).toBe(
      result.minima.byteLength +
        result.maxima.byteLength +
        result.rms.byteLength,
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
    await Promise.resolve()
    const reserved = studioReservedMemoryBytes()
    expect(reserved).toBeGreaterThan(data.canonicalPcm.size)
    resource.dispose()
    expect(studioReservedMemoryBytes()).toBe(reserved)
    finish(data.canonicalPcm)
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})
