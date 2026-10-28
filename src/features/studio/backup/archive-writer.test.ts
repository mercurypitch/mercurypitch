// Studio archive writer — the same stored ZIP bytes as ever, written to a file a batch at a time, stopped by a failed check or Cancel.
import { Blob as NodeBlob } from 'node:buffer'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseStudioResource, reserveStudioMemory, setStudioWorkingBytes, studioReservedMemoryBytes, } from '@/lib/studio/memory-budget'
import type { StudioArchiveSink } from './archive-writer'
import { createStudioArchiveWriter, STUDIO_ARCHIVE_BATCH_BYTES, studioArchiveHeldBytes, writeStudioArchive, } from './archive-writer'

const MiB = 1024 * 1024
const pattern = (length: number, seed: number) =>
  Uint8Array.from({ length }, (_, index) => (index * 31 + seed) & 255)
const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex')

/** Entries that cross 16 KiB slices, and an empty one. */
const entries = () =>
  new Map<string, Blob>([
    ['manifest.json', new Blob(['{"format":"mercurypitch-studio"}'])],
    ['assets/0/original.bin', new Blob([pattern(40_000, 1)])],
    ['assets/0/canonical.pcm', new Blob([pattern(70_001, 2)])],
    ['assets/1/original.bin', new Blob([])],
  ])

/**
 * The writer before backups could stream wrote these bytes for `entries()`
 * at 12:00:00 local time on 28 October 2026: SHA-256 measured on that
 * writer under UTC, America/New_York and Asia/Kolkata.
 */
const OLD_WRITER_SHA256 =
  '6549e4d9d0e5085bad82c5d6efb2d0c85654c897ed16d95e3f33d26765d102a9'

/** A file on disk: it keeps what it is given and reserves one batch. */
function fileSink() {
  const written: Uint8Array[] = []
  let release = () => {}
  const sink: StudioArchiveSink & {
    bytes(): Uint8Array
    largest: number
    free(): void
  } = {
    largest: 0,
    reserve(archiveBytes) {
      release = reserveStudioMemory(studioArchiveHeldBytes(archiveBytes, false))
    },
    async write(parts) {
      const size = parts.reduce((sum, part) => sum + part.byteLength, 0)
      sink.largest = Math.max(sink.largest, size)
      written.push(...parts)
    },
    bytes: () => Buffer.concat(written),
    free: () => release(),
  }
  return sink
}

describe('Studio archive writer', () => {
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 12, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    setStudioWorkingBytes(null)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('writes the bytes the old writer wrote, in memory and to a file alike', async () => {
    const archive = await writeStudioArchive(entries())
    const inMemory = new Uint8Array(await archive.arrayBuffer())
    releaseStudioResource(archive)

    const sink = fileSink()
    const writer = createStudioArchiveWriter(sink)
    for (const [path, blob] of entries()) await writer.add(path, blob)
    await writer.finish()
    writer.terminate()
    // Stored buffers stream as views of themselves; the bytes are the same.
    const buffers = fileSink()
    const fromBuffers = createStudioArchiveWriter(buffers)
    for (const [path, blob] of entries())
      await fromBuffers.add(path, await blob.arrayBuffer())
    await fromBuffers.finish()
    fromBuffers.terminate()

    expect(sha256(inMemory)).toBe(OLD_WRITER_SHA256)
    expect(sha256(sink.bytes())).toBe(OLD_WRITER_SHA256)
    expect(sha256(buffers.bytes())).toBe(OLD_WRITER_SHA256)
  })

  it('hands a file one batch at a time, so a 20 MiB entry fits a budget that could not hold it', async () => {
    const audio = new Blob([new Uint8Array(20 * MiB)])
    setStudioWorkingBytes(4 * MiB)
    // Kept in memory, the archive needs its own size and a fold.
    await expect(
      writeStudioArchive(
        new Map([
          ['manifest.json', new Blob(['{}'])],
          ['assets/0/canonical.pcm', audio],
        ]),
      ),
    ).rejects.toThrow(/Studio needs more memory/)

    const sink = fileSink()
    sink.reserve(20 * MiB)
    const writer = createStudioArchiveWriter(sink)
    await writer.add('manifest.json', new Blob(['{}']))
    await writer.add('assets/0/canonical.pcm', audio)
    await writer.finish()
    writer.terminate()
    sink.free()

    expect(sink.bytes().byteLength).toBeGreaterThan(20 * MiB)
    // One batch and the 16 KiB slice that tipped it over.
    expect(sink.largest).toBeLessThanOrEqual(
      STUDIO_ARCHIVE_BATCH_BYTES + 16 * 1024 + 1024,
    )
  })

  it('stops an entry whose check fails before its last slice reaches the file', async () => {
    const sink = fileSink()
    const writer = createStudioArchiveWriter(sink)
    let slices = 0
    await writer.add('manifest.json', new Blob(['{}']))
    await expect(
      writer.add(
        'assets/0/canonical.pcm',
        new Blob([pattern(80 * 16_384, 3)]),
        {
          update: () => {
            slices++
          },
          finish: () => {
            throw new Error('Studio audio checksum failed')
          },
        },
      ),
    ).rejects.toThrow('Studio audio checksum failed')
    writer.terminate()

    // Every slice reached the check. The first batch reached the file; the
    // last slice, which the check refused, never did.
    expect(slices).toBe(80)
    expect(sink.bytes().byteLength).toBeGreaterThanOrEqual(MiB)
    expect(sink.bytes().byteLength).toBeLessThan(80 * 16_384)
  })

  it('stops between slices when the backup is cancelled', async () => {
    const cancel = new AbortController()
    const sink = fileSink()
    const writer = createStudioArchiveWriter(sink, cancel.signal)
    let slices = 0
    await expect(
      writer.add('assets/0/canonical.pcm', new Blob([pattern(80_000, 4)]), {
        update: () => {
          if (++slices === 2) cancel.abort()
        },
        finish: () => {},
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    writer.terminate()
    expect(slices).toBe(2)
  })

  it('refuses a second entry at the same path and an archive without its manifest', async () => {
    const writer = createStudioArchiveWriter(fileSink())
    await writer.add('assets/0/original.bin', new Blob(['a']))
    await expect(
      writer.add('assets/0/original.bin', new Blob(['b'])),
    ).rejects.toThrow('invalid entry count')
    await expect(writer.finish()).rejects.toThrow('invalid entry count')
    await expect(writer.add('../escape', new Blob(['c']))).rejects.toThrow(
      'unsafe entry path',
    )
    writer.terminate()
  })
})
