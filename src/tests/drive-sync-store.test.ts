// The store's own decisions, with Drive and the database both faked: what
// counts as needing a backup, what a restore pulls and in what order, and
// whether one bad song stops the other nineteen. These are the parts that
// only reveal themselves with a library big enough to be annoying to
// reproduce by hand.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DriveClientModule from '@/lib/drive/drive-client'
import type { PortableBundleManifest, PortablePartInfo, } from '@/lib/portable/portable-bundle'

const driveMock = vi.hoisted(() => ({
  ensureFolder: vi.fn(() => Promise.resolve('folder-1')),
  listSongs: vi.fn(() => Promise.resolve([] as unknown[])),
  uploadSong: vi.fn(() => Promise.resolve('file-x')),
  downloadRange: vi.fn((_id: string, _start: number, _end: number) =>
    Promise.resolve(new Uint8Array()),
  ),
  trashFile: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/drive/drive-client', async (importOriginal) => {
  const actual = await importOriginal<typeof DriveClientModule>()
  return { ...actual, createDriveClient: () => driveMock }
})

vi.mock('@/db/services/auth-service', () => ({
  fetchDriveAccessToken: vi.fn(() =>
    Promise.resolve({ ok: true, accessToken: 'tok', expiresIn: 3600 }),
  ),
  fetchDriveStatus: vi.fn(() =>
    Promise.resolve({ connected: true, email: 'a@b.c' }),
  ),
  disconnectDrive: vi.fn(() => Promise.resolve(true)),
  driveConnectUrl: vi.fn(() => 'https://worker/start'),
}))

const sessions = vi.hoisted(() => ({ list: [] as unknown[] }))
vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessions: () => sessions.list,
  getUvrSessionByHash: () => undefined,
}))

const bundleMock = vi.hoisted(() => ({
  buildPortableBundle: vi.fn(),
  importPortableBundle: vi.fn(),
}))
vi.mock('@/db/services/portable-bundle-service', () => bundleMock)

const notify = vi.hoisted(() => ({ showNotification: vi.fn() }))
vi.mock('@/stores/notifications-store', () => notify)

import { encodeContainerHeader } from '@/lib/portable/portable-container'
import { backUpToDrive, driveJob, driveScan, restoreFromDrive, scanDrive, stopDriveJob, } from '@/stores/drive-sync-store'

function localSession(hash: string, name: string) {
  return {
    sessionId: `session-${hash}`,
    status: 'completed',
    progress: 100,
    fileHash: hash,
    originalFile: { name, size: 1, mimeType: 'audio/mpeg' },
    outputs: { vocal: 'v', instrumental: 'i' },
    createdAt: 1,
  }
}

function driveFile(hash: string, name: string, bytes = 1024) {
  return {
    fileId: `file-${hash}`,
    name: `${name}.mpsong`,
    bytes,
    modifiedTime: '2026-01-01T00:00:00Z',
    properties: { fileHash: hash, quality: 'portable-128' },
  }
}

function manifestFor(hash: string, parts: number[]): PortableBundleManifest {
  return {
    format: 'mercurypitch-song',
    version: 1,
    song: { fileHash: hash, title: 'Song', quality: 'portable-128' },
    parts: parts.map((bytes, i) => ({
      id: i === 0 ? 'stem:vocal' : 'stem:instrumental',
      bytes,
      sha256: 'x'.repeat(64),
      mime: 'audio/mp4',
    })),
  } as PortableBundleManifest
}

beforeEach(() => {
  vi.clearAllMocks()
  sessions.list = []
  driveMock.ensureFolder.mockResolvedValue('folder-1')
  driveMock.listSongs.mockResolvedValue([])
})

describe('scan', () => {
  it('matches songs by content hash, not by name', async () => {
    sessions.list = [
      localSession('h-1', 'Both Sides.mp3'),
      localSession('h-2', 'Only Here.mp3'),
    ]
    // The same song, saved from a different source, with a different
    // file name. Matching on the name would upload a second copy.
    driveMock.listSongs.mockResolvedValue([
      driveFile('h-1', 'both sides (remaster)'),
      driveFile('h-3', 'Only In Drive'),
    ])

    const scan = await scanDrive()
    expect(scan).not.toBeNull()
    expect(scan?.inDrive).toBe(2)
    expect(scan?.here).toBe(2)
    expect(scan?.toBackUp.map((c) => c.fileHash)).toEqual(['h-2'])
    expect(scan?.toRestore.map((c) => c.fileHash)).toEqual(['h-3'])
    // The restore candidate is named by its file, minus our suffix.
    expect(scan?.toRestore[0]?.title).toBe('Only In Drive')
  })

  it('ignores songs this device cannot actually send', async () => {
    sessions.list = [
      { ...localSession('h-1', 'Done.mp3') },
      // Still separating: there is nothing to pack yet.
      { ...localSession('h-2', 'Working.mp3'), status: 'processing' },
      // A record with no audio behind it -- the library list knows about
      // it, but this device holds nothing to upload.
      { ...localSession('h-3', 'Elsewhere.mp3'), outputs: {} },
      // No hash means no identity, so it could never be matched again.
      { ...localSession('', 'Nameless.mp3') },
    ]
    const scan = await scanDrive()
    expect(scan?.here).toBe(1)
    expect(scan?.toBackUp.map((c) => c.title)).toEqual(['Done'])
  })
})

describe('backup', () => {
  it('packs and uploads each song that is missing, then rechecks', async () => {
    sessions.list = [
      localSession('h-1', 'One.mp3'),
      localSession('h-2', 'Two.mp3'),
    ]
    bundleMock.buildPortableBundle.mockImplementation((sessionId: string) =>
      Promise.resolve({
        manifest: {
          ...manifestFor(sessionId.replace('session-', ''), [4]),
          song: {
            fileHash: sessionId.replace('session-', ''),
            title: 'Song',
            quality: 'portable-128',
            durationSec: 90,
          },
        },
        parts: new Map([['stem:vocal', new Uint8Array([1, 2, 3, 4])]]),
      }),
    )

    await scanDrive()
    await backUpToDrive()

    expect(driveMock.uploadSong).toHaveBeenCalledTimes(2)
    const [, , meta] = driveMock.uploadSong.mock.calls[0] as unknown as [
      string,
      Blob,
      { properties: { fileHash: string; durationSec?: number } },
    ]
    // The hash rides along as a Drive property, which is what makes the
    // next scan able to answer "already there" without downloading.
    expect(meta.properties.fileHash).toBe('h-1')
    expect(meta.properties.durationSec).toBe(90)
    // Two scans: the one that found the work, and the one that confirms
    // it is done -- otherwise the buttons still offer to back up songs
    // that are now in Drive.
    expect(driveMock.listSongs).toHaveBeenCalledTimes(2)
    expect(driveJob()).toBeNull()
  })

  it('steps over a song it cannot pack', async () => {
    sessions.list = [
      localSession('h-1', 'Broken.mp3'),
      localSession('h-2', 'Fine.mp3'),
    ]
    bundleMock.buildPortableBundle.mockImplementation((sessionId: string) => {
      if (sessionId === 'session-h-1') {
        return Promise.reject(new Error('a stem is unreadable'))
      }
      return Promise.resolve({
        manifest: manifestFor('h-2', [4]),
        parts: new Map([['stem:vocal', new Uint8Array([1, 2, 3, 4])]]),
      })
    })

    await scanDrive()
    await backUpToDrive()

    // One unreadable song must not strand the rest of the library.
    expect(driveMock.uploadSong).toHaveBeenCalledTimes(1)
  })

  it('treats Stop as stopping, not as songs that failed', async () => {
    sessions.list = [
      localSession('h-1', 'One.mp3'),
      localSession('h-2', 'Two.mp3'),
    ]
    bundleMock.buildPortableBundle.mockImplementation(() => {
      // Stopping surfaces as a throw from inside the encoder, which is
      // indistinguishable from a real packing failure unless the abort
      // flag is checked -- and telling somebody who pressed Stop that
      // their songs "could not be backed up" is a support ticket.
      stopDriveJob()
      return Promise.reject(new Error('StemEncodeAbortedError'))
    })

    await scanDrive()
    await backUpToDrive()

    expect(driveMock.uploadSong).not.toHaveBeenCalled()
    const said = notify.showNotification.mock.calls.at(-1) as
      | [string, string]
      | undefined
    expect(said?.[0]).toContain('before you stopped')
    expect(said?.[0]).not.toContain('could not be')
    expect(said?.[1]).toBe('success')
  })
})

describe('restore', () => {
  it('pulls one part at a time, at the offsets the header names', async () => {
    const manifest = manifestFor('h-9', [3, 5])
    const header = encodeContainerHeader(manifest)
    driveMock.listSongs.mockResolvedValue([
      driveFile('h-9', 'Missing Here', header.byteLength + 8),
    ])
    // A real container: the header, then three vocal bytes and five
    // instrumental ones, so the offsets under test are the file's own.
    const file = new Uint8Array(header.byteLength + 8)
    file.set(header, 0)
    file.set(new Uint8Array([1, 1, 1]), header.byteLength)
    file.set(new Uint8Array([2, 2, 2, 2, 2]), header.byteLength + 3)
    driveMock.downloadRange.mockImplementation(
      (_id: string, start: number, end: number) =>
        Promise.resolve(file.slice(start, end)),
    )
    bundleMock.importPortableBundle.mockImplementation(
      async (
        m: PortableBundleManifest,
        getPart: (info: PortablePartInfo) => Promise<Uint8Array>,
      ) => {
        for (const part of m.parts) await getPart(part)
        return { outcome: 'imported', sessionId: 's' }
      },
    )

    await scanDrive()
    await restoreFromDrive()

    const ranges = driveMock.downloadRange.mock.calls.map(
      (c) => (c as unknown as [string, number, number]).slice(1) as number[],
    )
    // The header read first, then each part at its computed offset. Never
    // the whole file: a phone restoring a library has to survive on the
    // memory one part needs.
    expect(ranges[0]?.[0]).toBe(0)
    expect(ranges[1]).toEqual([header.byteLength, header.byteLength + 3])
    expect(ranges[2]).toEqual([header.byteLength + 3, header.byteLength + 8])
  })

  it('declines a file that is not one of ours instead of importing it', async () => {
    driveMock.listSongs.mockResolvedValue([driveFile('h-9', 'Not Ours', 64)])
    driveMock.downloadRange.mockResolvedValue(
      new TextEncoder().encode('this is a text file, not a song at all'),
    )

    await scanDrive()
    await restoreFromDrive()

    expect(bundleMock.importPortableBundle).not.toHaveBeenCalled()
    // Nothing was imported, and the store is idle rather than stuck.
    expect(driveJob()).toBeNull()
    expect(driveScan()).not.toBeNull()
  })
})
