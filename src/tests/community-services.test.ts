// ============================================================
// Community Services Tests — leaderboard, challenges, sharing
// ============================================================
//
// Exercises the user-facing flows behind the Leaderboard,
// Challenges and Community tabs against an in-memory database.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CloudRequestError } from '@/db/adapters/server-adapter'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

// Sharing to the Community board is account-only. Everything here that
// is not about that rule runs as a real account; the one test that is
// flips it. Partial mock — the rest of auth-service is left real.
const account = vi.hoisted(() => ({ upgraded: true }))
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasUpgradedAccount: () => account.upgraded,
}))

import type { ChallengeDefinition, SessionSource, UserProfile, } from '@/db/entities'
import { loadChallengeDefinitions, loadChallengeProgress, saveChallengeProgress, } from '@/db/services/challenges-service'
import { loadCurrentUserEntry, loadLeaderboard, } from '@/db/services/leaderboard-service'
import { canPostToCommunity, loadPublishedShareCounts, loadSharedMelodies, loadSharedSessions, saveSharedMelody, saveSharedSession, unpublishShared, } from '@/db/services/share-service'
import { getUserId, setAuthToken } from '@/db/services/user-service'

beforeEach(async () => {
  await adapter.destroy()
  account.upgraded = true
  setAuthToken(null)
})

afterEach(() => {
  vi.restoreAllMocks()
  setAuthToken(null)
})

const nowIso = (): string => new Date().toISOString()

/** Seed a sessionRecords row — the leaderboard is now derived from these. */
/**
 * Seed a ranked attempt. Defaults to 'challenge' because only fixed tasks
 * rank — free 'practice' is deliberately invisible to the leaderboard (see
 * the exclusion test below), so a practice fixture would silently produce an
 * empty board and make every assertion here meaningless.
 */
function seedSession(
  userId: string,
  score: number,
  accuracy: number,
  endedAt: string = nowIso(),
  source: SessionSource = 'challenge',
): Promise<unknown> {
  return adapter.getRepository('sessionRecords').create({
    userId,
    melodyName: 'm',
    startedAt: endedAt,
    endedAt,
    score,
    accuracy,
    notesHit: 0,
    notesTotal: 0,
    streak: 0,
    source,
    results: [],
  } as never)
}

// ── Leaderboard ─────────────────────────────────────────────────

describe('leaderboard flows', () => {
  it('derives an entry from a recorded session', async () => {
    await seedSession(getUserId(), 80, 90)

    const entry = await loadCurrentUserEntry()
    expect(entry).not.toBeNull()
    expect(entry?.userId).toBe(getUserId())
    expect(entry?.score).toBe(80)
    expect(entry?.totalSessions).toBe(1)
  })

  it('aggregates multiple sessions (avg score/accuracy, max best)', async () => {
    await seedSession(getUserId(), 80, 90)
    await seedSession(getUserId(), 90, 70)

    const entry = await loadCurrentUserEntry()
    expect(entry?.score).toBe(85) // avg(80, 90)
    expect(entry?.bestScore).toBe(90) // max
    expect(entry?.accuracy).toBe(80) // avg(90, 70)
    expect(entry?.totalSessions).toBe(2)
  })

  it('ranks users by their derived score', async () => {
    await seedSession('low', 10, 50)
    await seedSession('high', 99, 50)

    const users = await loadLeaderboard('overall', 'all-time')
    expect(users.map((u) => u.userId)).toEqual(['high', 'low'])
    expect(users.map((u) => u.rank)).toEqual([1, 2])
  })

  it('ranks by the category-specific metric', async () => {
    await seedSession('a', 99, 50)
    await seedSession('b', 10, 95)

    const users = await loadLeaderboard('accuracy', 'all-time')
    // 'b' wins on accuracy despite the lower score
    expect(users[0].userId).toBe('b')
    expect(users[0].rank).toBe(1)
  })

  // Ranking only means something when everyone attempted the same task.
  // Free practice is a self-chosen melody at a self-chosen difficulty, so a
  // perfect score on an easy tune must not outrank a hard challenge run.
  it('excludes free practice, ranking only fixed tasks', async () => {
    await seedSession('practicer', 100, 100, nowIso(), 'practice')
    await seedSession('challenger', 60, 60, nowIso(), 'challenge')

    const users = await loadLeaderboard('overall', 'all-time')
    expect(users.map((u) => u.userId)).toEqual(['challenger'])
  })

  it('counts only eligible attempts in a mixed history', async () => {
    await seedSession(getUserId(), 60, 60, nowIso(), 'challenge')
    await seedSession(getUserId(), 80, 80, nowIso(), 'weekly')
    await seedSession(getUserId(), 100, 100, nowIso(), 'practice')

    const entry = await loadCurrentUserEntry()
    expect(entry?.score).toBe(70) // avg(60, 80) — the practice run is ignored
    expect(entry?.totalSessions).toBe(2)
  })

  it('treats rows predating the source column as practice', async () => {
    // Older records carry no source; they were free practice by definition,
    // since challenges and exercises began tagging themselves at the same
    // time the column was added.
    await adapter.getRepository('sessionRecords').create({
      userId: getUserId(),
      melodyName: 'legacy',
      startedAt: nowIso(),
      endedAt: nowIso(),
      score: 100,
      accuracy: 100,
      notesHit: 0,
      notesTotal: 0,
      streak: 0,
      results: [],
    } as never)

    expect(await loadCurrentUserEntry()).toBeNull()
  })
})

// ── Challenges ──────────────────────────────────────────────────

describe('challenge flows', () => {
  it('loads only active definitions, ordered by sortOrder', async () => {
    const repo = adapter.getRepository<ChallengeDefinition>(
      'challengeDefinitions',
    )
    const def = {
      category: 'scales' as const,
      description: 'd',
      difficulty: 'beginner' as const,
      icon: 'x',
      targetScore: 80,
    }
    await repo.create({ ...def, title: 'Second', isActive: true, sortOrder: 2 })
    await repo.create({
      ...def,
      title: 'Hidden',
      isActive: false,
      sortOrder: 0,
    })
    await repo.create({ ...def, title: 'First', isActive: true, sortOrder: 1 })

    const defs = await loadChallengeDefinitions()
    expect(defs.map((d) => d.title)).toEqual(['First', 'Second'])
  })

  it('upserts challenge progress (create then update)', async () => {
    const progress = {
      userId: getUserId(),
      challengeId: 'ch-1',
      progress: 40,
      currentScore: 40,
      bestScore: 40,
      status: 'active' as const,
      completed: false,
      attempts: 1,
    }
    const created = await saveChallengeProgress(progress)
    expect(created).not.toBeNull()

    const updated = await saveChallengeProgress({
      ...progress,
      progress: 100,
      currentScore: 95,
      bestScore: 95,
      status: 'completed',
      completed: true,
      attempts: 2,
    })
    expect(updated?.id).toBe(created?.id) // same row, not a duplicate

    const all = await loadChallengeProgress()
    expect(all).toHaveLength(1)
    expect(all[0].completed).toBe(true)
    expect(all[0].attempts).toBe(2)
  })

  it('only returns the current user progress', async () => {
    await saveChallengeProgress({
      userId: 'someone-else',
      challengeId: 'ch-1',
      progress: 10,
      currentScore: 10,
      bestScore: 10,
      status: 'active',
      completed: false,
      attempts: 1,
    })
    const mine = await loadChallengeProgress()
    expect(mine).toHaveLength(0)
  })
})

// ── Sharing ─────────────────────────────────────────────────────

describe('share flows', () => {
  const melodyItems = [
    { midi: 60, startBeat: 0, duration: 1, freq: 261.63 },
    { midi: 64, startBeat: 1, duration: 1, freq: 329.63 },
  ]

  it('counts every public row owned by the requested singer, excluding foreign and private rows', async () => {
    const melodyRepo = adapter.getRepository('sharedMelodies')
    const sessionRepo = adapter.getRepository('sharedSessions')
    for (const repo of [melodyRepo, sessionRepo]) {
      await repo.create({ userId: 'owner', isPublic: true } as never)
      await repo.create({ userId: 'owner', isPublic: true } as never)
      await repo.create({ userId: 'owner', isPublic: false } as never)
      for (let i = 0; i < 101; i++)
        await repo.create({ userId: 'other', isPublic: true } as never)
    }
    expect(await loadPublishedShareCounts('owner')).toEqual({
      melodies: 2,
      sessions: 2,
    })
    expect(await loadPublishedShareCounts('other')).toEqual({
      melodies: 101,
      sessions: 101,
    })
    expect(await loadPublishedShareCounts('empty')).toEqual({
      melodies: 0,
      sessions: 0,
    })
  })

  it('propagates count failures so the UI can retain its last successful totals', async () => {
    const repo = adapter.getRepository('sharedSessions')
    const count = vi
      .spyOn(repo, 'count')
      .mockImplementation(async (options) => {
        // Matches the server adapter: reads otherwise fall back to zero.
        if (options?.throwOnError === true) throw new Error('offline')
        return 0
      })
    await expect(loadPublishedShareCounts('owner')).rejects.toThrow('offline')
    expect(count).toHaveBeenCalledWith({
      where: { userId: 'owner', isPublic: true },
      throwOnError: true,
    })
  })

  it('does not dispatch writes under an identity that changed while the DB initialized', async () => {
    const existing = await adapter
      .getRepository('sharedMelodies')
      .create({ userId: getUserId(), isPublic: true } as never)
    const melody = saveSharedMelody({
      name: 'Do not publish',
      items: melodyItems,
      author: 'Me',
    })
    const session = saveSharedSession({
      name: 'Do not publish',
      items: [],
      author: 'Me',
      results: [80],
    })
    const deletion = unpublishShared('melody', existing.id)
    setAuthToken(
      `header.${btoa(JSON.stringify({ sub: 'new-owner' }))}.signature`,
    )
    expect(await melody).toBeNull()
    expect(await session).toBeNull()
    expect(await deletion).toBe(false)
    expect(
      await adapter.getRepository('sharedMelodies').findById(existing.id),
    ).not.toBeNull()
    expect(await adapter.getRepository('sharedMelodies').count()).toBe(1)
    expect(await adapter.getRepository('sharedSessions').count()).toBe(0)
  })

  /** The repository's delete, refused the way ServerAdapter refuses one. */
  const refuseDelete = (status: number) =>
    vi.spyOn(adapter, 'getRepository').mockReturnValue({
      delete: () =>
        Promise.reject(
          new CloudRequestError(
            status,
            `ServerAdapter: ${status} on /api/sharedMelodies/m1`,
          ),
        ),
    } as never)

  it('counts a share another device already took down as unpublished', async () => {
    // Published from this browser, then unpublished from a phone: the board
    // row is gone, and the worker answers a delete of it with 404. Before,
    // that read as a failure, so the card could never leave this shelf.
    refuseDelete(404)
    expect(await unpublishShared('melody', 'm1')).toBe(true)
  })

  it('still reports a delete the worker refused, or never answered', async () => {
    refuseDelete(403)
    expect(await unpublishShared('melody', 'm1')).toBe(false)
    refuseDelete(500)
    expect(await unpublishShared('session', 'm1')).toBe(false)
    vi.spyOn(adapter, 'getRepository').mockReturnValue({
      delete: () => Promise.reject(new TypeError('Failed to fetch')),
    } as never)
    expect(await unpublishShared('melody', 'm1')).toBe(false)
  })

  /** The repository's create, refused the way ServerAdapter refuses one. */
  const refuseCreate = (status: number, body: string) =>
    vi.spyOn(adapter, 'getRepository').mockReturnValue({
      create: () =>
        Promise.reject(
          new CloudRequestError(
            status,
            `ServerAdapter: ${status} on /api/x — ${body}`,
            body,
          ),
        ),
    } as never)

  it('passes on a title the word filter refused, so the share can say so', async () => {
    // A null reads as "try again", and trying again cannot help here.
    refuseCreate(400, '{"error":"melodyName uses a word that is not allowed"}')
    await expect(
      saveSharedMelody({ name: 'Bad', items: [], author: 'A' }),
    ).rejects.toBeInstanceOf(CloudRequestError)
    refuseCreate(400, '{"error":"sessionName uses a word that is not allowed"}')
    await expect(
      saveSharedSession({
        name: 'Bad',
        items: [],
        author: 'A',
        results: [80],
      }),
    ).rejects.toBeInstanceOf(CloudRequestError)
  })

  it('still answers null for a publish that failed any other way', async () => {
    refuseCreate(500, '{"error":"Internal error"}')
    expect(
      await saveSharedMelody({ name: 'Tune', items: [], author: 'A' }),
    ).toBeNull()
    refuseCreate(400, '{"error":"Invalid column: x"}')
    expect(
      await saveSharedSession({
        name: 'Run',
        items: [],
        author: 'A',
        results: [80],
      }),
    ).toBeNull()
  })

  it('round-trips a shared melody', async () => {
    const saved = await saveSharedMelody({
      name: 'My Tune',
      items: melodyItems,
      author: 'Tester',
      tags: ['practice'],
    })
    expect(saved).not.toBeNull()

    const loaded = await loadSharedMelodies()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('My Tune')
    expect(loaded[0].items).toHaveLength(2)
    expect(loaded[0].tags).toEqual(['practice'])
    expect(await loadPublishedShareCounts(getUserId())).toEqual({
      melodies: 1,
      sessions: 0,
    })
    expect(await unpublishShared('melody', saved!.id)).toBe(true)
    expect(await loadPublishedShareCounts(getUserId())).toEqual({
      melodies: 0,
      sessions: 0,
    })
  })

  it('round-trips the actual nested melody shape including rests and playback expression', async () => {
    const items = [
      {
        id: 7,
        note: { midi: 64, name: 'E', octave: 4, freq: 329.63 },
        startBeat: 0,
        duration: 2,
        velocity: 84,
        effectType: 'vibrato',
        slideInterval: -2,
        vibratoAmplitude: 0.5,
        tremoloRate: 8,
        tremoloDepth: 0.4,
        trillInterval: 2,
        trillRate: 10,
        staccatoRatio: 0.4,
        chordType: 'minor',
        lyricText: 'Hello',
      },
      {
        id: 8,
        note: { midi: 60, name: 'C', octave: 4, freq: 0 },
        startBeat: 2,
        duration: 1,
        isRest: true,
      },
    ]
    const saved = await saveSharedMelody({
      name: 'Expressive tune',
      items,
      author: 'Me',
    })
    expect(saved?.items).toEqual(items)
    const loaded = await loadSharedMelodies()
    expect(loaded.map((row) => row.name)).toEqual(['Expressive tune'])
    expect(loaded[0].items).toEqual(items)
  })

  it('normalizes old flat notes and does not hide valid shares behind one malformed row', async () => {
    const repo = adapter.getRepository('sharedMelodies')
    await repo.create({
      userId: getUserId(),
      melodyName: 'Legacy',
      itemsJson: JSON.stringify(melodyItems),
      isPublic: true,
    } as never)
    await repo.create({
      userId: 'other',
      melodyName: 'Malformed',
      itemsJson: '{bad json',
      isPublic: true,
    } as never)
    await repo.create({
      userId: 'other',
      melodyName: 'Invalid',
      itemsJson: JSON.stringify([{ note: null }]),
      isPublic: true,
    } as never)
    const loaded = await loadSharedMelodies()
    expect(loaded.map((row) => row.name)).toEqual(['Legacy'])
    expect(loaded[0].items).toEqual([
      {
        id: 1,
        note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
        startBeat: 0,
        duration: 1,
      },
      {
        id: 2,
        note: { midi: 64, name: 'E', octave: 4, freq: 329.63 },
        startBeat: 1,
        duration: 1,
      },
    ])
  })

  it('does not publish malformed melody items that cannot be read back', async () => {
    expect(
      await saveSharedMelody({
        name: 'Invalid',
        items: [{ note: null }],
        author: 'Me',
      }),
    ).toBeNull()
    expect(await adapter.getRepository('sharedMelodies').count()).toBe(0)
  })

  it('round-trips a shared session with computed score', async () => {
    const saved = await saveSharedSession({
      name: 'My Session',
      items: [],
      author: 'Tester',
      results: [80, 90, 100],
    })
    expect(saved).not.toBeNull()

    const loaded = await loadSharedSessions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].results).toEqual([80, 90, 100])
    expect(await loadPublishedShareCounts(getUserId())).toEqual({
      melodies: 0,
      sessions: 1,
    })
    expect(await unpublishShared('session', saved!.id)).toBe(true)
    expect(await loadPublishedShareCounts(getUserId())).toEqual({
      melodies: 0,
      sessions: 0,
    })
  })

  it('keeps a post off the public board without an account', async () => {
    // A listing everyone can see needs a name that outlives one browser's
    // localStorage. The singer keeps their own shelf and their share link;
    // what they do not get is a row on the board.
    account.upgraded = false
    expect(canPostToCommunity()).toBe(false)

    const saved = await saveSharedMelody({
      name: 'Anon Tune',
      items: melodyItems,
      author: 'Singer-1a2b',
    })
    const savedSession = await saveSharedSession({
      name: 'Anon Session',
      items: [],
      author: 'Singer-1a2b',
      results: [80],
    })

    expect(saved).toBeNull()
    expect(savedSession).toBeNull()
    expect(await loadSharedMelodies()).toHaveLength(0)
    expect(await loadSharedSessions()).toHaveLength(0)
  })

  it('attributes shares to the persisted user id', async () => {
    await saveSharedMelody({
      name: 'Mine',
      items: melodyItems,
      author: 'Tester',
    })
    const repo = adapter.getRepository('sharedMelodies')
    const rows = await repo.findAll()
    expect((rows[0] as unknown as { userId: string }).userId).toBe(getUserId())
  })

  it('tells the board whose share each card is, so it can tell yours from theirs', async () => {
    await saveSharedMelody({ name: 'Mine', items: melodyItems, author: 'Me' })
    await saveSharedSession({
      name: 'My setlist',
      items: [],
      author: 'Me',
      results: [80],
    })
    await adapter.getRepository('sharedMelodies').create({
      userId: 'someone-else',
      melodyId: '',
      melodyName: 'Theirs',
      author: 'Them',
      itemsJson: JSON.stringify(melodyItems),
      tags: [],
      isPublic: true,
    } as never)

    const melodies = await loadSharedMelodies()
    const sessions = await loadSharedSessions()

    expect(Object.fromEntries(melodies.map((m) => [m.name, m.userId]))).toEqual(
      { Mine: getUserId(), Theirs: 'someone-else' },
    )
    expect(sessions.map((s) => s.userId)).toEqual([getUserId()])
  })
})

// ── Streak (profile-backed) ─────────────────────────────────────

describe('streak flow', () => {
  it('continues the streak when last practice was yesterday', async () => {
    const { updatePracticeStreak } =
      await import('@/db/services/streak-service')
    const repo = adapter.getRepository<UserProfile>('userProfiles')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    await repo.create({
      displayName: 'Me',
      joinDate: new Date().toISOString(),
      lastPracticeDate: yesterday.toISOString().slice(0, 10),
      currentStreak: 3,
    })

    const streak = await updatePracticeStreak()
    expect(streak).toBe(4)
  })
})

// ── Weekly leaderboard window ───────────────────────────────────

describe('weekly leaderboard', () => {
  it('excludes sessions from before this ISO week; all-time keeps them', async () => {
    const tenDaysAgo = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000,
    ).toISOString()
    await seedSession(getUserId(), 70, 70, tenDaysAgo)

    expect(await loadLeaderboard('overall', 'weekly')).toHaveLength(0)
    expect(await loadLeaderboard('overall', 'all-time')).toHaveLength(1)
  })

  it('includes a session recorded this week', async () => {
    await seedSession(getUserId(), 80, 80)

    const weekly = await loadLeaderboard('overall', 'weekly')
    expect(weekly).toHaveLength(1)
    expect(weekly[0].score).toBe(80)
  })
})

// ── Follows ─────────────────────────────────────────────────────

describe('follow flows', () => {
  /** Write a follow row the way the worker would have. */
  function seedFollow(
    followedUserId: string,
    status?: 'pending' | 'accepted',
  ): Promise<unknown> {
    return adapter
      .getRepository('follows')
      .create({ userId: getUserId(), followedUserId, status })
  }

  it('counts only the singers who agreed', async () => {
    const { getFollowing, loadFollowState } =
      await import('@/db/services/follow-service')
    await seedFollow('friend-1', 'accepted')
    await seedFollow('asked-1', 'pending')

    // A pending row is an ask, not a friendship. Reading it as one is what
    // let an unanswered request open the other singer's board.
    expect(await getFollowing()).toEqual(['friend-1'])
    expect(await loadFollowState()).toEqual({
      accepted: ['friend-1'],
      pending: ['asked-1'],
    })
  })

  it('treats a row from before the status column as never agreed', async () => {
    const { loadFollowState } = await import('@/db/services/follow-service')
    await seedFollow('legacy-1')

    expect(await loadFollowState()).toEqual({
      accepted: [],
      pending: ['legacy-1'],
    })
  })

  it('refuses to friend yourself before it reaches the network', async () => {
    const { requestFriend } = await import('@/db/services/follow-service')
    await expect(requestFriend(getUserId())).resolves.toMatchObject({
      ok: false,
    })
    await expect(requestFriend('')).resolves.toMatchObject({ ok: false })
  })
})
