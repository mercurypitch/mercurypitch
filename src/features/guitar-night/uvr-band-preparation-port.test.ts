// UVR band-port tests protect the paid split from ever being resubmitted.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUvrStemManifest } from '@/db/services/uvr-read-service'
import { startManagedStemSplit } from '@/lib/uvr-auto-resume'
import { getUvrSession, refreshUvrSessionFromDb } from '@/stores/uvr-store'
import { createUvrGuitarNightBandPreparationPort } from './uvr-band-preparation-port'

vi.mock('@/db/services/uvr-read-service', () => ({
  readUvrStemManifest: vi.fn(),
}))
vi.mock('@/lib/uvr-auto-resume', () => ({
  startManagedStemSplit: vi.fn(),
}))
vi.mock('@/stores/uvr-store', () => ({
  getUvrSession: vi.fn(),
  refreshUvrSessionFromDb: vi.fn(),
}))

const refreshMock = vi.mocked(refreshUvrSessionFromDb)
const manifestMock = vi.mocked(readUvrStemManifest)
const splitMock = vi.mocked(startManagedStemSplit)
const sessionMock = vi.mocked(getUvrSession)

function prepareOptions() {
  return {
    signal: new AbortController().signal,
    onUpdate: vi.fn(),
  }
}

describe('createUvrGuitarNightBandPreparationPort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshMock.mockResolvedValue(true)
    sessionMock.mockReturnValue(undefined)
  })

  it('reconnects to already-saved band parts without a second billable split', async () => {
    manifestMock.mockResolvedValue(['vocal', 'instrumental', 'drums', 'bass'])
    const port = createUvrGuitarNightBandPreparationPort()

    await expect(
      port.prepareBand('session-1', prepareOptions()),
    ).resolves.toEqual({ saved: ['drums', 'bass'] })
    expect(splitMock).not.toHaveBeenCalled()
  })

  it('runs the split when only the two-stem mix exists', async () => {
    manifestMock.mockResolvedValue(['vocal', 'instrumental'])
    splitMock.mockResolvedValue({
      saved: ['drums', 'bass', 'guitar', 'piano', 'other'],
      elapsedMs: 1200,
    } as Awaited<ReturnType<typeof startManagedStemSplit>>)
    const port = createUvrGuitarNightBandPreparationPort()

    await expect(
      port.prepareBand('session-1', prepareOptions()),
    ).resolves.toEqual({ saved: ['drums', 'bass', 'guitar', 'piano', 'other'] })
    expect(splitMock).toHaveBeenCalledTimes(1)
  })

  it('fails without splitting when the session cannot be reconnected', async () => {
    refreshMock.mockResolvedValue(false)
    const port = createUvrGuitarNightBandPreparationPort()

    await expect(
      port.prepareBand('session-1', prepareOptions()),
    ).rejects.toThrow('could not be reconnected')
    expect(manifestMock).not.toHaveBeenCalled()
    expect(splitMock).not.toHaveBeenCalled()
  })
})
