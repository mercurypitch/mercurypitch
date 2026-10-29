// ============================================================
// Studio archive codec — reading bounded ZIP streams with exact entry names.
// ============================================================

import { Unzip, UnzipInflate } from 'fflate'
import { reserveStudioMemory, retainStudioResource, } from '@/lib/studio/memory-budget'
import { updateStudioCrc32 } from './crc32'

export const STUDIO_BACKUP_LIMITS = {
  archiveBytes: 512 * 1024 * 1024,
  totalBytes: 512 * 1024 * 1024,
  assetBytes: 256 * 1024 * 1024,
  manifestBytes: 2 * 1024 * 1024,
  entries: 257,
  inputChunkBytes: 16 * 1024,
  /**
   * An archive of stored entries (every backup Studio writes) is read this
   * much at a time: a 297 MiB backup in 75 reads, where 16 KiB pieces took
   * 18,990 and most of a restore's time.
   */
  storedChunkBytes: 4 * 1024 * 1024,
} as const
/**
 * Reading needs this much beyond the entries themselves. A stored entry is
 * copied straight from one input chunk; a deflated one can inflate a chunk
 * about a thousandfold, which the inflater hands over in one piece, so an
 * archive with any deflated entry is read 16 KiB at a time.
 */
const STORED_WORKING_BYTES = STUDIO_BACKUP_LIMITS.storedChunkBytes + 1024 * 1024
const INFLATE_WORKING_BYTES = 20 * 1024 * 1024

export class StudioBackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudioBackupError'
  }
}

export function studioBackupAssetPath(
  index: number,
  kind: 'original' | 'canonical',
): string {
  return `assets/${index}/${kind === 'original' ? 'original.bin' : 'canonical.pcm'}`
}

/** The largest an entry at this path may be; any other path is refused. */
export function studioBackupEntryLimit(path: string): number {
  if (path === 'manifest.json') return STUDIO_BACKUP_LIMITS.manifestBytes
  if (
    /^assets\/(0|[1-9][0-9]{0,2})\/(original\.bin|canonical\.pcm)$/.test(path)
  ) {
    return STUDIO_BACKUP_LIMITS.assetBytes
  }
  throw new StudioBackupError(
    'The project backup contains an unexpected or unsafe entry path.',
  )
}

function checkAbort(signal?: AbortSignal): void {
  signal?.throwIfAborted()
}

interface DirectoryEntry {
  size: number
  compressedSize: number
  compression: number
  crc32: number
}

/** Require the final directory too: a truncated stream can contain complete files. */
async function readDirectory(
  archive: Blob,
): Promise<Map<string, DirectoryEntry>> {
  if (archive.size < 22)
    throw new StudioBackupError('The project backup is incomplete.')
  const end = new DataView(await archive.slice(archive.size - 22).arrayBuffer())
  const count = end.getUint16(10, true)
  const bytes = end.getUint32(12, true)
  const offset = end.getUint32(16, true)
  if (
    end.getUint32(0, true) !== 0x06054b50 ||
    end.getUint16(4, true) !== 0 ||
    end.getUint16(6, true) !== 0 ||
    end.getUint16(8, true) !== count ||
    end.getUint16(20, true) !== 0 ||
    count > STUDIO_BACKUP_LIMITS.entries ||
    bytes > STUDIO_BACKUP_LIMITS.entries * 1024 ||
    offset + bytes !== archive.size - 22
  ) {
    throw new StudioBackupError(
      'The project backup has an unsupported or incomplete ZIP directory.',
    )
  }
  const data = new Uint8Array(
    await archive.slice(offset, offset + bytes).arrayBuffer(),
  )
  const view = new DataView(data.buffer)
  const entries = new Map<string, DirectoryEntry>()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let at = 0
  let total = 0
  while (at < bytes) {
    if (at + 46 > bytes || view.getUint32(at, true) !== 0x02014b50) {
      throw new StudioBackupError(
        'The project backup has a damaged ZIP directory.',
      )
    }
    const nameLength = view.getUint16(at + 28, true)
    const length =
      46 +
      nameLength +
      view.getUint16(at + 30, true) +
      view.getUint16(at + 32, true)
    if (at + length > bytes)
      throw new StudioBackupError(
        'The project backup has a damaged entry name.',
      )
    const name = decoder.decode(data.subarray(at + 46, at + 46 + nameLength))
    const limit = studioBackupEntryLimit(name)
    const size = view.getUint32(at + 24, true)
    const compressedSize = view.getUint32(at + 20, true)
    const compression = view.getUint16(at + 10, true)
    total += size
    if (
      entries.has(name) ||
      size > limit ||
      total > STUDIO_BACKUP_LIMITS.totalBytes ||
      compressedSize > archive.size ||
      (compression !== 0 && compression !== 8) ||
      (view.getUint16(at + 8, true) & 1) !== 0 ||
      view.getUint16(at + 34, true) !== 0 ||
      view.getUint32(at + 42, true) >= offset
    ) {
      throw new StudioBackupError(
        'The project backup has duplicate, oversized or unsupported entries.',
      )
    }
    entries.set(name, {
      size,
      compressedSize,
      compression,
      crc32: view.getUint32(at + 16, true),
    })
    at += length
  }
  if (entries.size !== count || !entries.has('manifest.json')) {
    throw new StudioBackupError('The project backup directory is incomplete.')
  }
  return entries
}

/**
 * Limits apply during inflation, before complete files are retained. Each
 * entry inflates into one buffer of its declared size, so the archive's
 * contents are held once: no parts list, no Blob copy of them.
 */
export async function readStudioArchive(
  archive: Blob,
  signal?: AbortSignal,
): Promise<Map<string, ArrayBuffer>> {
  if (archive.size === 0 || archive.size > STUDIO_BACKUP_LIMITS.archiveBytes) {
    throw new StudioBackupError(
      'The project backup exceeds the supported archive size.',
    )
  }
  const entries = new Map<string, ArrayBuffer>()
  const seen = new Set<string>()
  let total = 0
  let pending = 0
  const status: { failure: Error | null } = { failure: null }
  const directory = await readDirectory(archive)
  let expandedBytes = 0
  let deflated = false
  for (const entry of directory.values()) {
    expandedBytes += entry.size
    deflated ||= entry.compression === 8
  }
  // The caller owns the selected archive. The entries stay admitted through
  // restore; the working room goes as soon as reading ends.
  const release = reserveStudioMemory(expandedBytes)
  let releaseWorking: () => void
  try {
    releaseWorking = reserveStudioMemory(
      deflated ? INFLATE_WORKING_BYTES : STORED_WORKING_BYTES,
    )
  } catch (error) {
    release()
    throw error
  }
  let transferred = false
  const unzip = new Unzip((file) => {
    const limit = studioBackupEntryLimit(file.name)
    const declared = directory.get(file.name)
    if (
      !declared ||
      declared.compression !== file.compression ||
      (file.size !== undefined && file.size !== declared.compressedSize)
    ) {
      throw new StudioBackupError(
        'The project backup entry does not match its directory.',
      )
    }
    if (seen.has(file.name) || seen.size >= STUDIO_BACKUP_LIMITS.entries) {
      throw new StudioBackupError(
        'The project backup has duplicate or too many entries.',
      )
    }
    if (file.originalSize !== undefined && file.originalSize > limit) {
      throw new StudioBackupError(
        'An entry in the project backup exceeds its size limit.',
      )
    }
    seen.add(file.name)
    pending++
    const bytes = new Uint8Array(declared.size)
    let size = 0
    let crc32 = 0xffffffff
    file.ondata = (error, data, final) => {
      if (status.failure !== null) return
      if (error) {
        status.failure = error
        return
      }
      if (
        size + data.byteLength > Math.min(limit, declared.size) ||
        total + data.byteLength > STUDIO_BACKUP_LIMITS.totalBytes
      ) {
        status.failure = new StudioBackupError(
          'The expanded project backup exceeds its size limit.',
        )
        file.terminate()
        return
      }
      bytes.set(data, size)
      size += data.byteLength
      total += data.byteLength
      crc32 = updateStudioCrc32(crc32, data)
      if (final) {
        if (size !== declared.size) {
          status.failure = new StudioBackupError(
            'The project backup entry has an incorrect length.',
          )
          return
        }
        if ((crc32 ^ 0xffffffff) >>> 0 !== declared.crc32) {
          status.failure = new StudioBackupError(
            'The project backup entry checksum does not match its contents.',
          )
          return
        }
        entries.set(file.name, bytes.buffer)
        pending--
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  const step = deflated
    ? STUDIO_BACKUP_LIMITS.inputChunkBytes
    : STUDIO_BACKUP_LIMITS.storedChunkBytes
  try {
    for (let offset = 0; offset < archive.size; offset += step) {
      checkAbort(signal)
      const end = Math.min(archive.size, offset + step)
      const chunk = new Uint8Array(
        await archive.slice(offset, end).arrayBuffer(),
      )
      unzip.push(chunk, end === archive.size)
      if (status.failure !== null) throw status.failure
    }
    if (pending || entries.size !== directory.size) {
      throw new StudioBackupError('The project backup is incomplete.')
    }
    transferred = true
    return retainStudioResource(entries, release)
  } catch (error) {
    if (error instanceof StudioBackupError || signal?.aborted === true)
      throw error
    throw new StudioBackupError(
      'The project backup is not a readable ZIP archive.',
    )
  } finally {
    releaseWorking()
    if (!transferred) release()
  }
}
