// ============================================================
// UVR chunk count — one session's field, written as one session's row
// ============================================================
//
// A local separation records how many chunks it runs in, for the processing
// view. The pipeline used to set that on the cached session object in place
// and then save the whole library. The whole-library save rewrites every row
// from this page's list and deletes any row the list lacks, so a song another
// tab had separated, which this page never loaded, lost its record.
//
// The real store, over the in-memory adapter.

import { setImmediate } from 'node:timers'
import { describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord } from '@/db/entities'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const adapter = new InMemoryAdapter()
vi.mock('@/db', () => ({ getDb: async () => adapter }))

import { currentUvrSession, getUvrSession, persistSessionDurable, setUvrSessionChunkCount, startUvrSession, } from './uvr-store'

/** Lets every queued write finish; the fake I/O is promises over Maps. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve))

describe('setUvrSessionChunkCount', () => {
  it('shows the count at once, and leaves alone what it was not asked to change', async () => {
    const sessionId = startUvrSession(
      'song.wav',
      12,
      'audio/wav',
      'separate',
      'local',
    )
    expect(await persistSessionDurable(getUvrSession(sessionId)!)).toBe(true)
    // A song another tab separated: its row is here, this page never read it.
    const sessions = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    await sessions.create({
      appSessionId: 'other-tab-song',
      status: 'completed',
      progress: 100,
      processingMode: 'local',
      originalFileName: 'other.wav',
      originalFileSize: 1,
      originalFileType: 'audio/wav',
    } as Omit<UvrSessionRecord, 'id' | 'createdAt' | 'updatedAt'>)
    const snapshot = getUvrSession(sessionId)!

    setUvrSessionChunkCount(sessionId, 7)
    await settle()

    expect(currentUvrSession()?.numChunks).toBe(7)
    expect(snapshot.numChunks).toBeUndefined()
    const rows = await sessions.findAll()
    expect(rows.map((row) => row.appSessionId).sort()).toEqual(
      ['other-tab-song', sessionId].sort(),
    )
    expect(rows.find((row) => row.appSessionId === sessionId)?.numChunks).toBe(
      7,
    )
  })
})
