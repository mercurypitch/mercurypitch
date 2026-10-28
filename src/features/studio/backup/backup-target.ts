// ============================================================
// Studio backup targets — where a backup is written: the file the person picks, a private file handed to downloads, or memory.
// ============================================================
//
// Chromium on desktop asks where to save first, then the archive streams into
// that file. Other browsers stream it into a file in the origin private file
// system, and the finished file downloads from disk, then goes. Only a browser
// with neither keeps the whole archive in memory, as every backup once did.
// Each holds one batch of the archive in memory, apart from that last one.

import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioArchiveSink } from './archive-writer'
import { createStudioMemorySink, studioArchiveHeldBytes, } from './archive-writer'

export interface StudioBackupTarget extends StudioArchiveSink {
  /** file: written where the person chose. download: handed to the browser's downloads once complete. */
  readonly kind: 'file' | 'download'
  /** The file's name. */
  readonly name: string
  /** How long a downloaded copy must stay readable once its download starts. */
  readonly keepMs: number
  /** Complete the file. A download target hands back the file to download. */
  close(): Promise<Blob | null>
  /** Drop what was written, or a downloaded copy once the download has it. */
  discard(): Promise<void>
}

/** The folder in the origin private file system that holds backups on their way to downloads. */
export const STUDIO_BACKUP_FOLDER = 'studio-backups'
/** A private copy this old belongs to no download still running. */
const STALE_MS = 10 * 60 * 1000
const PRIVATE_KEEP_MS = 60_000
const MEMORY_KEEP_MS = 10_000

interface SavePickerOptions {
  suggestedName: string
  types: { description: string; accept: Record<string, string[]> }[]
}
type SavePicker = (options: SavePickerOptions) => Promise<FileSystemFileHandle>
/** Chromium 110 and later can delete a file the person picked. */
type PickedHandle = FileSystemFileHandle & { remove?: () => Promise<void> }

/** A file name for a song's backup: its title without characters a file system refuses. */
export function studioBackupFileName(title: string | undefined): string {
  const name = (title ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 100)
  return `${name || 'Studio project'}.mpstudio`
}

function savePicker(): SavePicker | null {
  const host = globalThis as { showSaveFilePicker?: SavePicker }
  return typeof host.showSaveFilePicker === 'function'
    ? (options) => host.showSaveFilePicker!(options)
    : null
}

/** Batches arrive as parts; a file takes them as one write. */
function joined(
  parts: readonly Uint8Array<ArrayBuffer>[],
): Uint8Array<ArrayBuffer> {
  if (parts.length === 1) return parts[0]
  const bytes = new Uint8Array(
    parts.reduce((sum, part) => sum + part.byteLength, 0),
  )
  let at = 0
  for (const part of parts) {
    bytes.set(part, at)
    at += part.byteLength
  }
  return bytes
}

/** A file being written: it holds one batch at a time, never the archive. */
function streamingTarget(
  kind: 'file' | 'download',
  name: string,
  writable: FileSystemWritableFileStream,
  finish: () => Promise<Blob | null>,
  remove: () => Promise<void>,
): StudioBackupTarget {
  let release = () => {}
  let state: 'writing' | 'closed' | 'gone' = 'writing'
  const free = () => {
    release()
    release = () => {}
  }
  return {
    kind,
    name,
    keepMs: kind === 'download' ? PRIVATE_KEEP_MS : 0,
    reserve(archiveBytes) {
      free()
      release = reserveStudioMemory(studioArchiveHeldBytes(archiveBytes, false))
    },
    write: (parts) => writable.write(joined(parts)),
    async close() {
      free()
      await writable.close()
      state = 'closed'
      return finish()
    },
    async discard() {
      free()
      if (state === 'gone' || (state === 'closed' && kind === 'file')) return
      // Unclosed, the written bytes never reach the file; then the file goes.
      if (state === 'writing') await writable.abort().catch(() => undefined)
      state = 'gone'
      await remove().catch(() => undefined)
    },
  }
}

/**
 * Ask where to save, then open the file. Null when the person cancels; the
 * picker made nothing then. A refusal of any other kind, such as a click
 * too long ago to count, falls back to a download.
 */
async function pickedTarget(
  picker: SavePicker,
  name: string,
): Promise<StudioBackupTarget | 'cancelled' | null> {
  let handle: PickedHandle
  try {
    handle = await picker({
      suggestedName: name,
      types: [
        {
          description: 'Studio project backup',
          accept: { 'application/zip': ['.mpstudio'] },
        },
      ],
    })
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError'
      ? 'cancelled'
      : null
  }
  // Chromium creates the chosen file, empty, as soon as it is picked.
  const remove = () => handle.remove?.() ?? Promise.resolve()
  try {
    return streamingTarget(
      'file',
      handle.name,
      await handle.createWritable(),
      async () => null,
      remove,
    )
  } catch {
    await remove().catch(() => undefined)
    return null
  }
}

/** Remove private copies left by a tab that closed before it could. */
async function sweep(folder: FileSystemDirectoryHandle): Promise<void> {
  const entries = (
    folder as unknown as {
      entries(): AsyncIterable<[string, FileSystemHandle]>
    }
  ).entries()
  for await (const [entry, handle] of entries) {
    if (handle.kind !== 'file') continue
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      if (Date.now() - file.lastModified > STALE_MS)
        await folder.removeEntry(entry)
    } catch {
      // Another tab still writing it holds it; it is not stale.
    }
  }
}

/** A file in the origin private file system, downloaded once complete. */
async function privateTarget(name: string): Promise<StudioBackupTarget | null> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.storage?.getDirectory !== 'function' ||
    typeof FileSystemFileHandle === 'undefined' ||
    typeof FileSystemFileHandle.prototype.createWritable !== 'function'
  )
    return null
  const root = await navigator.storage.getDirectory()
  const folder = await root.getDirectoryHandle(STUDIO_BACKUP_FOLDER, {
    create: true,
  })
  void sweep(folder).catch(() => undefined)
  const entry = `${globalThis.crypto.randomUUID()}.mpstudio`
  const handle = await folder.getFileHandle(entry, { create: true })
  const remove = () => folder.removeEntry(entry)
  try {
    return streamingTarget(
      'download',
      name,
      await handle.createWritable(),
      () => handle.getFile(),
      remove,
    )
  } catch (error) {
    await remove().catch(() => undefined)
    throw error
  }
}

/** The whole archive in memory: the last resort. */
function memoryTarget(name: string): StudioBackupTarget {
  const sink = createStudioMemorySink()
  return {
    kind: 'download',
    name,
    keepMs: MEMORY_KEEP_MS,
    reserve: (archiveBytes) => sink.reserve(archiveBytes),
    write: (parts) => sink.write(parts),
    close: async () => sink.blob(),
    discard: async () => sink.free(),
  }
}

/**
 * Where a backup called `name` goes. Call it straight from the click: a save
 * picker opened seconds later no longer counts as the person's. Null when
 * they cancel the picker.
 */
export async function openStudioBackupTarget(
  name: string,
): Promise<StudioBackupTarget | null> {
  const picker = savePicker()
  if (picker) {
    const picked = await pickedTarget(picker, name)
    if (picked === 'cancelled') return null
    if (picked) return picked
  }
  return (await privateTarget(name).catch(() => null)) ?? memoryTarget(name)
}

/** Hand a complete download target's file to the browser; drop the copy once the download has it. */
export function downloadStudioBackup(
  target: StudioBackupTarget,
  file: Blob,
): void {
  let url: string | undefined
  try {
    url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = target.name
    anchor.click()
  } catch (error) {
    if (url !== undefined) URL.revokeObjectURL(url)
    void target.discard()
    throw error
  }
  const saved = url
  setTimeout(() => {
    URL.revokeObjectURL(saved)
    void target.discard()
  }, target.keepMs)
}
