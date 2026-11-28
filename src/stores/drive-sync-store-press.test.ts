// ============================================================
// Back up and Restore to Drive, as a person's press
// ============================================================
//
// Both jobs run on a Google token our servers mint. When a job has to mint
// one, that call goes as the person's press, even while the API is out of
// reach (src/db/api-reachability.ts), the way Check Drive again's does
// (the 'scan' tests in src/tests/drive-sync-store.test.ts). A job nobody
// pressed for mints nothing as a press. Drive itself is faked here, so the
// only call to our servers these tests can see is that mint.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DriveClientModule from '@/lib/drive/drive-client'
import type { PortableBundleManifest } from '@/lib/portable/portable-bundle'

const driveMock = vi.hoisted(() => ({
  ensureFolder: vi.fn(() => Promise.resolve('folder-1')),
  listSongs: vi.fn(() => Promise.resolve([] as unknown[])),
  uploadSong: vi.fn((..._args: unknown[]) => Promise.resolve('file-x')),
  downloadRange: vi.fn((..._args: unknown[]) =>
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
  fetchDriveAccessToken: vi.fn((_options?: { userAction?: boolean }) =>
    Promise.resolve({ ok: true, accessToken: 'tok', expiresIn: 3600 }),
  ),
}))
vi.mock('@/db/services/auth-service', () => ({
  currentAccountId: () => auth.account,
}))
vi.mock('@/db/services/drive-connect-service', () => ({
  fetchDriveAccessToken: auth.fetchDriveAccessToken,
  fetchDriveStatus: () =>
    Promise.resolve({ known: true, connected: true, email: 'a@b.c' }),
  disconnectDrive: () => Promise.resolve(true),
  startDriveConnect: () => Promise.resolve({ ok: true }),
}))

const sessions = vi.hoisted(() => ({ list: [] as unknown[] }))
vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessions: () => sessions.list,
  getUvrSessionByHash: () => undefined,
  whenSessionStoreReady: () => Promise.resolve(),
}))
vi.mock('@/db/services/uvr-service', () => ({
  sessionStemPresence: () => Promise.resolve('present'),
}))

const bundleMock = vi.hoisted(() => ({
  buildPortableBundle: vi.fn(),
  importPortableBundle: vi.fn(),
}))
vi.mock('@/db/services/portable-bundle-service', () => ({
  ...bundleMock,
  BundleSourceError: class BundleSourceError extends Error {},
}))
vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))
vi.mock('@/lib/platform', () => ({
  platform: {
    keepAwake: {
      enable: () => Promise.resolve(),
      disable: () => Promise.resolve(),
    },
  },
}))

import { ApiDeadlineError } from '@/db/api-fetch'
import { NO_ANSWER_TEXT } from '@/lib/no-answer-copy'
import { backUpToDrive, driveError, driveJob, restoreFromDrive, scanDrive, } from './drive-sync-store'

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

function driveFile(hash: string, name: string) {
  return {
    fileId: `file-${hash}`,
    name: `${name}.mpsong`,
    bytes: 1024,
    modifiedTime: '2026-01-01T00:00:00Z',
    properties: { fileHash: hash, quality: 'portable-128' },
  }
}

/** The token mint finds no answer, as one that runs out its deadline does. */
function mintGetsNoAnswer(): void {
  auth.fetchDriveAccessToken.mockRejectedValueOnce(
    new ApiDeadlineError('https://api.test/api/auth/drive/token', 20_000),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessions.list = []
  auth.fetchDriveAccessToken.mockResolvedValue({
    ok: true,
    accessToken: 'tok',
    expiresIn: 3600,
  })
  driveMock.listSongs.mockResolvedValue([])
  bundleMock.buildPortableBundle.mockResolvedValue({
    manifest: {
      format: 'mercurypitch-song',
      version: 1,
      song: { fileHash: 'h-1', title: 'One', quality: 'portable-128' },
      parts: [
        {
          id: 'stem:vocal',
          bytes: 4,
          sha256: 'x'.repeat(64),
          mime: 'audio/mp4',
        },
      ],
    } as PortableBundleManifest,
    parts: new Map([['stem:vocal', new Uint8Array([1, 2, 3, 4])]]),
  })
})

// Each test signs in as its own account: a new account is what drops the
// token the store keeps between calls.
describe('Back up', () => {
  it('mints the token as the press when the person pressed Back up', async () => {
    auth.account = 'user-backs-up'
    sessions.list = [localSession('h-1', 'One.mp3')]
    await scanDrive()

    await backUpToDrive({ userAction: true })

    expect(auth.fetchDriveAccessToken).toHaveBeenCalledExactlyOnceWith({
      userAction: true,
    })
    expect(driveMock.uploadSong).toHaveBeenCalledTimes(1)
  })

  it('runs the scan it still needs as the press too, and mints once', async () => {
    auth.account = 'user-backs-up-unscanned'
    sessions.list = [localSession('h-1', 'One.mp3')]

    await backUpToDrive({ userAction: true })

    expect(auth.fetchDriveAccessToken).toHaveBeenCalledExactlyOnceWith({
      userAction: true,
    })
    expect(driveMock.uploadSong).toHaveBeenCalledTimes(1)
  })

  it('says plainly when our servers did not answer for the token, and uploads nothing', async () => {
    auth.account = 'user-backs-up-unanswered'
    sessions.list = [localSession('h-1', 'One.mp3')]
    await scanDrive()
    mintGetsNoAnswer()

    await backUpToDrive({ userAction: true })

    expect(driveMock.uploadSong).not.toHaveBeenCalled()
    expect(driveJob()).toBeNull()
    expect(driveError()).toBe(NO_ANSWER_TEXT)
  })

  it('mints nothing as a press when nobody pressed Back up', async () => {
    auth.account = 'user-backs-up-by-itself'
    sessions.list = [localSession('h-1', 'One.mp3')]
    await scanDrive()

    await backUpToDrive()

    expect(auth.fetchDriveAccessToken).not.toHaveBeenCalled()
    expect(driveMock.uploadSong).toHaveBeenCalledTimes(1)
  })
})

describe('Restore', () => {
  it('mints the token as the press when the person pressed Restore', async () => {
    auth.account = 'user-restores'
    driveMock.listSongs.mockResolvedValue([driveFile('h-9', 'Missing Here')])
    await scanDrive()

    await restoreFromDrive(undefined, { userAction: true })

    expect(auth.fetchDriveAccessToken).toHaveBeenCalledExactlyOnceWith({
      userAction: true,
    })
    expect(driveMock.downloadRange).toHaveBeenCalled()
  })

  it('says plainly when our servers did not answer for the token, and downloads nothing', async () => {
    auth.account = 'user-restores-unanswered'
    driveMock.listSongs.mockResolvedValue([driveFile('h-9', 'Missing Here')])
    await scanDrive()
    mintGetsNoAnswer()

    await restoreFromDrive(undefined, { userAction: true })

    expect(driveMock.downloadRange).not.toHaveBeenCalled()
    expect(driveError()).toBe(NO_ANSWER_TEXT)
  })
})
