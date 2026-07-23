import { describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import type { SessionGroupRecord, UvrSessionRecord } from '@/db/entities'
import { getAllUvrSessions, getGroupsReactive, initGroupStore, initSessionStore, } from '@/stores/app-store'

function sessionRecord(
  appSessionId: string,
  groupId?: string,
): Omit<UvrSessionRecord, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    appSessionId,
    userId: 'local',
    status: 'idle',
    progress: 0,
    originalFileName: `${appSessionId}.mp3`,
    originalFileSize: 1234,
    originalFileType: 'audio/mpeg',
    processingMode: 'local',
    appCreatedAt: Date.now(),
    groupId,
  }
}

describe('UVR group membership startup reconciliation', () => {
  it('repairs both session-only and legacy group-only assignments', async () => {
    const groupRepo = adapter.getRepository<SessionGroupRecord>('sessionGroups')
    const sessionRepo = adapter.getRepository<UvrSessionRecord>('uvrSessions')

    const sessionCanonicalGroup = await groupRepo.create({
      name: 'Session canonical',
      sessionIds: [],
    })
    const legacyIndexGroup = await groupRepo.create({
      name: 'Legacy index',
      sessionIds: ['legacy-index-only'],
    })
    await sessionRepo.create(
      sessionRecord('session-group-only', sessionCanonicalGroup.id),
    )
    await sessionRepo.create(sessionRecord('legacy-index-only'))

    await initGroupStore()
    await initSessionStore()

    expect(
      getGroupsReactive().find((group) => group.id === sessionCanonicalGroup.id)
        ?.sessionIds,
    ).toEqual(['session-group-only'])
    expect(
      getAllUvrSessions().find(
        (session) => session.sessionId === 'legacy-index-only',
      )?.groupId,
    ).toBe(legacyIndexGroup.id)

    expect(
      (await groupRepo.findById(sessionCanonicalGroup.id))?.sessionIds,
    ).toEqual(['session-group-only'])
    const persistedLegacy = await sessionRepo.findAll({
      where: { appSessionId: 'legacy-index-only' },
      limit: 1,
    })
    expect(persistedLegacy[0]?.groupId).toBe(legacyIndexGroup.id)
  })
})
