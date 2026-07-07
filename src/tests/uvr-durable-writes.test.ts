// ============================================================
// UVR durable-write guarantees
// ============================================================
//
// Covers the data-integrity contracts that keep paid stem output from being
// lost: retrying/reporting writes, quota detection, upserts that never wipe the
// old row on a failed write, and the blob-existence checks that back
// session reconciliation + orphan pruning.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import { durableWrite, hasRoomFor, isQuotaError } from '@/db/durable-write'
import type { UvrStemBlob } from '@/db/entities'
import { countStemBlobs, deleteUvrSessionFromDb, getStemFingerprintData, saveStemBlobDurable, saveStemFingerprintData, sessionHasPlayableStems, } from '@/db/services/uvr-service'

// jsdom's Blob has no arrayBuffer(); the service relies on it (real browsers
// implement it). Polyfill via FileReader.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Blob.prototype as any).arrayBuffer = function (
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as ArrayBuffer)
      fr.onerror = () => reject(fr.error)
      fr.readAsArrayBuffer(this)
    })
  }
}

beforeEach(async () => {
  await adapter.destroy()
  vi.restoreAllMocks()
})

const wav = (bytes: number[]): Blob =>
  new Blob([new Uint8Array(bytes)], { type: 'audio/wav' })

// ── durableWrite ─────────────────────────────────────────────────

describe('durableWrite', () => {
  it('returns ok with the value on success', async () => {
    const res = await durableWrite('t', async () => 42)
    expect(res.ok).toBe(true)
    expect(res.value).toBe(42)
    expect(res.quotaExceeded).toBe(false)
  })

  it('retries once and succeeds on the second attempt', async () => {
    let calls = 0
    const res = await durableWrite('t', async () => {
      calls++
      if (calls === 1) throw new Error('transient')
      return 'ok'
    })
    expect(calls).toBe(2)
    expect(res.ok).toBe(true)
    expect(res.value).toBe('ok')
  })

  it('fails after exhausting retries', async () => {
    let calls = 0
    const res = await durableWrite(
      't',
      async () => {
        calls++
        throw new Error('persistent')
      },
      1,
    )
    expect(calls).toBe(2) // initial + 1 retry
    expect(res.ok).toBe(false)
    expect(res.error).toBeInstanceOf(Error)
  })

  it('does NOT retry on a quota error, and flags it', async () => {
    let calls = 0
    const res = await durableWrite('t', async () => {
      calls++
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(calls).toBe(1) // no retry — a full disk won't clear itself
    expect(res.ok).toBe(false)
    expect(res.quotaExceeded).toBe(true)
  })
})

describe('isQuotaError', () => {
  it('detects QuotaExceededError across shapes', () => {
    expect(isQuotaError(new DOMException('x', 'QuotaExceededError'))).toBe(true)
    expect(isQuotaError(new Error('The quota has been exceeded'))).toBe(true)
    expect(isQuotaError(new Error('some other error'))).toBe(false)
    expect(isQuotaError(null)).toBe(false)
  })
})

describe('hasRoomFor', () => {
  it('allows the write when storage cannot be estimated', async () => {
    // jsdom has no navigator.storage.estimate → unknown → allow (never blocks).
    expect(await hasRoomFor(10 * 1024 * 1024)).toBe(true)
  })
})

// ── saveStemBlobDurable ──────────────────────────────────────────

describe('saveStemBlobDurable', () => {
  it('persists and reports ok', async () => {
    const res = await saveStemBlobDurable(
      's1',
      'vocal',
      wav([1, 2, 3]),
      'v.wav',
    )
    expect(res.ok).toBe(true)
    expect(typeof res.value).toBe('string')
    expect(await countStemBlobs('s1')).toBe(1)
  })

  it('reports failure (not a silent loss) when the write throws', async () => {
    const repo = adapter.getRepository<UvrStemBlob>('uvrStemBlobs')
    vi.spyOn(repo, 'create').mockRejectedValue(new Error('DB locked'))
    const res = await saveStemBlobDurable('s2', 'vocal', wav([1]), 'v.wav')
    expect(res.ok).toBe(false)
    expect(await countStemBlobs('s2')).toBe(0)
  })

  it('flags a quota failure so the caller can warn the user', async () => {
    const repo = adapter.getRepository<UvrStemBlob>('uvrStemBlobs')
    vi.spyOn(repo, 'create').mockRejectedValue(
      new DOMException('full', 'QuotaExceededError'),
    )
    const res = await saveStemBlobDurable('s3', 'vocal', wav([1]), 'v.wav')
    expect(res.ok).toBe(false)
    expect(res.quotaExceeded).toBe(true)
  })
})

// ── Blob-existence checks (back reconciliation + pruning) ─────────

describe('sessionHasPlayableStems', () => {
  it('is true when a vocal or instrumental stem exists', async () => {
    await saveStemBlobDurable('s', 'vocal', wav([1]), 'v.wav')
    expect(await sessionHasPlayableStems('s')).toBe(true)
  })

  it('is false when only the original is stored (not openable)', async () => {
    await saveStemBlobDurable('s', 'original', wav([1]), 'orig.wav')
    expect(await sessionHasPlayableStems('s')).toBe(false)
  })

  it('is false when the session has no blobs', async () => {
    expect(await sessionHasPlayableStems('missing')).toBe(false)
  })
})

// ── Upsert never loses the old row on a failed write ─────────────

describe('saveStemFingerprintData (create-then-delete upsert)', () => {
  const fp = (n: number) =>
    ({ version: n, peaks: [] }) as unknown as Parameters<
      typeof saveStemFingerprintData
    >[1]

  it('replaces the fingerprint on a successful upsert', async () => {
    await saveStemFingerprintData('s', fp(1))
    await saveStemFingerprintData('s', fp(2))
    const loaded = await getStemFingerprintData('s')
    expect((loaded as unknown as { version: number })?.version).toBe(2)
    // Exactly one row — the old one was pruned after the new one landed.
    const repo = adapter.getRepository('uvrStemFingerprints')
    expect(await repo.count({ where: { sessionId: 's' } })).toBe(1)
  })

  it('keeps the existing fingerprint when the new write throws', async () => {
    await saveStemFingerprintData('s', fp(1))
    const repo = adapter.getRepository('uvrStemFingerprints')
    vi.spyOn(repo, 'create').mockRejectedValueOnce(new Error('DB locked'))

    const ok = await saveStemFingerprintData('s', fp(2))
    expect(ok).toBe(false)

    // The old fingerprint must survive — delete-then-create would have lost it.
    const loaded = await getStemFingerprintData('s')
    expect((loaded as unknown as { version: number })?.version).toBe(1)
  })
})

// ── Delete cascade ───────────────────────────────────────────────

describe('deleteUvrSessionFromDb', () => {
  it('removes the stem blobs and reports success', async () => {
    await saveStemBlobDurable('s', 'vocal', wav([1]), 'v.wav')
    await saveStemBlobDurable('s', 'instrumental', wav([2]), 'i.wav')
    expect(await countStemBlobs('s')).toBe(2)

    const ok = await deleteUvrSessionFromDb('s')
    expect(ok).toBe(true)
    expect(await countStemBlobs('s')).toBe(0)
  })

  it('returns false (does not throw) when a delete fails', async () => {
    await saveStemBlobDurable('s', 'vocal', wav([1]), 'v.wav')
    const repo = adapter.getRepository<UvrStemBlob>('uvrStemBlobs')
    vi.spyOn(repo, 'delete').mockRejectedValue(new Error('locked'))
    expect(await deleteUvrSessionFromDb('s')).toBe(false)
  })
})
