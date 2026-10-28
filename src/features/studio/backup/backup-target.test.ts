// Studio backup targets — the picked file, a private file that downloads then goes, or memory; a cancelled picker or a failed backup leaves nothing behind.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '@/lib/studio/memory-budget'
import { STUDIO_ARCHIVE_BATCH_BYTES } from './archive-writer'
import { downloadStudioBackup, openStudioBackupTarget, STUDIO_BACKUP_FOLDER, studioBackupFileName, } from './backup-target'

const MiB = 1024 * 1024

function fakeWritable() {
  const written: Uint8Array[] = []
  return {
    written,
    write: vi.fn(async (bytes: Uint8Array) => {
      written.push(bytes)
    }),
    close: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  }
}

/** A file handle the save picker or the private folder hands back. */
function fakeHandle(name: string, lastModified = Date.now()) {
  const writable = fakeWritable()
  return {
    kind: 'file' as const,
    name,
    writable,
    createWritable: vi.fn(async () => writable),
    // A file read back from disk: its bytes and when it was last written.
    getFile: vi.fn(async () =>
      Object.assign(new Blob(writable.written as BlobPart[]), { lastModified }),
    ),
    remove: vi.fn(async () => {}),
  }
}

/** The origin private file system, holding the backup folder. */
function fakeStorage(existing: ReturnType<typeof fakeHandle>[] = []) {
  const files = new Map(existing.map((handle) => [handle.name, handle]))
  const folder = {
    files,
    getFileHandle: vi.fn(async (name: string) => {
      const handle = fakeHandle(name)
      files.set(name, handle)
      return handle
    }),
    removeEntry: vi.fn(async (name: string) => {
      files.delete(name)
    }),
    async *entries() {
      for (const entry of [...files]) yield entry
    },
  }
  const getDirectory = vi.fn(async () => ({
    getDirectoryHandle: vi.fn(async (name: string) => {
      expect(name).toBe(STUDIO_BACKUP_FOLDER)
      return folder
    }),
  }))
  vi.stubGlobal('navigator', { storage: { getDirectory } })
  vi.stubGlobal(
    'FileSystemFileHandle',
    class {
      createWritable() {}
    },
  )
  return { folder, getDirectory }
}

const bytes = (...values: number[]) => new Uint8Array(values)

describe('Studio backup targets', () => {
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('asks where to save, streams there holding one batch, and leaves the saved file alone', async () => {
    const picked = fakeHandle('First song.mpstudio')
    const picker = vi.fn(async () => picked)
    vi.stubGlobal('showSaveFilePicker', picker)
    const { getDirectory } = fakeStorage()

    const target = (await openStudioBackupTarget('First song.mpstudio'))!
    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'First song.mpstudio',
      types: [
        {
          description: 'Studio project backup',
          accept: { 'application/zip': ['.mpstudio'] },
        },
      ],
    })
    expect(target).toMatchObject({ kind: 'file', name: 'First song.mpstudio' })
    target.reserve(200 * MiB)
    expect(studioReservedMemoryBytes()).toBe(STUDIO_ARCHIVE_BATCH_BYTES + MiB)
    await target.write([bytes(1, 2), bytes(3)])
    expect(picked.writable.written).toEqual([bytes(1, 2, 3)])
    expect(await target.close()).toBeNull()
    await target.discard()

    expect(picked.writable.close).toHaveBeenCalled()
    expect(picked.remove).not.toHaveBeenCalled()
    expect(getDirectory).not.toHaveBeenCalled()
  })

  it('makes nothing when the person cancels the picker', async () => {
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => {
        throw new DOMException('The user aborted a request.', 'AbortError')
      }),
    )
    const { getDirectory } = fakeStorage()

    expect(await openStudioBackupTarget('Song.mpstudio')).toBeNull()
    expect(getDirectory).not.toHaveBeenCalled()
  })

  it('removes the picked file when the backup stops before it is complete', async () => {
    const picked = fakeHandle('Song.mpstudio')
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => picked),
    )
    fakeStorage()
    const target = (await openStudioBackupTarget('Song.mpstudio'))!
    target.reserve(MiB)
    await target.write([bytes(1)])

    await target.discard()

    // The bytes never reach the file, and the empty file the picker made goes.
    expect(picked.writable.abort).toHaveBeenCalled()
    expect(picked.writable.close).not.toHaveBeenCalled()
    expect(picked.remove).toHaveBeenCalled()
  })

  it('downloads a private file when the picker refuses, and removes it once the download has it', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => {
        throw new DOMException(
          'Must be handling a user gesture.',
          'SecurityError',
        )
      }),
    )
    const { folder } = fakeStorage()
    const created = vi.fn(() => 'blob:backup')
    const revoked = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: created, revokeObjectURL: revoked })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    const target = (await openStudioBackupTarget('Song.mpstudio'))!
    expect(target).toMatchObject({ kind: 'download', name: 'Song.mpstudio' })
    target.reserve(200 * MiB)
    expect(studioReservedMemoryBytes()).toBe(STUDIO_ARCHIVE_BATCH_BYTES + MiB)
    await target.write([bytes(5, 6)])
    const file = (await target.close())!
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes(5, 6))
    expect(folder.files.size).toBe(1)

    downloadStudioBackup(target, file)
    expect(click).toHaveBeenCalledTimes(1)
    expect(created).toHaveBeenCalledWith(file)
    await vi.advanceTimersByTimeAsync(target.keepMs - 1)
    expect(folder.files.size).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(revoked).toHaveBeenCalledWith('blob:backup')
    expect(folder.files.size).toBe(0)
    click.mockRestore()
  })

  it('removes private copies a closed tab left behind, and keeps recent ones', async () => {
    const stale = fakeHandle('stale.mpstudio', Date.now() - 11 * 60_000)
    const recent = fakeHandle('recent.mpstudio', Date.now() - 60_000)
    const { folder } = fakeStorage([stale, recent])

    const target = (await openStudioBackupTarget('Song.mpstudio'))!
    await vi.waitFor(() =>
      expect(folder.removeEntry).toHaveBeenCalledWith('stale.mpstudio'),
    )
    expect(folder.files.has('recent.mpstudio')).toBe(true)
    await target.discard()
    expect(folder.files.has('recent.mpstudio')).toBe(true)
    expect(folder.files.size).toBe(1)
  })

  it('keeps the archive in memory only where no file can be written', async () => {
    vi.stubGlobal('navigator', {})
    const target = (await openStudioBackupTarget('Song.mpstudio'))!
    expect(target).toMatchObject({ kind: 'download', keepMs: 10_000 })
    target.reserve(20 * MiB)
    expect(studioReservedMemoryBytes()).toBe(29 * MiB)
    await target.write([bytes(7), bytes(8)])
    const blob = (await target.close())!
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes(7, 8))
    await target.discard()
  })

  it('names the file after the song, without characters a file system refuses', () => {
    expect(studioBackupFileName('Late: night/mix?')).toBe(
      'Late nightmix.mpstudio',
    )
    expect(studioBackupFileName('***')).toBe('Studio project.mpstudio')
    expect(studioBackupFileName(undefined)).toBe('Studio project.mpstudio')
  })
})
