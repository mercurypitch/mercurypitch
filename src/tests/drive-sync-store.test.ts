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

const auth = vi.hoisted(() => ({
  account: 'user-1' as string | null,
  fetchDriveAccessToken: vi.fn(() =>
    Promise.resolve({ ok: true, accessToken: 'tok', expiresIn: 3600 }),
  ),
  fetchDriveStatus: vi.fn(
    (): Promise<{ known: boolean; connected?: boolean; email?: string }> =>
      Promise.resolve({ known: true, connected: true, email: 'a@b.c' }),
  ),
  disconnectDrive: vi.fn(() => Promise.resolve(true)),
  startDriveConnect: vi.fn(() => Promise.resolve({ ok: true })),
}))
vi.mock('@/db/services/auth-service', () => ({
  ...auth,
  currentAccountId: () => auth.account,
}))

const sessions = vi.hoisted(() => {
  let resolveReady: () => void = () => {}
  return {
    list: [] as unknown[],
    readyPromise: Promise.resolve() as Promise<void>,
    /** Make readiness something a test has to grant explicitly. */
    armPendingReady(): void {
      this.readyPromise = new Promise<void>((resolve) => {
        resolveReady = resolve
      })
    },
    grantReady(): void {
      resolveReady()
    },
  }
})
vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessions: () => sessions.list,
  getUvrSessionByHash: () => undefined,
  whenSessionStoreReady: () => sessions.readyPromise,
}))

const stemPresence = vi.hoisted(() => ({ sessionStemPresence: vi.fn() }))
vi.mock('@/db/services/uvr-service', () => stemPresence)

const bundleMock = vi.hoisted(() => ({
  buildPortableBundle: vi.fn(),
  importPortableBundle: vi.fn(),
}))
vi.mock('@/db/services/portable-bundle-service', () => ({
  ...bundleMock,
  // The store instanceof-checks this to word a failure; a mock without
  // it turns every failure handler into `instanceof undefined`.
  BundleSourceError: class BundleSourceError extends Error {},
}))

const notify = vi.hoisted(() => ({ showNotification: vi.fn() }))
vi.mock('@/stores/notifications-store', () => notify)

const power = vi.hoisted(() => ({
  enable: vi.fn(() => Promise.resolve()),
  disable: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/platform', () => ({
  platform: { keepAwake: { enable: power.enable, disable: power.disable } },
}))

import { DriveApiError } from '@/lib/drive/drive-client'
import { encodeContainerHeader } from '@/lib/portable/portable-container'
import { backUpToDrive, disconnectDriveSync, driveError, driveFolderId, driveJob, driveJobFailures, driveScan, driveState, refreshDriveStatus, restoreFromDrive, scanDrive, stopDriveJob, } from '@/stores/drive-sync-store'

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
  localStorage.clear()
  sessions.list = []
  sessions.readyPromise = Promise.resolve()
  auth.account = 'user-1'
  auth.fetchDriveAccessToken.mockResolvedValue({
    ok: true,
    accessToken: 'tok',
    expiresIn: 3600,
  })
  auth.fetchDriveStatus.mockResolvedValue({
    known: true,
    connected: true,
    email: 'a@b.c',
  })
  auth.disconnectDrive.mockResolvedValue(true)
  driveMock.ensureFolder.mockResolvedValue('folder-1')
  driveMock.listSongs.mockResolvedValue([])
  driveMock.uploadSong.mockResolvedValue('file-x')
  stemPresence.sessionStemPresence.mockResolvedValue('present')
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
      // No hash means no identity, so it could never be matched again.
      { ...localSession('', 'Nameless.mp3') },
    ]
    const scan = await scanDrive()
    expect(scan?.here).toBe(1)
    expect(scan?.toBackUp.map((c) => c.title)).toEqual(['Done'])
  })

  it('REQ-DRV-010: counts a completed hashed song this page never played', async () => {
    // Exactly what a session looks like fresh off IndexedDB: completed,
    // hashed, and with NO outputs — those are minted lazily on first
    // play, and packing reads the stems from the database anyway.
    // Requiring outputs made a full library answer "nothing here to
    // back up" after every reload, which is the shipped bug.
    const fresh: Record<string, unknown> = localSession('h-1', 'Song.mp3')
    delete fresh.outputs
    sessions.list = [fresh]

    const scan = await scanDrive()

    expect(scan?.here).toBe(1)
    expect(scan?.toBackUp).toHaveLength(1)
    expect(scan?.toBackUp[0]?.title).toBe('Song')
  })

  it('REQ-DRV-011: waits for the library to finish loading first', async () => {
    // The post-OAuth-redirect boot runs the scan while IndexedDB is
    // still loading; comparing against a cache that is merely EMPTY SO
    // FAR reports a full device as having nothing to back up.
    sessions.armPendingReady()
    const pending = scanDrive()

    // Give a scan that does NOT wait every chance to finish: all the
    // Drive fakes resolve in microtasks, so by the end of this macrotask
    // the unfixed code has already compared against the empty cache.
    // Only then does the library "arrive" — a scan that reports it must
    // have parked on whenSessionStoreReady().
    await new Promise((resolve) => setTimeout(resolve, 0))
    sessions.list = [localSession('h-9', 'Late.mp3')]
    sessions.grantReady()

    const scan = await pending
    expect(scan?.toBackUp).toHaveLength(1)
  })

  it('REQ-DRV-020: offers a song back when the local match has no stems', async () => {
    // An interrupted delete can leave (or resurrect) a completed row
    // whose blobs are gone. Matching it by hash alone made the scan
    // swear the song was safe here, so the one good copy in Drive was
    // never offered back — the shipped "it only offered once" bug.
    sessions.list = [localSession('h-1', 'Ghost.mp3')]
    driveMock.listSongs.mockResolvedValue([driveFile('h-1', 'Ghost')])
    stemPresence.sessionStemPresence.mockResolvedValue('absent')

    const scan = await scanDrive()

    expect(stemPresence.sessionStemPresence).toHaveBeenCalledWith('session-h-1')
    expect(scan?.toRestore.map((c) => c.fileHash)).toEqual(['h-1'])
  })

  it('keeps a hash match blocking when the stem read merely failed', async () => {
    // 'unknown' means the read failed, not that the stems are gone.
    // Offering a restore on that answer would import a duplicate over
    // a session that may be perfectly healthy.
    sessions.list = [localSession('h-1', 'Maybe.mp3')]
    driveMock.listSongs.mockResolvedValue([driveFile('h-1', 'Maybe')])
    stemPresence.sessionStemPresence.mockResolvedValue('unknown')

    const scan = await scanDrive()
    expect(scan?.toRestore).toEqual([])
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

describe('what the first real 27-song backup taught', () => {
  function oneSongReady(name = 'One.mp3', hash = 'h-1'): void {
    sessions.list = [localSession(hash, name)]
    bundleMock.buildPortableBundle.mockResolvedValue({
      manifest: manifestFor(hash, [4]),
      parts: new Map([['stem:vocal', new Uint8Array([1, 2, 3, 4])]]),
    })
  }

  it('REQ-DRV-012: tries a failed upload again before giving up', async () => {
    vi.useFakeTimers()
    try {
      oneSongReady()
      driveMock.uploadSong
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce('file-x')

      await scanDrive()
      const job = backUpToDrive()
      await vi.advanceTimersByTimeAsync(30_000)
      await job

      // The blip cost an attempt, not the song.
      expect(driveMock.uploadSong).toHaveBeenCalledTimes(2)
      expect(driveJobFailures()).toHaveLength(0)
      const said = notify.showNotification.mock.calls.at(-1) as [string]
      expect(said[0]).toContain('1 song backed up')
    } finally {
      vi.useRealTimers()
    }
  })

  it('REQ-DRV-014: names the song that failed, and why', async () => {
    vi.useFakeTimers()
    try {
      oneSongReady('Stubborn.mp3')
      driveMock.uploadSong.mockRejectedValue(
        new DriveApiError(500, 'Drive answered 500'),
      )

      await scanDrive()
      const job = backUpToDrive()
      await vi.advanceTimersByTimeAsync(60_000)
      await job

      // All three attempts spent, then a reason a person can read —
      // "5 could not be" with no names was the first real run's actual
      // support experience.
      expect(driveMock.uploadSong).toHaveBeenCalledTimes(3)
      expect(driveJobFailures()).toHaveLength(1)
      expect(driveJobFailures()[0]?.title).toBe('Stubborn')
      expect(driveJobFailures()[0]?.reason).toContain('Drive answered 500')
      // The rescan at the end still offers the song for another go.
      expect(driveScan()?.toBackUp).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('REQ-DRV-015: moves the headline counts as each song lands', async () => {
    sessions.list = [
      localSession('h-1', 'One.mp3'),
      localSession('h-2', 'Two.mp3'),
    ]
    let releaseSecond: () => void = () => {}
    bundleMock.buildPortableBundle.mockImplementation((sessionId: string) => {
      const bundle = {
        manifest: manifestFor(sessionId.replace('session-', ''), [4]),
        parts: new Map([['stem:vocal', new Uint8Array([1, 2, 3, 4])]]),
      }
      if (sessionId === 'session-h-2') {
        // The second song packs only when the test says so, holding the
        // job mid-flight where the live figures can be read.
        return new Promise((resolve) => {
          releaseSecond = () => resolve(bundle)
        })
      }
      return Promise.resolve(bundle)
    })

    await scanDrive()
    expect(driveScan()?.inDrive).toBe(0)
    const job = backUpToDrive()

    // One song landed, one still packing: the numbers already say what
    // pressing Stop right now would keep.
    await vi.waitFor(() => expect(driveScan()?.inDrive).toBe(1))
    expect(driveScan()?.toBackUp).toHaveLength(1)

    releaseSecond()
    await job
  })

  it('REQ-DRV-016: remembers the folder and asks for it by id next time', async () => {
    await scanDrive()
    expect(driveMock.ensureFolder).toHaveBeenLastCalledWith(null)
    expect(localStorage.getItem('pitchperfect_drive_folder:user-1')).toBe(
      'folder-1',
    )
    expect(driveFolderId()).toBe('folder-1')

    await scanDrive()
    // The id survives a rename in Drive; the name does not.
    expect(driveMock.ensureFolder).toHaveBeenLastCalledWith('folder-1')
  })

  it('REQ-DRV-017: holds the screen awake for exactly the job', async () => {
    oneSongReady()
    await scanDrive()
    power.enable.mockClear()
    power.disable.mockClear()

    await backUpToDrive()

    // The screen going to sleep freezes the page and the job with it —
    // held for the job, released with it, never left dangling.
    expect(power.enable).toHaveBeenCalledTimes(1)
    expect(power.disable).toHaveBeenCalledTimes(1)
  })

  it('REQ-DRV-018: names the Drive file from the title, not the upload', async () => {
    oneSongReady('Song.mp3')

    await scanDrive()
    await backUpToDrive()

    const call = driveMock.uploadSong.mock.calls[0] as unknown as [
      string,
      Blob,
      { title: string },
    ]
    // "Song.mp3.mpsong" is a Drive listing nobody should have to read.
    expect(call[2].title).toBe('Song')
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

describe('whose Drive it is', () => {
  it('forgets everything when a different account signs in', async () => {
    sessions.list = [localSession('h-1', 'Mine.mp3')]
    driveMock.listSongs.mockResolvedValue([driveFile('h-9', 'In My Drive')])
    await refreshDriveStatus()
    await scanDrive()
    expect(driveScan()?.toRestore).toHaveLength(1)

    // Signing out does not reload the page, so without an account check
    // the next person in this tab inherits the previous user's access
    // token and Drive file ids -- and the first button they press uploads
    // their songs into somebody else's Drive.
    auth.account = 'user-2'
    sessions.list = []
    driveMock.listSongs.mockResolvedValue([])

    await restoreFromDrive()
    expect(bundleMock.importPortableBundle).not.toHaveBeenCalled()
    expect(driveMock.downloadRange).not.toHaveBeenCalled()

    await backUpToDrive()
    expect(driveMock.uploadSong).not.toHaveBeenCalled()
  })

  it('does not claim a Drive is missing when it could not ask', async () => {
    await refreshDriveStatus()
    expect(driveState()).toBe('connected')

    auth.fetchDriveStatus.mockResolvedValue({ known: false })
    await refreshDriveStatus()

    // Offline, or a 500, or a lapsed session. Answering "not connected"
    // here is what puts a Connect button in front of somebody whose Drive
    // is already attached, and tapping it leaves the app for consent.
    expect(driveState()).toBe('connected')
    expect(driveError()).toContain('Could not check')
  })
})

describe('disconnect', () => {
  it('does not say it disconnected when it did not', async () => {
    await refreshDriveStatus()
    auth.disconnectDrive.mockResolvedValue(false)

    await disconnectDriveSync()

    // Telling somebody their access is revoked when the sealed refresh
    // token is still in the database is the one wrong answer here.
    expect(driveState()).toBe('connected')
    expect(driveError()).toContain('still connected')
  })
})
