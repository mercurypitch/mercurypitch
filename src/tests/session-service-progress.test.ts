import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  addScoredMs: vi.fn(async () => 3),
  getCurrentStreak: vi.fn(async () => 3),
  trackEvent: vi.fn(),
  currentUser: { id: 'singer-1' },
}))

vi.mock('@/db', () => ({ getDb: mocks.getDb }))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => mocks.currentUser.id,
}))
vi.mock('@/db/services/practice-minutes', () => ({
  addScoredMs: mocks.addScoredMs,
  NOMINAL_RUN_MS: 60_000,
}))
vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: mocks.getCurrentStreak,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }))

import { loadProgressSessionRecords, saveSessionRecord, } from '@/db/services/session-service'

describe('Progress session persistence', () => {
  let create: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>
  let count: ReturnType<typeof vi.fn>
  let findAll: ReturnType<typeof vi.fn>

  beforeEach(() => {
    create = vi.fn(async (record) => ({
      ...record,
      id: 'record-1',
      createdAt: '2026-08-11T20:00:00.000Z',
      updatedAt: '2026-08-11T20:00:00.000Z',
    }))
    update = vi.fn(async (_id, patch) => ({
      ...(await create.mock.results[0]?.value),
      ...patch,
    }))
    count = vi.fn(async () => 0)
    findAll = vi.fn(async () => [])
    mocks.getDb.mockResolvedValue({
      getRepository: () => ({ create, update, count, findAll }),
    })
    mocks.addScoredMs.mockClear()
    mocks.getCurrentStreak.mockClear()
    mocks.getCurrentStreak.mockResolvedValue(3)
    mocks.trackEvent.mockClear()
    mocks.currentUser.id = 'singer-1'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T20:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('stores measured duration and derives an honest start timestamp', async () => {
    await saveSessionRecord({
      melodyName: 'Exercise: Long note',
      score: 86,
      accuracy: 86,
      notesHit: 1,
      notesTotal: 1,
      durationMs: 12_500,
      source: 'exercise',
      sourceRef: 'long-note',
      sourceVersion: 2,
      comparabilityKey: 'voice:exercise:long-note:v2',
    })

    expect(mocks.addScoredMs).toHaveBeenCalledWith(12_500, 'singer-1')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        instrument: 'voice',
        durationMs: 12_500,
        startedAt: '2026-08-11T19:59:47.500Z',
        endedAt: '2026-08-11T20:00:00.000Z',
        sourceRef: 'long-note',
        sourceVersion: 2,
        comparabilityKey: 'voice:exercise:long-note:v2',
      }),
    )
  })

  it('keeps nominal streak credit out of persisted duration', async () => {
    await saveSessionRecord({
      melodyName: 'Free practice',
      score: 72,
      accuracy: 72,
      notesHit: 2,
      notesTotal: 4,
    })

    expect(mocks.addScoredMs).toHaveBeenCalledWith(60_000, 'singer-1')
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ durationMs: expect.anything() }),
    )
  })

  it('rejects an implausible measured duration before local or cloud persistence', async () => {
    await saveSessionRecord({
      melodyName: 'Corrupt local duration',
      score: 72,
      accuracy: 72,
      notesHit: 2,
      notesTotal: 4,
      durationMs: 86_400_001,
    })

    expect(mocks.addScoredMs).toHaveBeenCalledWith(60_000, 'singer-1')
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ durationMs: expect.anything() }),
    )
  })

  it('does not credit minutes when the session row fails to persist', async () => {
    create.mockRejectedValueOnce(new Error('offline'))

    await expect(
      saveSessionRecord({
        melodyName: 'Unwritten run',
        score: 72,
        accuracy: 72,
        notesHit: 2,
        notesTotal: 4,
      }),
    ).resolves.toBeNull()

    expect(mocks.addScoredMs).not.toHaveBeenCalled()
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })

  it('pages records and reports when the safety ceiling truncates history', async () => {
    count.mockResolvedValue(1_201)
    findAll
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, index) => ({
          id: `record-${index}`,
          endedAt: '2026-08-11T20:00:00.000Z',
        })),
      )
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, index) => ({
          id: `record-${500 + index}`,
          endedAt: '2026-08-11T20:00:00.000Z',
        })),
      )

    const result = await loadProgressSessionRecords({
      pageSize: 500,
      maxRecords: 1_000,
    })

    expect(result.records).toHaveLength(1_000)
    expect(result.available).toBe(true)
    expect(result.totalAvailable).toBe(1_201)
    expect(result.complete).toBe(false)
    expect(findAll).toHaveBeenCalledTimes(2)
    expect(findAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 500, limit: 500 }),
    )
  })

  it('reports a confirmed empty history as complete', async () => {
    const result = await loadProgressSessionRecords()

    expect(result).toEqual({
      records: [],
      available: true,
      complete: true,
      totalAvailable: 0,
    })
  })

  it('marks the history unavailable when an audited page read fails', async () => {
    count.mockResolvedValue(1)
    findAll.mockRejectedValueOnce(new Error('offline'))

    await expect(loadProgressSessionRecords()).resolves.toEqual({
      records: [],
      available: false,
      complete: false,
      totalAvailable: null,
    })
    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({ throwOnError: true }),
    )
  })

  it('does not attribute an in-flight save to a newly selected account', async () => {
    let releaseDb = (): void => undefined
    mocks.getDb.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseDb = () =>
            resolve({
              getRepository: () => ({ create, update, count, findAll }),
            })
        }),
    )

    const saving = saveSessionRecord({
      melodyName: 'Account A run',
      score: 80,
      accuracy: 80,
      notesHit: 1,
      notesTotal: 1,
    })
    mocks.currentUser.id = 'singer-2'
    releaseDb()

    await expect(saving).resolves.toBeNull()
    expect(mocks.addScoredMs).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
