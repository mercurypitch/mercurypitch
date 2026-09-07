// UVR startup preserves new songs when app boot and a caller hydrate together.

import { describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord } from '@/db/entities'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({ getDb: async () => adapter }))

import { completeUvrSession, getUvrSession, initSessionStore, startUvrSession, } from './uvr-store'

describe('UVR session startup', () => {
  it('keeps a newly completed song after overlapping startup callers finish', async () => {
    const repository = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    const findAll = repository.findAll.bind(repository)
    const releaseSnapshots: (() => void)[] = []
    // IndexedDB may finish two startup reads out of order. Keep the actual
    // repository and writes; defer only delivery of its boot-time snapshot.
    const read = vi
      .spyOn(repository, 'findAll')
      .mockImplementation(async (options) => {
        const records = await findAll(options)
        if (options?.where !== undefined) return records
        return new Promise<UvrSessionRecord[]>((resolve) => {
          releaseSnapshots.push(() => resolve(records))
        })
      })

    const appStartup = initSessionStore()
    const songStartup = initSessionStore()
    await vi.waitFor(() => expect(releaseSnapshots.length).toBeGreaterThan(0))
    releaseSnapshots.shift()?.()
    await appStartup
    const sessionId = startUvrSession(
      'First song.wav',
      64,
      'audio/wav',
      'separate',
      'local',
    )

    // An older second snapshot must not erase the song created once the first
    // caller reported readiness. Before single-flight initialization it does.
    for (const release of releaseSnapshots) release()
    await songStartup
    const saved = await completeUvrSession(sessionId, {})
    read.mockRestore()

    expect(saved).toBe(true)
    expect(getUvrSession(sessionId)?.status).toBe('completed')
    expect(await findAll({ where: { appSessionId: sessionId } })).toEqual([
      expect.objectContaining({ appSessionId: sessionId, status: 'completed' }),
    ])
  })
})
