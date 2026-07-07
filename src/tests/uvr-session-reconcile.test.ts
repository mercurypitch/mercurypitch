// ============================================================
// UVR session reconciliation + orphan pruning + durable completion
// ============================================================
//
// End-to-end (store + service) coverage that the Karaoke tab always shows the
// TRUE status after a reload, and that paid stems aren't reported "done" until
// they're durably on disk.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import type { UvrSessionRecord } from '@/db/entities'
import { saveStemBlobDurable } from '@/db/services/uvr-service'
import { completeUvrSession, getUvrSession, pruneOrphanedCompletedSessions, reconcileInterruptedSessions, saveAllUvrSessions, setFinalizingUvrSession, startUvrSession, } from '@/stores/app-store'

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
  saveAllUvrSessions([]) // reset the module-level in-memory cache between tests
  vi.restoreAllMocks()
})

const wav = (bytes: number[]): Blob =>
  new Blob([new Uint8Array(bytes)], { type: 'audio/wav' })

const newSession = (name: string): string =>
  startUvrSession(name, 100, 'audio/mpeg', 'separate', 'server')

async function dbStatus(sessionId: string): Promise<string | undefined> {
  const repo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
  const recs = await repo.findAll({ where: { appSessionId: sessionId } })
  return recs[0]?.status
}

describe('completeUvrSession — durable', () => {
  it('writes the completed record to IndexedDB and reports success', async () => {
    const id = newSession('a.mp3')
    const ok = await completeUvrSession(id, { vocal: 'blob:x' }, {})
    expect(ok).toBe(true)
    // The record survives a reload because it's actually in the DB now.
    expect(await dbStatus(id)).toBe('completed')
  })

  it('reports failure when the record write throws (no false "done")', async () => {
    const id = newSession('b.mp3')
    const repo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    // Fail both the initial attempt and the single retry.
    vi.spyOn(repo, 'create').mockRejectedValue(new Error('DB locked'))
    vi.spyOn(repo, 'update').mockRejectedValue(new Error('DB locked'))
    const ok = await completeUvrSession(id, { vocal: 'blob:x' }, {})
    expect(ok).toBe(false)
  })
})

describe('reconcileInterruptedSessions', () => {
  it('promotes a finalizing session WITH stems to completed', async () => {
    const id = newSession('c.mp3')
    setFinalizingUvrSession(id)
    await saveStemBlobDurable(id, 'vocal', wav([1, 2, 3]), 'v.wav')

    await reconcileInterruptedSessions()

    expect(getUvrSession(id)?.status).toBe('completed')
    expect(await dbStatus(id)).toBe('completed')
  })

  it('marks a finalizing session WITHOUT stems as interrupted', async () => {
    const id = newSession('d.mp3')
    setFinalizingUvrSession(id)

    await reconcileInterruptedSessions()

    expect(getUvrSession(id)?.status).toBe('interrupted')
    expect(getUvrSession(id)?.error).toMatch(/reloaded/i)
  })

  it('leaves already-completed sessions untouched', async () => {
    const id = newSession('e.mp3')
    await saveStemBlobDurable(id, 'vocal', wav([1]), 'v.wav')
    await completeUvrSession(id, { vocal: 'blob:x' }, {})

    await reconcileInterruptedSessions()

    expect(getUvrSession(id)?.status).toBe('completed')
  })
})

describe('pruneOrphanedCompletedSessions', () => {
  it('removes a completed session whose stems were lost', async () => {
    const id = newSession('f.mp3')
    // Completed but nothing durable saved — the pre-fix data-loss shape.
    await completeUvrSession(id, {}, {})

    const pruned = await pruneOrphanedCompletedSessions()

    expect(pruned).toBeGreaterThanOrEqual(1)
    expect(getUvrSession(id)).toBeUndefined()
    expect(await dbStatus(id)).toBeUndefined()
  })

  it('keeps a completed session that still has its stems', async () => {
    const id = newSession('g.mp3')
    await saveStemBlobDurable(id, 'vocal', wav([1]), 'v.wav')
    await completeUvrSession(id, { vocal: 'blob:x' }, {})

    await pruneOrphanedCompletedSessions()

    expect(getUvrSession(id)?.status).toBe('completed')
  })

  it('does not touch in-progress or errored sessions', async () => {
    const id = newSession('h.mp3')
    setFinalizingUvrSession(id) // finalizing, no stems — not "completed"

    const pruned = await pruneOrphanedCompletedSessions()

    expect(pruned).toBe(0)
    expect(getUvrSession(id)).toBeDefined()
  })
})
