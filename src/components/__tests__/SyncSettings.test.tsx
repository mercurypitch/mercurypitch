// The settings page's device count, against the boot race that shipped:
// reloading straight into Settings read the session cache before IndexedDB
// had filled it and told somebody with a full library "0 songs on this
// device" — until they happened to visit the Karaoke tab.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncSettings } from '../SyncSettings'

const uvr = vi.hoisted(() => {
  let resolveReady: () => void = () => {}
  return {
    sessions: [] as Record<string, unknown>[],
    readyPromise: Promise.resolve() as Promise<void>,
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
  getAllUvrSessions: () => uvr.sessions,
  whenSessionStoreReady: () => uvr.readyPromise,
}))

vi.mock('@/db/durable-write', () => ({
  storageEstimate: () => Promise.resolve({ quota: 1e9, usage: 1e6 }),
}))
vi.mock('@/db/persistent-storage', () => ({
  isStoragePersisted: () => Promise.resolve(true),
  requestPersistentStorage: () => Promise.resolve(true),
}))
const auth = vi.hoisted(() => ({ held: false }))
vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => auth.held,
  takeDriveConnectResult: () => null,
}))
vi.mock('@/db/services/song-manifest-service', () => ({
  syncLibraryList: () => Promise.resolve([]),
  readLibraryManifests: () => Promise.resolve([]),
}))
vi.mock('@/lib/pwa-install', () => ({
  isStandalone: () => true,
  needsIosInstallHint: () => false,
}))
const drive = vi.hoisted(() => ({
  state: 'unknown' as string,
  scan: null as unknown,
  job: null as unknown,
  stopping: false,
  refreshDriveStatus: vi.fn(() => Promise.resolve()),
  restoreFromDrive: vi.fn(() => Promise.resolve()),
  scanDrive: vi.fn(() => Promise.resolve(null)),
  stopDriveJob: vi.fn(),
}))
vi.mock('@/stores/drive-sync-store', () => ({
  backUpToDrive: vi.fn(),
  connectDrive: vi.fn(),
  disconnectDriveSync: vi.fn(),
  driveBusy: () => false,
  driveEmail: () => null,
  driveError: () => null,
  driveFolderId: () => null,
  driveJob: () => drive.job,
  driveJobFailures: () => [],
  driveJobStopping: () => drive.stopping,
  driveScan: () => drive.scan,
  driveState: () => drive.state,
  refreshDriveStatus: drive.refreshDriveStatus,
  restoreFromDrive: drive.restoreFromDrive,
  scanDrive: drive.scanDrive,
  stopDriveJob: drive.stopDriveJob,
}))
vi.mock('../InstallAppButton', () => ({ InstallAppButton: () => null }))

function completedSession(id: string): Record<string, unknown> {
  return { sessionId: id, status: 'completed' }
}

beforeEach(() => {
  uvr.sessions = []
  uvr.readyPromise = Promise.resolve()
  auth.held = false
  drive.state = 'unknown'
  drive.scan = null
  drive.job = null
  drive.stopping = false
  drive.refreshDriveStatus.mockClear()
  drive.restoreFromDrive.mockClear()
  drive.scanDrive.mockClear()
})

afterEach(() => cleanup())

describe('the device count', () => {
  it('REQ-DRV-019: waits for the library before counting it', async () => {
    // The cache is still filling: the page must not read it yet.
    uvr.armPendingReady()
    render(() => <SyncSettings />)

    // Give the unfixed code every chance to mis-count: a refresh that
    // does not wait has read the empty cache by the end of this flush.
    await new Promise((resolve) => setTimeout(resolve, 0))

    // The library finishes loading — with twelve songs, not zero.
    uvr.sessions = [
      ...Array.from({ length: 12 }, (_, i) => completedSession(`s${i}`)),
    ]
    uvr.grantReady()

    await waitFor(() => {
      expect(screen.getByText('12')).toBeTruthy()
    })
  })

  it('counts only completed songs', async () => {
    uvr.sessions = [
      completedSession('s1'),
      { sessionId: 's2', status: 'processing' },
    ]
    render(() => <SyncSettings />)

    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy()
    })
  })
})

describe('the Drive section', () => {
  it('REQ-DRV-023: checks a connected Drive by itself on arrival', async () => {
    auth.held = true
    drive.state = 'connected'

    render(() => <SyncSettings />)

    // No button pressed: the check is one folder listing, and the
    // section should open with answers instead of another button.
    await waitFor(() => expect(drive.scanDrive).toHaveBeenCalledTimes(1))
  })

  it('keeps a comparison it already holds instead of re-scanning', async () => {
    auth.held = true
    drive.state = 'connected'
    drive.scan = { inDrive: 3, here: 3, toBackUp: [], toRestore: [] }

    render(() => <SyncSettings />)

    await waitFor(() =>
      expect(drive.refreshDriveStatus).toHaveBeenCalledTimes(1),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(drive.scanDrive).not.toHaveBeenCalled()
  })

  it('REQ-DRV-024: says it is stopping once Stop is pressed', async () => {
    auth.held = true
    drive.state = 'connected'
    drive.job = {
      kind: 'backup',
      title: 'Big Song',
      done: 1,
      total: 5,
      ratio: 0.6,
      failed: 0,
      movedBytes: 12_000_000,
      totalBytes: 40_000_000,
    }
    drive.stopping = true

    render(() => <SyncSettings />)

    await waitFor(() => {
      const button = screen.getByText('Stopping…') as HTMLButtonElement
      expect(button.disabled).toBe(true)
    })
    // The byte figures ride the same label, so a big song on a slow
    // connection reads as moving rather than stuck.
    expect(screen.getByText(/11 MB of 38 MB/)).toBeTruthy()
  })

  it('REQ-DRV-026: restores only what is ticked', async () => {
    auth.held = true
    drive.state = 'connected'
    drive.scan = {
      inDrive: 2,
      here: 0,
      toBackUp: [],
      toRestore: [
        {
          fileHash: 'h-1',
          title: 'Left Behind',
          ref: 'file-h-1',
          bytes: 12_000_000,
        },
        {
          fileHash: 'h-2',
          title: 'Chosen One',
          ref: 'file-h-2',
          bytes: 5_000_000,
        },
      ],
    }

    render(() => <SyncSettings />)

    // Every song arrives chosen — the common case stays one press. The
    // first checkbox is the choose-everything head; untick song one.
    const boxes = await screen.findAllByRole('checkbox')
    fireEvent.click(boxes[1] as HTMLInputElement)

    const button = screen.getByText('Restore 1 song') as HTMLButtonElement
    fireEvent.click(button)
    expect(drive.restoreFromDrive).toHaveBeenCalledWith(['h-2'])
  })
})
