// Guitar Night UVR adapter tests protect catalog truth, strict failures, and hydrated mix claims.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord } from '@/db/entities'
import type { UvrStemSnapshotEntry } from '@/db/services/uvr-read-service'

const adapterReads = vi.hoisted(() => ({
  readUvrSessionRecords: vi.fn(),
  readUvrStemSnapshot: vi.fn(),
  openUvrStemLease: vi.fn(),
}))

vi.mock('@/db/services/uvr-read-service', () => ({
  readUvrSessionRecords: adapterReads.readUvrSessionRecords,
  readUvrStemSnapshot: adapterReads.readUvrStemSnapshot,
}))

vi.mock('@/lib/uvr-stem-lease', () => ({
  openUvrStemLease: adapterReads.openUvrStemLease,
}))

import { createUvrGuitarNightSongPort } from '@/features/guitar-night/uvr-song-port'

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function sessionRecord(
  sessionId: string,
  status: string,
  updatedAt = '2026-08-06T11:00:00.000Z',
): UvrSessionRecord {
  return {
    id: `${sessionId}-${updatedAt}`,
    createdAt: '2026-08-06T09:00:00.000Z',
    updatedAt,
    appSessionId: sessionId,
    userId: 'local-user',
    status,
    progress: status === 'completed' ? 100 : 40,
    originalFileName: `${sessionId}.wav`,
    originalFileSize: 100,
    originalFileType: 'audio/wav',
    processingMode: 'local',
    appCreatedAt: Date.UTC(2026, 7, 6),
  }
}

function snapshotStem(
  kind: UvrStemSnapshotEntry['kind'],
): UvrStemSnapshotEntry {
  return {
    kind,
    mimeType: 'audio/wav',
    data: new ArrayBuffer(8),
    sizeBytes: 8,
  }
}

describe('createUvrGuitarNightSongPort', () => {
  beforeEach(() => {
    adapterReads.readUvrSessionRecords.mockReset()
    adapterReads.readUvrStemSnapshot.mockReset()
    adapterReads.openUvrStemLease.mockReset()
  })

  it('deduplicates the strict catalog and exposes only completed songs', async () => {
    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('velvet', 'processing', '2026-08-06T10:00:00.000Z'),
      sessionRecord('velvet', 'completed'),
      sessionRecord('unfinished', 'processing'),
    ])
    const port = createUvrGuitarNightSongPort()

    await port.initialize()

    expect(port.completedSongs()).toEqual([
      {
        sessionId: 'velvet',
        title: 'velvet.wav',
        createdAt: Date.UTC(2026, 7, 6),
      },
    ])
    await expect(
      port.openSession('missing', new AbortController().signal),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(
      port.openSession('unfinished', new AbortController().signal),
    ).resolves.toEqual({ ok: false, code: 'not-completed' })
  })

  it('plans from one stem snapshot and mutes only an actually leased guitar', async () => {
    const snapshot = [
      snapshotStem('drums'),
      snapshotStem('bass'),
      snapshotStem('guitar'),
    ]
    const release = vi.fn()
    const record = sessionRecord('velvet', 'completed')
    record.stemMetaJson = JSON.stringify({
      drums: { duration: 183.25 },
      guitar: { duration: 'invalid' },
    })
    adapterReads.readUvrSessionRecords.mockResolvedValue([record])
    adapterReads.readUvrStemSnapshot.mockResolvedValue(snapshot)
    adapterReads.openUvrStemLease.mockResolvedValue({
      assets: [
        { kind: 'drums', url: 'blob:drums', sizeBytes: 8 },
        { kind: 'bass', url: 'blob:bass', sizeBytes: 8 },
        { kind: 'guitar', url: 'blob:guitar', sizeBytes: 8 },
      ],
      release,
    })
    const port = createUvrGuitarNightSongPort()
    await port.initialize()

    const result = await port.openSession(
      'velvet',
      new AbortController().signal,
    )

    expect(adapterReads.openUvrStemLease).toHaveBeenCalledWith(
      'velvet',
      ['drums', 'bass', 'guitar'],
      expect.objectContaining({ snapshot }),
    )
    expect(result).toMatchObject({
      ok: true,
      lease: {
        defaultMix: {
          kind: 'parts',
          audible: ['drums', 'bass'],
          muted: ['guitar'],
        },
        stems: expect.arrayContaining([
          expect.objectContaining({
            kind: 'drums',
            durationSeconds: 183.25,
          }),
          expect.objectContaining({
            kind: 'guitar',
            durationSeconds: undefined,
          }),
        ]),
      },
    })
  })

  it('releases a partial lease that cannot provide accompaniment', async () => {
    const release = vi.fn()
    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('velvet', 'completed'),
    ])
    adapterReads.readUvrStemSnapshot.mockResolvedValue([
      snapshotStem('vocal'),
      snapshotStem('instrumental'),
    ])
    adapterReads.openUvrStemLease.mockResolvedValue({
      assets: [{ kind: 'vocal', url: 'blob:vocal', sizeBytes: 8 }],
      release,
    })
    const port = createUvrGuitarNightSongPort()
    await port.initialize()

    await expect(
      port.openSession('velvet', new AbortController().signal),
    ).resolves.toEqual({ ok: false, code: 'missing-local-audio' })
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('propagates catalog and stem transaction failures to the controller', async () => {
    const catalogFailure = new Error('catalog unavailable')
    adapterReads.readUvrSessionRecords.mockRejectedValue(catalogFailure)
    const failedPort = createUvrGuitarNightSongPort()
    await expect(failedPort.initialize()).rejects.toBe(catalogFailure)

    adapterReads.readUvrSessionRecords.mockResolvedValue([
      sessionRecord('velvet', 'completed'),
    ])
    const stemFailure = new Error('stem transaction failed')
    adapterReads.readUvrStemSnapshot.mockRejectedValue(stemFailure)
    const port = createUvrGuitarNightSongPort()
    await port.initialize()
    await expect(
      port.openSession('velvet', new AbortController().signal),
    ).rejects.toBe(stemFailure)
  })

  it('keeps the newer catalog when initialize reads resolve out of order', async () => {
    const olderRead = deferred<UvrSessionRecord[]>()
    const newerRead = deferred<UvrSessionRecord[]>()
    adapterReads.readUvrSessionRecords
      .mockReturnValueOnce(olderRead.promise)
      .mockReturnValueOnce(newerRead.promise)
    const port = createUvrGuitarNightSongPort()

    const olderInitialize = port.initialize()
    const newerInitialize = port.initialize()
    newerRead.resolve([sessionRecord('newer', 'completed')])
    await newerInitialize
    olderRead.resolve([sessionRecord('older', 'completed')])
    await olderInitialize

    expect(port.completedSongs()).toEqual([
      {
        sessionId: 'newer',
        title: 'newer.wav',
        createdAt: Date.UTC(2026, 7, 6),
      },
    ])
  })
})
