// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { reserveStudioMemory, studioReservedMemoryBytes, studioWorkingBytes, } from '@/lib/studio/memory-budget'
import { sampledAudio, toneAudio } from './audio.fixture'
import { decodeCanonicalPcm, sha256Bytes } from './canonical-pcm'
import type { PcmAudio } from './import-limits'
import type { StudioAssetInfo } from './prepare-studio-asset'
import { prepareStudioAsset, prepareStudioAssetFrom, validatePreparedStudioAsset, validatePreparedStudioBytes, } from './prepare-studio-asset'

const info: StudioAssetInfo = {
  id: 'asset-1',
  projectId: 'project-1',
  originalName: 'take.wav',
  provenance: { kind: 'file', importedAt: '2026-10-26T10:00:00.000Z' },
}

function decoder(audio: PcmAudio = toneAudio()) {
  const context = {
    sampleRate: 48_000,
    decodeAudioData: vi.fn(async () => audio),
    close: vi.fn(),
    resume: vi.fn(),
  }
  return { context, createDecodeContext: vi.fn(() => context) }
}

describe('Studio asset preparation', () => {
  it('decodes once at 48 kHz, preserves both sources and stores preparation separately', async () => {
    const audio = toneAudio(24000, 2, 0.002)
    const originalSamples = audio.getChannelData(0).slice()
    const { context, createDecodeContext } = decoder(audio)
    const blob = new Blob(['encoded source'], { type: 'audio/wav' })
    const data = await prepareStudioAsset(blob, info, { createDecodeContext })
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(context.close).not.toHaveBeenCalled()
    expect(context.resume).not.toHaveBeenCalled()
    expect(data.original).toBe(blob)
    expect(data.asset.sha256).toBe(await sha256Bytes(await blob.arrayBuffer()))
    expect(data.asset).toMatchObject({
      channels: 2,
      normalizedFrameCount: 24000,
      normalizedSampleRate: 48000,
      importVersion: 1,
      canonicalPcmByteLength: 32 + 24000 * 2 * 4,
    })
    expect(data.asset.preparation.gainDb).toBeGreaterThan(0)
    const canonical = await decodeCanonicalPcm(data.canonicalPcm, data.asset)
    expect(canonical.getChannelData(0)).toEqual(originalSamples)
    await validatePreparedStudioAsset(data)
  })

  it('rejects unsupported channels, rate, duration, corrupt samples and decoder failures', async () => {
    const blob = new Blob(['audio'])
    for (const [audio, message] of [
      [sampledAudio([[0], [0], [0]]), 'mono or stereo'],
      [sampledAudio([[0]], 44100), '48 kHz'],
      [sampledAudio([[0, 0, 0]]), 'too long'],
      [sampledAudio([[NaN]]), 'invalid samples'],
    ] as const) {
      await expect(
        prepareStudioAsset(blob, info, {
          createDecodeContext: decoder(audio).createDecodeContext,
          limits: { maxFrames: 2 },
        }),
      ).rejects.toThrow(message)
    }
    await expect(
      prepareStudioAsset(blob, info, {
        createDecodeContext: () => ({
          sampleRate: 48000,
          decodeAudioData: async () => {
            throw new Error('Codec')
          },
        }),
      }),
    ).rejects.toThrow('could not read')
    await expect(
      prepareStudioAsset(blob, info, {
        createDecodeContext: () => ({
          sampleRate: 44100,
          decodeAudioData: vi.fn(),
        }),
      }),
    ).rejects.toThrow('offline context')
  })

  it('rejects encoded and transient budgets before creating a decoder', async () => {
    const { createDecodeContext } = decoder()
    await expect(
      prepareStudioAsset(new Blob([]), info, { createDecodeContext }),
    ).rejects.toThrow('empty')
    await expect(
      prepareStudioAsset(new Blob(['large']), info, {
        createDecodeContext,
        limits: { maxEncodedBytes: 2 },
      }),
    ).rejects.toThrow('too large')
    await expect(
      prepareStudioAsset(new Blob(['a']), info, {
        createDecodeContext,
        limits: { maxWorkingBytes: 1000 },
      }),
    ).rejects.toThrow('memory')
    expect(createDecodeContext).not.toHaveBeenCalled()
  })

  it('admits decode memory at the decoded length, not the five-minute maximum', async () => {
    let finish!: (audio: PcmAudio) => void
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const pending = prepareStudioAsset(new Blob(['a']), info, {
      createDecodeContext: () => ({
        sampleRate: 48000,
        decodeAudioData: () => {
          started()
          return new Promise((resolve) => {
            finish = resolve
          })
        },
      }),
    })
    await ready
    // Before the decode reports its length, only the read copies and analysis.
    expect(studioReservedMemoryBytes()).toBeLessThan(1024 * 1024)
    finish(toneAudio(4800, 2))
    await pending
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('retains the single preparation slot while an aborted native decode is settling', async () => {
    let finish!: (audio: PcmAudio) => void
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const abort = new AbortController()
    const pending = prepareStudioAsset(new Blob(['a']), info, {
      signal: abort.signal,
      createDecodeContext: () => ({
        sampleRate: 48000,
        decodeAudioData: () => {
          started()
          return new Promise((resolve) => {
            finish = resolve
          })
        },
      }),
    })
    const cancelled = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    })
    await ready
    const reserved = studioReservedMemoryBytes()
    expect(reserved).toBeGreaterThan(0)
    abort.abort()
    expect(studioReservedMemoryBytes()).toBe(reserved)
    const read = vi.fn(async () => new Blob(['b']))
    await expect(prepareStudioAssetFrom(read, info)).rejects.toThrow(
      'still finishing',
    )
    expect(read).not.toHaveBeenCalled()
    finish(sampledAudio([[0]]))
    await cancelled
    expect(studioReservedMemoryBytes()).toBe(0)
    const successful = await prepareStudioAsset(
      new Blob(['b']),
      info,
      decoder(sampledAudio([[0]])),
    )
    expect(successful.asset.normalizedFrameCount).toBe(1)
  })

  it('admits shared memory before reading a kept source and releases on failed read', async () => {
    const release = reserveStudioMemory(studioWorkingBytes() - 1024)
    const read = vi.fn(async () => new Blob(['a']))
    try {
      await expect(
        prepareStudioAssetFrom(read, info, { encodedByteLength: 1 }),
      ).rejects.toThrow('memory')
      expect(read).not.toHaveBeenCalled()
    } finally {
      release()
    }
    const failedRead = vi.fn(async () => {
      throw new Error('Missing')
    })
    await expect(
      prepareStudioAssetFrom(failedRead, info, { encodedByteLength: 1 }),
    ).rejects.toThrow('Missing')
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('does no read when cancelled and rejects tampered original bytes on restore', async () => {
    const abort = new AbortController()
    abort.abort()
    const read = vi.fn(async () => new Blob(['b']))
    await expect(
      prepareStudioAssetFrom(read, info, { signal: abort.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(read).not.toHaveBeenCalled()
    const data = await prepareStudioAsset(
      new Blob(['abc']),
      info,
      decoder(sampledAudio([[0]])),
    )
    await expect(
      validatePreparedStudioAsset({ ...data, original: new Blob(['xyz']) }),
    ).rejects.toThrow('checksum')
    await expect(
      validatePreparedStudioAsset({
        ...data,
        asset: {
          ...data.asset,
          preparation: { algorithmVersion: 'bs1770-48k-v1', gainDb: Infinity },
        },
      }),
    ).rejects.toThrow()
  })

  it('checks audio held as bytes without reserving or copying it, and rejects tampered bytes', async () => {
    const data = await prepareStudioAsset(
      new Blob(['abc']),
      info,
      decoder(sampledAudio([[0, 0.5]])),
    )
    const bytes = {
      asset: data.asset,
      original: await data.original.arrayBuffer(),
      canonicalPcm: await data.canonicalPcm.arrayBuffer(),
    }
    const held = studioReservedMemoryBytes()

    await expect(validatePreparedStudioBytes(bytes)).resolves.toBeUndefined()
    expect(studioReservedMemoryBytes()).toBe(held)
    await expect(
      validatePreparedStudioBytes({
        ...bytes,
        original: new TextEncoder().encode('xyz').buffer,
      }),
    ).rejects.toThrow('checksum')
    await expect(
      validatePreparedStudioBytes({
        ...bytes,
        original: new TextEncoder().encode('abcd').buffer,
      }),
    ).rejects.toThrow('metadata')
  })
})
