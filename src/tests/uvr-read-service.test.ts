// UVR read-service tests protect strict failure propagation and one-snapshot deduplication.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrStemBlob } from '@/db/entities'

const localReads = vi.hoisted(() => ({
  readAllStrict: vi.fn(),
  readByIndexStrict: vi.fn(),
}))

vi.mock('@/db/local-database', () => ({
  getLocalDatabase: () => localReads,
}))

import { readUvrSessionRecords, readUvrStemSnapshot, } from '@/db/services/uvr-read-service'

function stemRow(
  stemType: UvrStemBlob['stemType'],
  createdAt: string,
  size: number,
): UvrStemBlob {
  return {
    id: `${stemType}-${createdAt}`,
    createdAt,
    updatedAt: createdAt,
    sessionId: 'session-1',
    stemType,
    mimeType: 'audio/wav',
    data: new ArrayBuffer(size),
    size,
    fileName: `${stemType}.wav`,
  }
}

describe('UVR strict read service', () => {
  beforeEach(() => {
    localReads.readAllStrict.mockReset()
    localReads.readByIndexStrict.mockReset()
  })

  it('propagates a session-catalog read failure instead of reporting an empty library', async () => {
    const failure = new Error('IndexedDB unavailable')
    localReads.readAllStrict.mockRejectedValue(failure)

    await expect(readUvrSessionRecords()).rejects.toBe(failure)
    expect(localReads.readAllStrict).toHaveBeenCalledWith('uvrSessions')
  })

  it('keeps the newest row per playable kind and drops the uploaded original', async () => {
    localReads.readByIndexStrict.mockResolvedValue([
      stemRow('guitar', '2026-08-06T10:00:00.000Z', 10),
      stemRow('guitar', '2026-08-06T11:00:00.000Z', 20),
      stemRow('bass', '2026-08-06T10:30:00.000Z', 30),
      stemRow('original', '2026-08-06T09:00:00.000Z', 100),
    ])

    const snapshot = await readUvrStemSnapshot('session-1')

    expect(localReads.readByIndexStrict).toHaveBeenCalledWith(
      'uvrStemBlobs',
      'sessionId',
      'session-1',
    )
    expect(snapshot).toEqual([
      {
        kind: 'guitar',
        mimeType: 'audio/wav',
        data: expect.any(ArrayBuffer),
        sizeBytes: 20,
      },
      {
        kind: 'bass',
        mimeType: 'audio/wav',
        data: expect.any(ArrayBuffer),
        sizeBytes: 30,
      },
    ])
    expect(Object.isFrozen(snapshot)).toBe(true)
  })

  it('propagates a stem snapshot failure for honest recovery copy', async () => {
    const failure = new Error('stem transaction failed')
    localReads.readByIndexStrict.mockRejectedValue(failure)

    await expect(readUvrStemSnapshot('session-1')).rejects.toBe(failure)
  })
})
