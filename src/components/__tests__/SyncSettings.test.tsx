// The settings page's device count, against the boot race that shipped:
// reloading straight into Settings read the session cache before IndexedDB
// had filled it and told somebody with a full library "0 songs on this
// device" — until they happened to visit the Karaoke tab.

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
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
vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => false,
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
vi.mock('@/stores/drive-sync-store', () => ({
  backUpToDrive: vi.fn(),
  connectDrive: vi.fn(),
  disconnectDriveSync: vi.fn(),
  driveBusy: () => false,
  driveEmail: () => null,
  driveError: () => null,
  driveFolderId: () => null,
  driveJob: () => null,
  driveJobFailures: () => [],
  driveScan: () => null,
  driveState: () => 'unknown',
  refreshDriveStatus: vi.fn(() => Promise.resolve()),
  restoreFromDrive: vi.fn(),
  scanDrive: vi.fn(() => Promise.resolve(null)),
  stopDriveJob: vi.fn(),
}))
vi.mock('../InstallAppButton', () => ({ InstallAppButton: () => null }))

function completedSession(id: string): Record<string, unknown> {
  return { sessionId: id, status: 'completed' }
}

beforeEach(() => {
  uvr.sessions = []
  uvr.readyPromise = Promise.resolve()
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
