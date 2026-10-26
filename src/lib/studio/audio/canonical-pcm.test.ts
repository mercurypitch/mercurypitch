// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { sampledAudio } from './audio.fixture'
import type { CanonicalPcmMetadata } from './canonical-pcm'
import { CANONICAL_PCM_HEADER_BYTES, decodeCanonicalPcm, encodeCanonicalPcm, sha256Bytes, validateCanonicalPcm, } from './canonical-pcm'

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
