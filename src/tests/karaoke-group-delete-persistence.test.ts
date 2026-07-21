// ============================================================
// Karaoke Group Delete & Persistence Tests
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import { createGroup, deleteGroup, deleteGroupWithSessions, getAllUvrSessions, getGroupsReactive, getUvrSession, initGroupStore, initSessionStore, startUvrSession, } from '@/stores/uvr-store'

beforeEach(async () => {
  await adapter.destroy()
  vi.restoreAllMocks()
})

describe('Karaoke Group Delete & Persistence', () => {
  it('deleteGroup ungroups sessions and persists deletion across reloads', async () => {
    // 1. Initialize stores and create a group + session
    const group = await createGroup('Rock Ballads')
    const sid = startUvrSession(
      'song1.mp3',
      1000,
      'audio/mp3',
      'separate',
      'local',
    )

    // Add session to group
    const { addSessionToGroup } = await import('@/stores/uvr-store')
    await addSessionToGroup(sid, group.id)

    expect(getGroupsReactive().some((g) => g.id === group.id)).toBe(true)
    expect(getUvrSession(sid)?.groupId).toBe(group.id)

    // 2. Delete the group (ungrouping sessions)
    await deleteGroup(group.id)

    expect(getGroupsReactive().some((g) => g.id === group.id)).toBe(false)
    expect(getUvrSession(sid)?.groupId).toBeUndefined()

    // 3. Simulate full page reload (re-run initGroupStore and initSessionStore)
    await initGroupStore()
    await initSessionStore()

    // Verify group is still gone and session remains ungrouped
    expect(getGroupsReactive().some((g) => g.id === group.id)).toBe(false)
    const reloadedSession = getAllUvrSessions().find((s) => s.sessionId === sid)
    expect(reloadedSession?.groupId).toBeUndefined()
  })

  it('deleteGroupWithSessions removes group and all member sessions durably across reloads', async () => {
    // 1. Create group + 2 sessions
    const group = await createGroup('Pop Hits')
    const s1 = startUvrSession(
      'pop1.mp3',
      2000,
      'audio/mp3',
      'separate',
      'local',
    )
    const s2 = startUvrSession(
      'pop2.mp3',
      3000,
      'audio/mp3',
      'separate',
      'local',
    )

    const { addSessionToGroup } = await import('@/stores/uvr-store')
    await addSessionToGroup(s1, group.id)
    await addSessionToGroup(s2, group.id)

    expect(getGroupsReactive().some((g) => g.id === group.id)).toBe(true)
    expect(getAllUvrSessions().some((s) => s.sessionId === s1)).toBe(true)

    // 2. Delete group with sessions
    await deleteGroupWithSessions(group.id)

    // In-memory verification
    expect(getGroupsReactive().some((g) => g.id === group.id)).toBe(false)
    expect(getAllUvrSessions().some((s) => s.sessionId === s1)).toBe(false)
    expect(getAllUvrSessions().some((s) => s.sessionId === s2)).toBe(false)

    // 3. Verify DB record for group is deleted
    const repo = adapter.getRepository('sessionGroups')
    const dbGroup = await repo.findById(group.id)
    expect(dbGroup).toBeNull()

    // 4. Simulate page reload / rehydration
    await initGroupStore()
    await initSessionStore()

    expect(getGroupsReactive().some((g) => g.id === group.id)).toBe(false)
    expect(getAllUvrSessions().some((s) => s.sessionId === s1)).toBe(false)
  })
})
