// The container is a bundle laid out flat in one file, and its whole
// promise is that a reader with only the header can compute where every
// part starts. These check that promise from both ends -- bytes written
// here parse back to the same manifest and the same offsets -- and that
// a file which is NOT one of ours is declined rather than guessed at.

import { describe, expect, it } from 'vitest'
import type { PortableBundleManifest } from '@/lib/portable/portable-bundle'
import { buildContainerBlob, CONTAINER_MAGIC, containerPartRanges, containerTotalBytes, encodeContainerHeader, parseContainerHead, } from '@/lib/portable/portable-container'

function manifestOf(parts: { id: string; bytes: number }[]) {
  return {
    format: 'mercurypitch-song',
    version: 1,
    song: {
      fileHash: 'hash-abc',
      title: 'A Song',
      durationSec: 121,
      quality: 'portable-128',
    },
    parts: parts.map((p) => ({
      id: p.id,
      bytes: p.bytes,
      sha256: 'x'.repeat(64),
      mime: 'audio/mp4',
    })),
  } as unknown as PortableBundleManifest
}

/** jsdom's Blob has no arrayBuffer(); the container builds Blobs. */
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Blob.prototype as any).arrayBuffer = function (
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as ArrayBuffer)
      fr.onerror = () => reject(fr.error as Error)
      fr.readAsArrayBuffer(this)
    })
  }
}

describe('portable container', () => {
  it('reads back the manifest it wrote', () => {
    const manifest = manifestOf([{ id: 'stem:vocal', bytes: 10 }])
    const head = parseContainerHead(encodeContainerHeader(manifest))
    expect(head.outcome).toBe('ok')
    if (head.outcome !== 'ok') return
    expect(head.header.manifest.song.title).toBe('A Song')
    expect(head.header.manifest.song.fileHash).toBe('hash-abc')
  })

  it('asks for exactly the bytes it still needs', () => {
    const bytes = encodeContainerHeader(manifestOf([{ id: 'prep', bytes: 4 }]))
    // A reader that fetched only the fixed header knows the magic and the
    // manifest length, and can ask once for the rest instead of guessing.
    const partial = parseContainerHead(bytes.subarray(0, 12))
    expect(partial.outcome).toBe('need-more')
    if (partial.outcome !== 'need-more') return
    expect(partial.wanted).toBe(bytes.byteLength)
    expect(parseContainerHead(bytes.subarray(0, partial.wanted)).outcome).toBe(
      'ok',
    )
  })

  it('declines a file that is not one of ours', () => {
    const good = encodeContainerHeader(manifestOf([{ id: 'prep', bytes: 4 }]))

    const wrongMagic = new Uint8Array(good)
    wrongMagic.set(new TextEncoder().encode('ZIP\0'), 0)
    expect(parseContainerHead(wrongMagic).outcome).toBe('unreadable')

    // A version from a future build: misreading a song is worse than
    // declining one, so this is not a best-effort parse.
    const fromTheFuture = new Uint8Array(good)
    new DataView(fromTheFuture.buffer).setUint32(4, 99, true)
    expect(parseContainerHead(fromTheFuture).outcome).toBe('unreadable')

    // A length that claims megabytes of manifest is corruption, and
    // following it would ask the transport for garbage.
    const absurdLength = new Uint8Array(good)
    new DataView(absurdLength.buffer).setUint32(8, 64 * 1024 * 1024, true)
    expect(parseContainerHead(absurdLength).outcome).toBe('unreadable')

    expect(parseContainerHead(new Uint8Array(0)).outcome).toBe('need-more')
  })

  it('puts every part where the manifest says it is', async () => {
    const manifest = manifestOf([
      { id: 'stem:vocal', bytes: 3 },
      { id: 'stem:instrumental', bytes: 5 },
      { id: 'prep', bytes: 2 },
    ])
    const parts = new Map([
      ['stem:vocal', new Uint8Array([1, 1, 1])],
      ['stem:instrumental', new Uint8Array([2, 2, 2, 2, 2])],
      ['prep', new Uint8Array([3, 3])],
    ])
    const blob = buildContainerBlob({
      manifest,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parts: parts as any,
    })
    expect(blob.size).toBe(containerTotalBytes(manifest))

    const all = new Uint8Array(await blob.arrayBuffer())
    expect(new TextDecoder().decode(all.subarray(0, 4))).toBe(CONTAINER_MAGIC)

    const head = parseContainerHead(all)
    expect(head.outcome).toBe('ok')
    if (head.outcome !== 'ok') return
    const ranges = containerPartRanges(head.header)

    // The point of the layout: slicing at the computed offsets returns
    // each part's own bytes, without reading anything in between.
    for (const [id, expected] of parts) {
      const range = ranges.get(id as never)
      expect(range).toBeDefined()
      if (range === undefined) continue
      expect(all.subarray(range.start, range.end)).toEqual(expected)
    }
  })

  it('refuses to build a container that would lie about its offsets', () => {
    const manifest = manifestOf([{ id: 'stem:vocal', bytes: 3 }])

    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buildContainerBlob({ manifest, parts: new Map() as any }),
    ).toThrow(/missing its stem:vocal part/)

    expect(() =>
      buildContainerBlob({
        manifest,
        // A part whose real length disagrees with the manifest would push
        // every later part's computed offset off by the difference.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts: new Map([['stem:vocal', new Uint8Array([1, 2])]]) as any,
      }),
    ).toThrow(/does not match its manifest size/)
  })
})
