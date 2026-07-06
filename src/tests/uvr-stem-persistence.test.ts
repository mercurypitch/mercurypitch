// ============================================================
// UVR stem persistence — durable local blobs
// ============================================================
//
// Regression guard for the "GPU processed but can't open / retry" bug.
//
// A completed separation's stems must be persisted to IndexedDB and
// re-hydratable to fresh object URLs on every load. This is the durable
// contract both halves of the fix rely on:
//   - the server pipeline now awaits saveStemBlob before marking the session
//     complete (src/lib/uvr-processing-pipeline.ts), and
//   - UvrPanel.ensureHydrated re-derives outputs from these blobs for ANY
//     completed session — server sessions included, whose server URLs expire.
// If saving or re-hydrating breaks, reopened sessions fall back to the manual
// stem-import screen; these tests catch that.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import { getStemBlob, hydrateStemUrls, saveStemBlob, } from '@/db/services/uvr-service'

// jsdom's Blob has no arrayBuffer(); saveStemBlob relies on it (real browsers
// implement it). Polyfill via FileReader so the service runs under test.
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
})

const wav = (bytes: number[]): Blob =>
  new Blob([new Uint8Array(bytes)], { type: 'audio/wav' })

describe('UVR stem persistence', () => {
  it('re-hydrates a completed session to stem URLs from local blobs', async () => {
    const sessionId = 'server-session-1'
    await saveStemBlob(sessionId, 'vocal', wav([1, 2, 3]), 'vocal.wav')
    await saveStemBlob(
      sessionId,
      'instrumental',
      wav([4, 5, 6]),
      'instrumental.wav',
    )

    const urls = await hydrateStemUrls(sessionId)

    // Both stems come back as usable URLs — this is what a reopened session
    // (local OR server) now rebuilds its outputs from, instead of a dead
    // in-memory / expired-server URL.
    expect(urls).not.toBeNull()
    expect(urls?.vocal).toBeTruthy()
    expect(urls?.instrumental).toBeTruthy()
  })

  it('returns null when the session has no local stems (the retry / import fallback path)', async () => {
    expect(await hydrateStemUrls('never-saved')).toBeNull()
  })

  it('round-trips the stem bytes intact', async () => {
    const sessionId = 'server-session-2'
    await saveStemBlob(sessionId, 'vocal', wav([9, 8, 7, 6]), 'vocal.wav')

    const blob = await getStemBlob(sessionId, 'vocal')
    expect(blob).not.toBeNull()
    const bytes = new Uint8Array(await (blob as Blob).arrayBuffer())
    expect(Array.from(bytes)).toEqual([9, 8, 7, 6])
  })
})
