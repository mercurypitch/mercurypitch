import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionGroupRecord, UvrSessionLyrics, UvrSessionRecord, UvrStemBlob, UvrStemFingerprint, } from '@/db'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

const loadStore = () => import('@/stores/uvr-store')

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetModules()
  await adapter.destroy()
  let now = 10_000
  vi.spyOn(Date, 'now').mockImplementation(() => now++)
})

describe('karaoke group deletion persistence', () => {
  it('ungroups canonical members and persists the deletion across initialization', async () => {
    const {
      addSessionToGroup,
      createGroup,
      deleteGroup,
      getGroupsReactive,
      getUvrSession,
      initGroupStore,
      initSessionStore,
      startUvrSession,
    } = await loadStore()
    const group = await createGroup('Rock Ballads')
    const sessionId = startUvrSession(
      'song1.mp3',
      1_000,
      'audio/mpeg',
      'separate',
      'local',
    )
    await addSessionToGroup(sessionId, group.id)

    await deleteGroup(group.id)

    expect(getGroupsReactive()).not.toContainEqual(
      expect.objectContaining({ id: group.id }),
    )
    expect(getUvrSession(sessionId)?.groupId).toBeUndefined()

    await initGroupStore()
    await initSessionStore()
    expect(getGroupsReactive()).not.toContainEqual(
      expect.objectContaining({ id: group.id }),
    )
    expect(getUvrSession(sessionId)?.groupId).toBeUndefined()
  })

  it('atomically removes canonical members and all dependent records', async () => {
    const {
      addSessionToGroup,
      createGroup,
      deleteGroupWithSessions,
      getGroupsReactive,
      getUvrSession,
      initGroupStore,
      initSessionStore,
      startUvrSession,
    } = await loadStore()
    const group = await createGroup('Pop Hits')
    const sessionId = startUvrSession(
      'pop.mp3',
      2_000,
      'audio/mpeg',
      'separate',
      'local',
    )
    await addSessionToGroup(sessionId, group.id)

    await adapter.getRepository<UvrStemBlob>('uvrStemBlobs').create({
      sessionId,
      stemType: 'vocal',
      mimeType: 'audio/wav',
      data: new ArrayBuffer(4),
      size: 4,
      fileName: 'vocal.wav',
    })
    await adapter
      .getRepository<UvrStemFingerprint>('uvrStemFingerprints')
      .create({ sessionId, fingerprintJson: '{}' })
    await adapter.getRepository<UvrSessionLyrics>('uvrSessionLyrics').create({
      sessionId,
      text: 'hello',
      format: 'txt',
      filename: 'lyrics.txt',
    })

    await deleteGroupWithSessions(group.id)

    expect(getUvrSession(sessionId)).toBeUndefined()
    expect(getGroupsReactive()).not.toContainEqual(
      expect.objectContaining({ id: group.id }),
    )
    expect(
      await adapter
        .getRepository<UvrStemBlob>('uvrStemBlobs')
        .findAll({ where: { sessionId } }),
    ).toHaveLength(0)
    expect(
      await adapter
        .getRepository<UvrStemFingerprint>('uvrStemFingerprints')
        .findAll({ where: { sessionId } }),
    ).toHaveLength(0)
    expect(
      await adapter
        .getRepository<UvrSessionLyrics>('uvrSessionLyrics')
        .findAll({ where: { sessionId } }),
    ).toHaveLength(0)

    await initGroupStore()
    await initSessionStore()
    expect(getUvrSession(sessionId)).toBeUndefined()
    expect(getGroupsReactive()).not.toContainEqual(
      expect.objectContaining({ id: group.id }),
    )
  })

  it('serializes concurrent assignments to the same group index', async () => {
    const {
      addSessionToGroup,
      createGroup,
      getGroupsReactive,
      startUvrSession,
    } = await loadStore()
    const group = await createGroup('Duets')
    const first = startUvrSession(
      'first.mp3',
      1_000,
      'audio/mpeg',
      'separate',
      'local',
    )
    const second = startUvrSession(
      'second.mp3',
      1_000,
      'audio/mpeg',
      'separate',
      'local',
    )

    await Promise.all([
      addSessionToGroup(first, group.id),
      addSessionToGroup(second, group.id),
    ])

    const cachedGroup = getGroupsReactive().find(
      (candidate) => candidate.id === group.id,
    )
    expect(cachedGroup?.sessionIds).toEqual([first, second])
    const persistedGroup = await adapter
      .getRepository<SessionGroupRecord>('sessionGroups')
      .findById(group.id)
    expect(persistedGroup?.sessionIds).toEqual([first, second])
  })

  it('does not delete a session referenced only by a stale group index', async () => {
    const {
      addSessionToGroup,
      createGroup,
      deleteGroupWithSessions,
      getGroupsReactive,
      getUvrSession,
      startUvrSession,
    } = await loadStore()
    const staleGroup = await createGroup('Old group')
    const canonicalGroup = await createGroup('Current group')
    const sessionId = startUvrSession(
      'moved.mp3',
      1_000,
      'audio/mpeg',
      'separate',
      'local',
    )
    await addSessionToGroup(sessionId, canonicalGroup.id)

    getGroupsReactive()
      .find((group) => group.id === staleGroup.id)
      ?.sessionIds.push(sessionId)

    await deleteGroupWithSessions(staleGroup.id)

    expect(getUvrSession(sessionId)?.groupId).toBe(canonicalGroup.id)
    expect(
      await adapter
        .getRepository<UvrSessionRecord>('uvrSessions')
        .findAll({ where: { appSessionId: sessionId } }),
    ).toHaveLength(1)
  })

  it('rejects a failed durable delete without hiding the group or songs', async () => {
    const {
      addSessionToGroup,
      createGroup,
      deleteGroupWithSessions,
      getGroupsReactive,
      getUvrSession,
      startUvrSession,
    } = await loadStore()
    const group = await createGroup('Keep on failure')
    const sessionId = startUvrSession(
      'safe.mp3',
      1_000,
      'audio/mpeg',
      'separate',
      'local',
    )
    await addSessionToGroup(sessionId, group.id)

    const sessionRepo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    vi.spyOn(sessionRepo, 'delete').mockRejectedValue(
      new Error('storage unavailable'),
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(deleteGroupWithSessions(group.id)).rejects.toThrow(
      'Could not delete',
    )
    expect(getUvrSession(sessionId)?.groupId).toBe(group.id)
    expect(getGroupsReactive()).toContainEqual(
      expect.objectContaining({ id: group.id }),
    )
  })
})
