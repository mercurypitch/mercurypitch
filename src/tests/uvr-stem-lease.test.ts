// UVR stem lease tests protect one-read hydration, object URL ownership, and cancellation.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrStemType } from '@/db/entities'
import type { UvrStemSnapshotEntry } from '@/db/services/uvr-read-service'

vi.mock('@/db/services/uvr-read-service', () => ({
  readUvrStemSnapshot: vi.fn(),
}))

import { readUvrStemSnapshot } from '@/db/services/uvr-read-service'
import { openUvrStemLease } from '@/lib/uvr-stem-lease'

const mockedReadUvrStemSnapshot = vi.mocked(readUvrStemSnapshot)

function snapshotStem(
  kind: UvrStemType,
  sizeBytes = 1024,
): UvrStemSnapshotEntry {
  return {
    kind,
    mimeType: 'audio/wav',
    data: new ArrayBuffer(16),
    sizeBytes,
  }
}

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

describe('openUvrStemLease', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockedReadUvrStemSnapshot.mockReset()
    createObjectURL = vi.fn()
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('leases only requested snapshot stems and preserves their metadata', async () => {
    mockedReadUvrStemSnapshot.mockResolvedValue([
      snapshotStem('vocal'),
      snapshotStem('guitar', 2048),
      snapshotStem('bass'),
    ])
    createObjectURL.mockReturnValueOnce('blob:guitar')

    const lease = await openUvrStemLease('session-1', [
      'guitar',
      'guitar',
      'drums',
    ])

    expect(mockedReadUvrStemSnapshot).toHaveBeenCalledWith('session-1')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(lease?.assets).toEqual([
      {
        kind: 'guitar',
        url: 'blob:guitar',
        sizeBytes: 2048,
        durationSeconds: undefined,
      },
    ])
  })

  it('revokes each owned URL exactly once when release is repeated', async () => {
    mockedReadUvrStemSnapshot.mockResolvedValue([
      snapshotStem('guitar'),
      snapshotStem('bass'),
    ])
    createObjectURL
      .mockReturnValueOnce('blob:guitar')
      .mockReturnValueOnce('blob:bass')

    const lease = await openUvrStemLease('session-1', ['guitar', 'bass'])
    lease?.release()
    lease?.release()

    expect(revokeObjectURL.mock.calls).toEqual([['blob:guitar'], ['blob:bass']])
  })

  it('rejects AbortError when cancellation wins the snapshot read', async () => {
    const lateSnapshot = deferred<readonly UvrStemSnapshotEntry[]>()
    mockedReadUvrStemSnapshot.mockReturnValue(lateSnapshot.promise)
    const controller = new AbortController()

    const opening = openUvrStemLease('session-1', ['guitar'], {
      signal: controller.signal,
    })
    controller.abort()
    lateSnapshot.resolve([snapshotStem('guitar')])

    await expect(opening).rejects.toMatchObject({ name: 'AbortError' })
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('binds an opened lease to its abort signal without double revoking', async () => {
    mockedReadUvrStemSnapshot.mockResolvedValue([snapshotStem('guitar')])
    createObjectURL.mockReturnValue('blob:guitar')
    const controller = new AbortController()
    const lease = await openUvrStemLease('session-1', ['guitar'], {
      signal: controller.signal,
    })

    controller.abort()
    lease?.release()

    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:guitar')
  })

  it('releases earlier URLs when a later URL creation fails', async () => {
    const failure = new Error('object URL unavailable')
    mockedReadUvrStemSnapshot.mockResolvedValue([
      snapshotStem('guitar'),
      snapshotStem('bass'),
    ])
    createObjectURL
      .mockReturnValueOnce('blob:guitar')
      .mockImplementationOnce(() => {
        throw failure
      })

    await expect(
      openUvrStemLease('session-1', ['guitar', 'bass']),
    ).rejects.toBe(failure)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:guitar')
  })

  it('returns null without creating URLs when requested stems do not exist', async () => {
    mockedReadUvrStemSnapshot.mockResolvedValue([snapshotStem('vocal')])

    await expect(
      openUvrStemLease('session-1', ['guitar', 'instrumental']),
    ).resolves.toBeNull()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('reuses a caller snapshot without reading durable rows again', async () => {
    createObjectURL.mockReturnValue('blob:guitar')
    const lease = await openUvrStemLease('session-1', ['guitar'], {
      snapshot: [snapshotStem('guitar'), snapshotStem('bass')],
    })

    expect(mockedReadUvrStemSnapshot).not.toHaveBeenCalled()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(lease?.assets).toHaveLength(1)
  })
})
