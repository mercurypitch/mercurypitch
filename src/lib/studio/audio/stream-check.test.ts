// Studio stream checks — a take streamed 16 KiB at a time passes or fails as it would whole: header, samples, size, type and hash.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioAsset } from '../model/types'
import { encodeCanonicalPcm, sha256Bytes } from './canonical-pcm'
import { checkCanonicalStream, checkOriginalStream } from './stream-check'

const FRAMES = 20_000

async function take(): Promise<{
  asset: StudioAsset
  original: Blob
  canonical: Uint8Array<ArrayBuffer>
}> {
  const left = Float32Array.from({ length: FRAMES }, (_, i) => Math.sin(i / 9))
  const right = Float32Array.from({ length: FRAMES }, (_, i) => Math.cos(i / 7))
  const pcm = await encodeCanonicalPcm({
    sampleRate: 48_000,
    numberOfChannels: 2,
    length: FRAMES,
    getChannelData: (channel) => (channel === 0 ? left : right),
  })
  const canonical = new Uint8Array(await pcm.arrayBuffer())
  const raw = Uint8Array.from({ length: 30_000 }, (_, i) => (i * 7) & 255)
  return {
    original: new Blob([raw], { type: 'audio/mpeg' }),
    canonical,
    asset: {
      id: 'take',
      projectId: 'song',
      sha256: await sha256Bytes(raw.buffer),
      mimeType: 'audio/mpeg',
      byteLength: raw.byteLength,
      channels: 2,
      normalizedSampleRate: 48_000,
      normalizedFrameCount: FRAMES,
      importVersion: 1,
      canonicalPcmId: 'take-pcm-v1',
      canonicalPcmSha256: await sha256Bytes(canonical.slice().buffer),
      canonicalPcmByteLength: canonical.byteLength,
      preparation: { algorithmVersion: 'bs1770-48k-v1', gainDb: 0 },
      provenance: { kind: 'file', importedAt: '2026-10-28T12:00:00.000Z' },
    },
  }
}

/** Feed the bytes as a backup reads them: 16 KiB slices, then finish. */
function stream(
  check: { update(bytes: Uint8Array): void; finish(): void },
  bytes: Uint8Array,
): void {
  for (let at = 0; at < bytes.byteLength; at += 16_384)
    check.update(bytes.slice(at, Math.min(bytes.byteLength, at + 16_384)))
  check.finish()
}

describe('Studio stream checks', () => {
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('passes a sound take streamed in slices', async () => {
    const { asset, original, canonical } = await take()
    const blob = new Blob([canonical])
    const bytes = new Uint8Array(await original.arrayBuffer())
    expect(() =>
      stream(checkCanonicalStream(blob, asset), canonical),
    ).not.toThrow()
    expect(() =>
      stream(checkOriginalStream(original, asset), bytes),
    ).not.toThrow()
    // Stored buffers pass the same checks.
    expect(() =>
      stream(checkCanonicalStream(canonical.slice().buffer, asset), canonical),
    ).not.toThrow()
    expect(() =>
      stream(checkOriginalStream(bytes.slice().buffer, asset), bytes),
    ).not.toThrow()
  })

  it('stops at the slice with a sample that is not a number, before the hash', async () => {
    const { asset, canonical } = await take()
    const damaged = canonical.slice()
    // Past the second slice: only a check of every slice finds it.
    new DataView(damaged.buffer).setFloat32(40_000, Number.NaN, true)
    const check = checkCanonicalStream(new Blob([damaged]), asset)
    check.update(damaged.slice(0, 16_384))
    check.update(damaged.slice(16_384, 32_768))
    expect(() => check.update(damaged.slice(32_768, 49_152))).toThrow(
      'invalid samples',
    )
  })

  it('fails a take whose bytes or header differ from its metadata', async () => {
    const { asset, original, canonical } = await take()
    const changed = canonical.slice()
    changed[100] ^= 1
    expect(() =>
      stream(checkCanonicalStream(new Blob([changed]), asset), changed),
    ).toThrow('checksum failed')

    const header = canonical.slice()
    new DataView(header.buffer).setUint32(16, FRAMES - 1, true)
    expect(() =>
      checkCanonicalStream(new Blob([header]), asset).update(
        header.slice(0, 16_384),
      ),
    ).toThrow('does not match its saved metadata')

    expect(() =>
      checkOriginalStream(new Blob([original], { type: 'audio/wav' }), asset),
    ).toThrow('does not match its saved metadata')
    const other = new Uint8Array(await original.arrayBuffer())
    other[0] ^= 1
    expect(() => stream(checkOriginalStream(original, asset), other)).toThrow(
      'checksum failed',
    )
  })
})
