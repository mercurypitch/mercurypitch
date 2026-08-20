// Which store a progress surface reads, and why.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { SessionRecord } from '@/db/entities'
import type { SessionResult } from '@/types'
import { loadProgressRuns, PROGRESS_RUN_LIMIT } from './progress-runs'

function cloudRow(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'r1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    userId: 'u1',
    melodyName: 'Warmup',
    startedAt: '2026-08-01T10:00:00.000Z',
    endedAt: '2026-08-01T10:05:00.000Z',
    score: 70,
    accuracy: 70,
    notesHit: 4,
    notesTotal: 4,
    streak: 1,
    results: [],
    ...over,
  } as SessionRecord
}

function localRow(over: Partial<SessionResult> = {}): SessionResult {
  return {
    sessionId: 's1',
    name: 'Warmup',
    sessionName: 'Warmup',
    completedAt: 1_700_000_000_000,
    itemsCompleted: 1,
    totalItems: 1,
    score: 60,
    practiceItemResult: [],
    ...over,
  } as SessionResult
}

describe('loadProgressRuns', () => {
  it('reads the account when somebody is signed in', async () => {
    // The fix for the reported bug: exercises and challenges live only in the
    // cloud, so a surface that never reads it can never count them.
    const loadRecords = vi.fn(async () => [
      cloudRow({ source: 'exercise' }),
      cloudRow({ source: 'challenge' }),
    ])

    const source = await loadProgressRuns({
      signedIn: () => true,
      loadRecords: loadRecords as never,
      localHistory: () => [localRow()],
    })

    expect(source.scope).toBe('account')
    expect(source.runs.map((run) => run.kind)).toEqual([
      'exercise',
      'challenge',
    ])
    // The device store is not consulted at all, so a stale local copy cannot
    // contradict the account.
    expect(loadRecords).toHaveBeenCalledWith(PROGRESS_RUN_LIMIT)
  })

  it('reads the device when nobody is signed in', async () => {
    const loadRecords = vi.fn(async () => [cloudRow()])

    const source = await loadProgressRuns({
      signedIn: () => false,
      loadRecords: loadRecords as never,
      localHistory: () => [localRow(), localRow()],
    })

    expect(source.scope).toBe('device')
    expect(source.runs).toHaveLength(2)
    // No doomed round trip for somebody with no account to read.
    expect(loadRecords).not.toHaveBeenCalled()
  })

  it('still says "account" when the account has no runs yet', async () => {
    // A true zero, not an unread store. The distinction is the whole reason
    // scope is reported.
    const source = await loadProgressRuns({
      signedIn: () => true,
      loadRecords: (async () => []) as never,
      localHistory: () => [localRow()],
    })

    expect(source).toEqual({ runs: [], scope: 'account' })
  })

  it('drops rows it cannot place in time rather than plotting them at zero', async () => {
    const source = await loadProgressRuns({
      signedIn: () => true,
      loadRecords: (async () => [
        cloudRow(),
        cloudRow({ endedAt: 'whenever' }),
      ]) as never,
    })

    expect(source.runs).toHaveLength(1)
  })

  it('drops unreadable local entries the same way', async () => {
    const source = await loadProgressRuns({
      signedIn: () => false,
      localHistory: () => [localRow(), localRow({ completedAt: Number.NaN })],
    })

    expect(source.runs).toHaveLength(1)
  })

  it('reads an empty device history when there is none at all', async () => {
    const source = await loadProgressRuns({ signedIn: () => false })
    expect(source).toEqual({ runs: [], scope: 'device' })
  })
})

describe('loadProgressRuns defaults', () => {
  it('asks the real auth service whether anybody is signed in', async () => {
    // The dependency injection exists for the tests above; this is the one
    // that proves the un-injected path — the one the app actually runs —
    // is wired to something real rather than to nothing.
    const auth = await import('@/db/services/auth-service')
    const hasValidToken = vi.spyOn(auth, 'hasValidToken').mockReturnValue(false)

    const source = await loadProgressRuns()

    expect(hasValidToken).toHaveBeenCalled()
    expect(source.scope).toBe('device')
    expect(source.runs).toEqual([])
    hasValidToken.mockRestore()
  })

  it('reads the real session service when signed in with no loader given', async () => {
    const sessions = await import('@/db/services/session-service')
    const loadSessionRecords = vi
      .spyOn(sessions, 'loadSessionRecords')
      .mockResolvedValue([cloudRow({ source: 'challenge' })])

    const source = await loadProgressRuns({ signedIn: () => true })

    expect(loadSessionRecords).toHaveBeenCalledWith(PROGRESS_RUN_LIMIT)
    expect(source).toEqual({
      runs: [
        {
          kind: 'challenge',
          score: 70,
          completedAt: Date.parse('2026-08-01T10:05:00.000Z'),
          hasNoteDetail: false,
        },
      ],
      scope: 'account',
    })
    loadSessionRecords.mockRestore()
  })
})

describe('NO_PROGRESS_RUNS', () => {
  it('is an empty device-scope source, for a surface still loading', async () => {
    const { NO_PROGRESS_RUNS } = await import('./progress-runs')
    expect(NO_PROGRESS_RUNS).toEqual({ runs: [], scope: 'device' })
  })
})
