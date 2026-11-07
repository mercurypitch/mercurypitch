// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { sampledAudio } from './audio.fixture'
import type { CanonicalPcmMetadata } from './canonical-pcm'
import { CANONICAL_PCM_HEADER_BYTES, decodeCanonicalPcm, encodeCanonicalPcm, sha256Bytes, validateCanonicalPcm, validateCanonicalPcmBytes, } from './canonical-pcm'

async function fixture() {
  const audio = sampledAudio([
    [0, 0.25, -0.5, 1],
    [-1, 0, 0.75, -0.25],
  ])
  const blob = await encodeCanonicalPcm(audio)
  const metadata: CanonicalPcmMetadata = {
    channels: 2,
    normalizedSampleRate: 48_000,
    normalizedFrameCount: 4,
    canonicalPcmByteLength: blob.size,
    canonicalPcmSha256: await sha256Bytes(await blob.arrayBuffer()),
  }
  return { audio, blob, metadata }
}

describe('canonical Studio PCM', () => {
  it('writes the specified little-endian header and unamplified planar samples', async () => {
    const { blob, metadata } = await fixture()
    const bytes = await blob.arrayBuffer()
    const view = new DataView(bytes)
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('MPCM')
    expect([
      view.getUint16(4, true),
      view.getUint16(6, true),
      view.getUint32(8, true),
      view.getUint16(12, true),
    ]).toEqual([1, 32, 48000, 2])
    expect(view.getFloat32(32 + 4, true)).toBe(0.25)
    expect(view.getFloat32(32 + 4 * 4, true)).toBe(-1)
    const decoded = await decodeCanonicalPcm(blob, metadata)
    expect(Array.from(decoded.getChannelData(0))).toEqual([0, 0.25, -0.5, 1])
    expect(Array.from(decoded.getChannelData(1))).toEqual([-1, 0, 0.75, -0.25])
    expect(() => decoded.getChannelData(2)).toThrow('out of range')
  })

  it.each([
    ['version', 4, 2],
    ['rate', 8, 44100],
    ['channels', 12, 3],
    ['frames', 16, 0],
    ['payload', 20, 12],
    ['reserved', 24, 1],
  ])(
    'rejects corrupt %s even when its checksum is recomputed',
    async (_, offset, value) => {
      const { blob, metadata } = await fixture()
      const bytes = await blob.arrayBuffer()
      new DataView(bytes).setUint32(offset, value, true)
      const changed = new Blob([bytes])
      await expect(
        validateCanonicalPcm(changed, {
          ...metadata,
          canonicalPcmSha256: await sha256Bytes(bytes),
        }),
      ).rejects.toThrow()
    },
  )

  it('rejects checksum, size, metadata and nonfinite sample corruption', async () => {
    const { blob, metadata } = await fixture()
    await expect(
      validateCanonicalPcm(blob, {
        ...metadata,
        canonicalPcmSha256: '0'.repeat(64),
      }),
    ).rejects.toThrow('checksum')
    await expect(
      validateCanonicalPcm(blob.slice(0, blob.size - 1), metadata),
    ).rejects.toThrow('size')
    await expect(
      validateCanonicalPcm(blob, { ...metadata, normalizedFrameCount: 3 }),
    ).rejects.toThrow('metadata')
    const bytes = await blob.arrayBuffer()
    new DataView(bytes).setFloat32(CANONICAL_PCM_HEADER_BYTES, NaN, true)
    await expect(
      validateCanonicalPcm(new Blob([bytes]), {
        ...metadata,
        canonicalPcmSha256: await sha256Bytes(bytes),
      }),
    ).rejects.toThrow('invalid samples')
  })

  it('checks held bytes in place the same way: checksum, size, metadata and samples', async () => {
    const { blob, metadata } = await fixture()
    const bytes = await blob.arrayBuffer()
    await expect(
      validateCanonicalPcmBytes(bytes, metadata),
    ).resolves.toBeUndefined()
    await expect(
      validateCanonicalPcmBytes(bytes, {
        ...metadata,
        canonicalPcmSha256: '0'.repeat(64),
      }),
    ).rejects.toThrow('checksum')
    await expect(
      validateCanonicalPcmBytes(bytes.slice(0, bytes.byteLength - 1), metadata),
    ).rejects.toThrow('size')
    await expect(
      validateCanonicalPcmBytes(bytes, {
        ...metadata,
        normalizedFrameCount: 3,
      }),
    ).rejects.toThrow('metadata')
    new DataView(bytes).setFloat32(CANONICAL_PCM_HEADER_BYTES, NaN, true)
    await expect(
      validateCanonicalPcmBytes(bytes, {
        ...metadata,
        canonicalPcmSha256: await sha256Bytes(bytes),
      }),
    ).rejects.toThrow('invalid samples')
  })

  it('rejects truncated headers, over-budget PCM and cancelled reads before allocation', async () => {
    const { blob, metadata } = await fixture()
    await expect(
      validateCanonicalPcm(new Blob([new Uint8Array(8)]), {
        ...metadata,
        canonicalPcmByteLength: 8,
      }),
    ).rejects.toThrow('size')
    await expect(
      decodeCanonicalPcm(blob, metadata, { limits: { maxFrames: 2 } }),
    ).rejects.toThrow('size')
    await expect(
      decodeCanonicalPcm(blob, metadata, { limits: { maxWorkingBytes: 10 } }),
    ).rejects.toThrow('memory')
    const abort = new AbortController()
    abort.abort()
    await expect(
      decodeCanonicalPcm(blob, metadata, { signal: abort.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects invalid source dimensions and samples without silently downmixing', async () => {
    await expect(
      encodeCanonicalPcm(sampledAudio([[1], [1], [1]])),
    ).rejects.toThrow('mono or stereo')
    await expect(
      encodeCanonicalPcm(sampledAudio([[1]], 44100)),
    ).rejects.toThrow('48 kHz')
    await expect(
      encodeCanonicalPcm(sampledAudio([[Infinity]])),
    ).rejects.toThrow('invalid samples')
    await expect(encodeCanonicalPcm(sampledAudio([[]]))).rejects.toThrow(
      'empty',
    )
  })
})

async function int16Fixture() {
  const audio = sampledAudio([
    [0, 0.25, -0.5, 1, 0.3],
    [-1, 0, 0.75, -0.25, -0.3],
  ])
  const blob = await encodeCanonicalPcm(audio, { format: 'int16' })
  const metadata: CanonicalPcmMetadata = {
    channels: 2,
    normalizedSampleRate: 48_000,
    normalizedFrameCount: 5,
    canonicalPcmByteLength: blob.size,
    canonicalPcmSha256: await sha256Bytes(await blob.arrayBuffer()),
    canonicalPcmFormat: 'int16',
  }
  return { audio, blob, metadata }
}

describe("Save space's canonical PCM", () => {
  it('reads back through the same checks once its metadata names its format', async () => {
    const { audio, blob, metadata } = await int16Fixture()

    const decoded = await decodeCanonicalPcm(blob, metadata)

    expect(blob.size).toBe(32 + 5 * 2 * 2)
    // 0.3 is on no 16-bit grid, so the take is scaled to its peak of 1.
    const halfStep = Math.fround(1 / 32_767) / 2
    for (const channel of [0, 1]) {
      const read = decoded.getChannelData(channel)
      const source = audio.getChannelData(channel)
      for (let frame = 0; frame < 5; frame++)
        expect(Math.abs(read[frame] - source[frame])).toBeLessThanOrEqual(
          halfStep + 2 ** -24,
        )
    }
    await expect(
      validateCanonicalPcmBytes(await blob.arrayBuffer(), metadata),
    ).resolves.toBeUndefined()
  })

  it('is refused under the metadata of the other format, either way round', async () => {
    const { blob, metadata } = await int16Fixture()
    const asFloat: CanonicalPcmMetadata = {
      ...metadata,
      canonicalPcmFormat: undefined,
    }
    await expect(validateCanonicalPcm(blob, asFloat)).rejects.toThrow()

    const float = await fixture()
    await expect(
      validateCanonicalPcm(float.blob, {
        ...float.metadata,
        canonicalPcmFormat: 'int16',
      }),
    ).rejects.toThrow()
  })

  it.each([
    ['a zero step', 24, 0],
    ['a negative step', 28, -1],
    ['a step that is not a number', 24, NaN],
    ['a step whose multiples leave the float range', 28, 3e34],
  ])(
    'rejects %s even when its checksum is recomputed',
    async (_, offset, value) => {
      const { blob, metadata } = await int16Fixture()
      const bytes = await blob.arrayBuffer()
      new DataView(bytes).setFloat32(offset, value, true)
      await expect(
        validateCanonicalPcm(new Blob([bytes]), {
          ...metadata,
          canonicalPcmSha256: await sha256Bytes(bytes),
        }),
      ).rejects.toThrow('not supported')
    },
  )
})
