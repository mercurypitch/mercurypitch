// Shared session service tests exercise public lookup and source-run persistence against repository storage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedSession } from '@/db/entities'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const adapter = new InMemoryAdapter()
vi.mock('@/db', () => ({ getDb: async () => adapter }))
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasUpgradedAccount: () => true,
}))
import { loadPublicSharedSession, loadSharedSessions, saveSharedSession, } from './share-service'
import { getUserId, setAuthToken } from './user-service'

beforeEach(async () => {
  await adapter.destroy()
  setAuthToken(null)
})
afterEach(() => vi.restoreAllMocks())

const seed = (patch: Partial<SharedSession> = {}) =>
  adapter.getRepository<SharedSession>('sharedSessions').create({
    userId: getUserId(),
    sessionId: '',
    sessionName: 'Warm-up',
    author: 'Singer',
    score: 84,
    accuracy: 0,
    resultsJson: '[84]',
    isPublic: true,
    ...patch,
  })

describe('public practice-result lookup', () => {
  it('saves the stable source ID and resolves a result for an unauthenticated reader', async () => {
    const saved = await saveSharedSession({
      name: 'Warm-up',
      author: 'Singer',
      items: [],
      results: [84],
      sourceSessionId: 'source-run-42',
    })
    expect(saved).toMatchObject({
      sourceSessionId: 'source-run-42',
      results: [84],
    })
    const row = await adapter
      .getRepository<SharedSession>('sharedSessions')
      .findById(saved!.id)
    expect(row?.sessionId).toBe('source-run-42')
    expect(await loadPublicSharedSession(saved!.id)).toEqual(saved)
    expect(await loadSharedSessions()).toEqual([saved])
    expect(await adapter.getRepository('sessionRecords').count()).toBe(0)
  })

  it('reads legacy scores without inventing a source identity', async () => {
    const row = await seed()
    expect(await loadPublicSharedSession(row.id)).toMatchObject({
      sourceSessionId: undefined,
      results: [84],
    })
  })

  it('returns unavailable for private rows, including the current owner, and missing rows', async () => {
    const mine = await seed({ isPublic: false })
    const theirs = await seed({ userId: 'another-singer', isPublic: false })
    expect(await loadPublicSharedSession(mine.id)).toBeNull()
    expect(await loadPublicSharedSession(theirs.id)).toBeNull()
    expect(await loadPublicSharedSession('missing')).toBeNull()
  })

  it('enforces public visibility defensively and lets transport failure reach the retry UI', async () => {
    const privateRow = await seed({ isPublic: false })
    const findAll = vi.spyOn(
      adapter.getRepository<SharedSession>('sharedSessions'),
      'findAll',
    )
    findAll.mockResolvedValueOnce([privateRow])
    expect(await loadPublicSharedSession(privateRow.id)).toBeNull()
    expect(findAll).toHaveBeenCalledWith({
      where: { id: privateRow.id, isPublic: true },
      limit: 1,
      throwOnError: true,
    })
    findAll.mockResolvedValueOnce([
      { ...privateRow, isPublic: true, id: 'different-public-row' },
    ])
    expect(await loadPublicSharedSession(privateRow.id)).toBeNull()
    findAll.mockRejectedValueOnce(new Error('offline'))
    await expect(loadPublicSharedSession('public-id')).rejects.toThrow(
      'offline',
    )
  })

  it.each(['not-json', '[]', '[null]', '[101]', '[1e999]', ' '.repeat(8193)])(
    'isolates malformed stored scores %j',
    async (resultsJson) => {
      const good = await seed()
      const bad = await seed({ resultsJson })
      expect(await loadPublicSharedSession(bad.id)).toBeNull()
      expect((await loadSharedSessions()).map((row) => row.id)).toEqual([
        good.id,
      ])
    },
  )

  it('rejects invalid results and oversized identifiers before writing or querying', async () => {
    const repo = adapter.getRepository<SharedSession>('sharedSessions')
    const findAll = vi.spyOn(repo, 'findAll')
    expect(await loadPublicSharedSession('')).toBeNull()
    expect(await loadPublicSharedSession('a'.repeat(129))).toBeNull()
    expect(findAll).not.toHaveBeenCalled()
    expect(
      await saveSharedSession({
        name: 'Run',
        author: 'Singer',
        items: [],
        results: [Infinity],
      }),
    ).toBeNull()
    expect(
      await saveSharedSession({
        name: 'Run',
        author: 'Singer',
        items: [],
        results: [84],
        sourceSessionId: '',
      }),
    ).toBeNull()
    expect(await repo.count()).toBe(0)
  })
})
