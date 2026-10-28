// ============================================================
// Studio archive writer — a stored ZIP written entry by entry into a sink, so a backup can go straight to a file.
// ============================================================
//
// The bytes are the ones the writer has always made: entries in the order
// they are added, each stored as it is with a data descriptor, then the
// directory. Only where they go has changed. A sink that writes to a file
// holds one batch at a time; the in-memory sink, kept for browsers that
// cannot write a file, holds the whole archive.

import { Zip, ZipPassThrough } from 'fflate'
import { reserveStudioMemory, retainStudioResource, } from '@/lib/studio/memory-budget'
import { STUDIO_BACKUP_LIMITS, studioBackupEntryLimit, StudioBackupError, } from './archive-codec'

const MIB = 1024 * 1024
/** Written bytes leave the writer in batches of about this size. */
export const STUDIO_ARCHIVE_BATCH_BYTES = MIB
/** The in-memory sink folds its batches into one Blob at this size. */
const FOLD_BYTES = 8 * MIB

/** Where an archive's bytes go, in order. */
export interface StudioArchiveSink {
  /** Hold the memory this sink needs for an archive this large. Throws when it does not fit. */
  reserve(archiveBytes: number): void
  /** Take the next bytes. The writer reads no more audio until this settles. */
  write(parts: readonly Uint8Array<ArrayBuffer>[]): Promise<void>
}

/** Sees every slice of an entry before the archive does; throws to stop it. */
export interface StudioEntryCheck {
  update(bytes: Uint8Array): void
  finish(): void
}

export interface StudioArchiveWriter {
  /** Add the next entry, read 16 KiB at a time from a Blob or a buffer already held. */
  add(
    path: string,
    source: Blob | ArrayBuffer,
    check?: StudioEntryCheck,
  ): Promise<void>
  /** Write the directory. The archive is complete once this settles. */
  finish(): Promise<void>
  /** Stop: after a failure, or once finished. */
  terminate(): void
}

const ENTRY_COUNT = 'The project backup has an invalid entry count.'

/** Memory a sink needs for an archive of this size: all of it, or one batch. */
export function studioArchiveHeldBytes(
  archiveBytes: number,
  inMemory: boolean,
): number {
  return inMemory
    ? archiveBytes + Math.min(FOLD_BYTES, archiveBytes) + MIB
    : STUDIO_ARCHIVE_BATCH_BYTES + MIB
}

/** A slice of a Blob is read; a slice of a buffer is a view of it, never a copy. */
async function slice(
  source: Blob | ArrayBuffer,
  from: number,
  to: number,
): Promise<Uint8Array<ArrayBuffer>> {
  return source instanceof Blob
    ? new Uint8Array(await source.slice(from, to).arrayBuffer())
    : new Uint8Array(source, from, to - from)
}

export function createStudioArchiveWriter(
  sink: StudioArchiveSink,
  signal?: AbortSignal,
): StudioArchiveWriter {
  const paths = new Set<string>()
  let entryBytes = 0
  let outputBytes = 0
  let parts: Uint8Array<ArrayBuffer>[] = []
  let pendingBytes = 0
  const status: { complete: boolean; failure: Error | null } = {
    complete: false,
    failure: null,
  }
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      status.failure = error
      return
    }
    outputBytes += chunk.byteLength
    if (outputBytes > STUDIO_BACKUP_LIMITS.archiveBytes) {
      status.failure = new StudioBackupError(
        'The project backup exceeds the supported archive size.',
      )
      return
    }
    parts.push(new Uint8Array(chunk))
    pendingBytes += chunk.byteLength
    status.complete = final
  })

  async function flush(all: boolean): Promise<void> {
    if (status.failure !== null) throw status.failure
    if (pendingBytes === 0) return
    if (!all && pendingBytes < STUDIO_ARCHIVE_BATCH_BYTES) return
    const batch = parts
    parts = []
    pendingBytes = 0
    await sink.write(batch)
  }

  function admit(path: string, size: number): void {
    if (paths.has(path) || paths.size >= STUDIO_BACKUP_LIMITS.entries)
      throw new StudioBackupError(ENTRY_COUNT)
    entryBytes += size
    if (
      size > studioBackupEntryLimit(path) ||
      entryBytes > STUDIO_BACKUP_LIMITS.totalBytes
    )
      throw new StudioBackupError(
        'The project exceeds the supported backup size.',
      )
    paths.add(path)
  }

  return {
    async add(path, source, check) {
      const size = source instanceof Blob ? source.size : source.byteLength
      admit(path, size)
      signal?.throwIfAborted()
      const entry = new ZipPassThrough(path)
      zip.add(entry)
      if (size === 0) {
        check?.finish()
        entry.push(new Uint8Array(), true)
      }
      for (
        let offset = 0;
        offset < size;
        offset += STUDIO_BACKUP_LIMITS.inputChunkBytes
      ) {
        signal?.throwIfAborted()
        const end = Math.min(
          size,
          offset + STUDIO_BACKUP_LIMITS.inputChunkBytes,
        )
        const bytes = await slice(source, offset, end)
        // No entry ends in the archive before its check has passed.
        check?.update(bytes)
        if (end === size) check?.finish()
        entry.push(bytes, end === size)
        await flush(false)
      }
      await flush(false)
    },
    async finish() {
      if (!paths.has('manifest.json')) throw new StudioBackupError(ENTRY_COUNT)
      signal?.throwIfAborted()
      zip.end()
      if (status.failure !== null) throw status.failure
      if (!status.complete)
        throw new StudioBackupError(
          'The project backup could not be completed.',
        )
      await flush(true)
    },
    terminate: () => zip.terminate(),
  }
}

export interface StudioMemorySink extends StudioArchiveSink {
  /** The archive written so far. */
  blob(): Blob
  /** Give back the memory reserved for it. */
  free(): void
}

/** Keeps the archive in memory: the last resort when no file can be written. */
export function createStudioMemorySink(): StudioMemorySink {
  let folded = new Blob([], { type: 'application/zip' })
  let parts: Uint8Array<ArrayBuffer>[] = []
  let pendingBytes = 0
  let release = () => {}
  const free = () => {
    release()
    release = () => {}
  }
  return {
    reserve(archiveBytes) {
      free()
      release = reserveStudioMemory(studioArchiveHeldBytes(archiveBytes, true))
    },
    async write(batch) {
      for (const part of batch) {
        parts.push(part)
        pendingBytes += part.byteLength
      }
      if (pendingBytes < FOLD_BYTES) return
      folded = new Blob([folded, ...parts], { type: 'application/zip' })
      parts = []
      pendingBytes = 0
    },
    blob: () => new Blob([folded, ...parts], { type: 'application/zip' }),
    free,
  }
}

/** Store already-encoded audio without compression, in memory: an archive of known entries. */
export async function writeStudioArchive(
  entries: ReadonlyMap<string, Blob>,
  signal?: AbortSignal,
): Promise<Blob> {
  if (
    entries.size > STUDIO_BACKUP_LIMITS.entries ||
    !entries.has('manifest.json')
  ) {
    throw new StudioBackupError(ENTRY_COUNT)
  }
  let sourceBytes = 0
  for (const [path, blob] of entries) {
    sourceBytes += blob.size
    if (
      blob.size > studioBackupEntryLimit(path) ||
      sourceBytes > STUDIO_BACKUP_LIMITS.totalBytes
    ) {
      throw new StudioBackupError(
        'The project exceeds the supported backup size.',
      )
    }
  }
  const sink = createStudioMemorySink()
  sink.reserve(sourceBytes)
  let transferred = false
  const writer = createStudioArchiveWriter(sink, signal)
  try {
    for (const [path, blob] of entries) await writer.add(path, blob)
    await writer.finish()
    const result = sink.blob()
    transferred = true
    return retainStudioResource(result, sink.free)
  } finally {
    writer.terminate()
    if (!transferred) sink.free()
  }
}
