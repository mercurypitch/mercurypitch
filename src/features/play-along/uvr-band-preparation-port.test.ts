// Drum band-preparation tests require a complete reconciled 6s partition before paid output is reused.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUvrStemManifest } from '@/db/services/uvr-read-service'
import { startManagedStemSplit } from '@/lib/uvr-auto-resume'
import { getUvrSession, refreshUvrSessionFromDb } from '@/stores/uvr-store'
import { DRUM_PLAY_ALONG_POLICY } from './song-port'
import { createUvrPlayAlongBandPreparationPort } from './uvr-band-preparation-port'

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

const COMPLETE_PARTS = [
  'vocal',
  'instrumental',
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
] as const

function prepareOptions() {
  return {
    signal: new AbortController().signal,
    onUpdate: vi.fn(),
  }
}

describe('Drum UVR band preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshMock.mockResolvedValue(true)
    sessionMock.mockReturnValue(undefined)
    splitMock.mockResolvedValue({
      saved: ['drums', 'bass', 'guitar', 'piano', 'other'],
      elapsedMs: 1200,
    } as Awaited<ReturnType<typeof startManagedStemSplit>>)
  })

  it('reuses a complete durable partition without another billable split', async () => {
    manifestMock.mockResolvedValue([...COMPLETE_PARTS])
    const port = createUvrPlayAlongBandPreparationPort(DRUM_PLAY_ALONG_POLICY)

    await expect(
      port.prepareBand('session-1', prepareOptions()),
    ).resolves.toEqual({
      saved: ['drums', 'bass', 'guitar', 'piano', 'other'],
    })
    expect(splitMock).not.toHaveBeenCalled()
  })

  it('reports a complete durable partition through the preflight-free reuse probe', async () => {
    manifestMock.mockResolvedValue([...COMPLETE_PARTS])
    const port = createUvrPlayAlongBandPreparationPort(DRUM_PLAY_ALONG_POLICY)

    await expect(
      port.reusePreparedBand?.('session-1', {
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      saved: ['drums', 'bass', 'guitar', 'piano', 'other'],
    })
    expect(splitMock).not.toHaveBeenCalled()
  })

  it('leaves incomplete local parts for the authorized preparation path', async () => {
    manifestMock.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'other',
    ])
    const port = createUvrPlayAlongBandPreparationPort(DRUM_PLAY_ALONG_POLICY)

    await expect(
      port.reusePreparedBand?.('session-1', {
        signal: new AbortController().signal,
      }),
    ).resolves.toBeNull()
    expect(splitMock).not.toHaveBeenCalled()
  })

  it('continues separation when any required Drum part is missing', async () => {
    manifestMock
      .mockResolvedValueOnce([
        'vocal',
        'instrumental',
        'drums',
        'bass',
        'guitar',
        'other',
      ])
      .mockResolvedValueOnce([...COMPLETE_PARTS])
    const port = createUvrPlayAlongBandPreparationPort(DRUM_PLAY_ALONG_POLICY)

    await expect(
      port.prepareBand('session-1', prepareOptions()),
    ).resolves.toEqual({
      saved: ['drums', 'bass', 'guitar', 'piano', 'other'],
    })
    expect(splitMock).toHaveBeenCalledOnce()
  })

  it('rejects a partial split result instead of restaging incomplete backing', async () => {
    const partial = [
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'other',
    ] as const
    manifestMock.mockResolvedValue([...partial])
    const port = createUvrPlayAlongBandPreparationPort(DRUM_PLAY_ALONG_POLICY)

    await expect(
      port.prepareBand('session-1', prepareOptions()),
    ).rejects.toThrow('did not save every required part')
    expect(splitMock).toHaveBeenCalledOnce()
  })
})
