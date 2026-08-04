// ============================================================
// Grant endpoints — ownership, validation, and the batch contract
// ============================================================
//
// The bulk endpoint is the one place a client hands the server a list of rows
// to write, so the interesting questions are all about what it refuses:
// another singer's rows, an unknown achievement, a payload big enough to be
// an attack, a progress value that is not a percentage.
//
// The fake D1 below understands only the statements these two handlers issue.
// That is deliberate — an unrecognised statement throws rather than silently
// returning empty, so a handler that starts asking a different question fails
// here instead of passing for the wrong reason.

import { describe, expect, it } from 'vitest'
import type { AuthUser, Env } from './auth'
import { rateLimitSubject } from './auth'
import { handleAchievementBulk, handleBadgeBulk, handleGrantContext, } from './grants'

type Row = Record<string, unknown>

const respond = (body: object | null, init?: ResponseInit): Response =>
  new Response(body === null ? null : JSON.stringify(body), init)

class FakeStatement {
  private values: unknown[] = []

  constructor(
    private readonly db: FakeD1,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): FakeStatement {
    this.values = values
    return this
  }

  /** A statement run on its own rather than inside a batch. */
  async all<T>(): Promise<{ results: T[] }> {
    this.db.singles += 1
    return this.run() as { results: T[] }
  }

  /** Run this statement, returning what D1's batch() would for it. */
  run(): { results: Row[] } {
    const sql = this.sql.replace(/\s+/g, ' ').trim()
    const [a, b, c, d, e, f, g, h] = this.values

    if (sql === 'SELECT id FROM achievements') {
      return { results: [...this.db.achievements].map((id) => ({ id })) }
    }
    if (sql === 'SELECT id FROM badgeDefinitions') {
      return { results: [...this.db.badgeDefinitions].map((id) => ({ id })) }
    }
    // The upsert, with the conflict clause modelled rather than assumed —
    // MAX on `unlocked` and COALESCE on `unlockedAt` are the two properties
    // the whole endpoint hangs on, so a fake that quietly overwrote them
    // would make these tests prove nothing.
    if (sql.startsWith('INSERT INTO userAchievements')) {
      const [userId, achievementId] = [d as string, e as string]
      const found = this.db.userAchievements.find(
        (r) => r.userId === userId && r.achievementId === achievementId,
      )
      if (found) {
        found.progress = f as number
        found.unlocked = Math.max(found.unlocked, g as number)
        found.unlockedAt = found.unlockedAt ?? (h as string | null)
        this.db.writes.push(`update:${achievementId}`)
      } else {
        this.db.userAchievements.push({
          id: a as string,
          userId,
          achievementId,
          progress: f as number,
          unlocked: g as number,
          unlockedAt: h as string | null,
        })
        this.db.writes.push(`insert:${achievementId}`)
      }
      return { results: [] }
    }
    if (sql.startsWith('INSERT INTO userBadges')) {
      const [userId, badgeId] = [d as string, e as string]
      const already = this.db.userBadges.some(
        (r) => r.userId === userId && r.badgeId === badgeId,
      )
      if (already) {
        this.db.writes.push(`noop:${badgeId}`)
      } else {
        this.db.userBadges.push({
          id: a as string,
          userId,
          badgeId,
          earnedAt: f as string,
        })
        this.db.writes.push(`insert:${badgeId}`)
      }
      return { results: [] }
    }

    // ── grant-context reads ──────────────────────────────────────
    const table = /FROM ([A-Za-z]+)/.exec(sql)?.[1]
    if (table !== undefined && sql.startsWith('SELECT COUNT(*)')) {
      return { results: [{ n: (this.db.tables[table] ?? []).length }] }
    }
    if (table !== undefined && sql.startsWith('SELECT')) {
      const rows = this.db.tables[table] ?? []
      const scoped = sql.includes('WHERE')
        ? rows.filter((r) => r.userId === a || r.id === a)
        : rows
      return { results: scoped }
    }

    throw new Error(`FakeD1: unhandled statement — ${sql}`)
  }
}

class FakeD1 {
  achievements = new Set<string>()
  badgeDefinitions = new Set<string>()
  userAchievements: Array<{
    id: string
    userId: string
    achievementId: string
    progress: number
    unlocked: number
    unlockedAt: string | null
  }> = []
  userBadges: Array<{
    id: string
    userId: string
    badgeId: string
    earnedAt: string
  }> = []
  tables: Record<string, Row[]> = {}
  writes: string[] = []
  batches = 0
  /** Statements run on their own, outside a batch. */
  singles = 0

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql)
  }

  async batch<T>(stmts: FakeStatement[]): Promise<T[]> {
    this.batches += 1
    return stmts.map((s) => s.run()) as T[]
  }
}

function envOf(db: FakeD1): Env {
  return { DB: db } as unknown as Env
}

const alice: AuthUser = { userId: 'alice', provider: 'password' } as AuthUser
const bob: AuthUser = { userId: 'bob', provider: 'password' } as AuthUser

function bulkRequest(rows: unknown): Request {
  return new Request('https://api.test/api/userAchievements/bulk', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}

describe('POST /api/userAchievements/bulk', () => {
  it('inserts new rows and updates existing ones in one batch', async () => {
    const db = new FakeD1()
    db.achievements.add('ach-1').add('ach-2')
    db.userAchievements.push({
      id: 'row-1',
      userId: 'alice',
      achievementId: 'ach-1',
      progress: 10,
      unlocked: 0,
      unlockedAt: null,
    })

    const res = await handleAchievementBulk(
      bulkRequest([
        { achievementId: 'ach-1', progress: 55, unlocked: false },
        { achievementId: 'ach-2', progress: 100, unlocked: true },
      ]),
      alice,
      envOf(db),
      respond,
    )

    expect(await res.json()).toEqual({ written: 2, skipped: 0 })
    expect(db.writes).toEqual(['update:ach-1', 'insert:ach-2'])
    // One read of the definition list, one batch for every write. Not one
    // request per row, which is the whole reason this endpoint exists — and
    // no read of the singer's own rows at all, which is what removed the
    // read-then-write gap two tabs used to race in.
    expect(db.singles).toBe(1)
    expect(db.batches).toBe(1)
    expect(db.userAchievements[0]?.progress).toBe(55)
  })

  it('never takes an unlock back, however wrong the caller is', async () => {
    // The failure this defends against: a grant pass fires while the API is
    // briefly unreachable, every service under it answers `[]`, and the pass
    // concludes the singer has achieved nothing. A minute later the flush
    // lands on a healthy API carrying "0%, locked" for a goal they earned
    // weeks ago. The row must not move.
    const db = new FakeD1()
    db.achievements.add('ach-1')
    db.userAchievements.push({
      id: 'row-1',
      userId: 'alice',
      achievementId: 'ach-1',
      progress: 100,
      unlocked: 1,
      unlockedAt: '2026-01-01T00:00:00.000Z',
    })

    await handleAchievementBulk(
      bulkRequest([{ achievementId: 'ach-1', progress: 0, unlocked: false }]),
      alice,
      envOf(db),
      respond,
    )

    expect(db.userAchievements[0]).toMatchObject({
      unlocked: 1,
      unlockedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('keeps the first unlock date when a later write claims another', async () => {
    const db = new FakeD1()
    db.achievements.add('ach-1')
    db.userAchievements.push({
      id: 'row-1',
      userId: 'alice',
      achievementId: 'ach-1',
      progress: 100,
      unlocked: 1,
      unlockedAt: '2026-01-01T00:00:00.000Z',
    })

    await handleAchievementBulk(
      bulkRequest([
        {
          achievementId: 'ach-1',
          progress: 100,
          unlocked: true,
          unlockedAt: '2026-08-04T00:00:00.000Z',
        },
      ]),
      alice,
      envOf(db),
      respond,
    )

    // They earned it in January. A pass in August re-deciding that it is
    // unlocked does not mean they earned it in August.
    expect(db.userAchievements[0]?.unlockedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('lets progress fall, because progress is not an unlock', async () => {
    const db = new FakeD1()
    db.achievements.add('ach-1')
    db.userAchievements.push({
      id: 'row-1',
      userId: 'alice',
      achievementId: 'ach-1',
      progress: 80,
      unlocked: 0,
      unlockedAt: null,
    })

    // A streak goal whose streak broke. Freezing the bar at its historical
    // best would be a nicer story and a less honest one.
    await handleAchievementBulk(
      bulkRequest([{ achievementId: 'ach-1', progress: 10, unlocked: false }]),
      alice,
      envOf(db),
      respond,
    )

    expect(db.userAchievements[0]?.progress).toBe(10)
  })

  it('two flushes racing produce one row, not two', async () => {
    const db = new FakeD1()
    db.achievements.add('ach-1')

    // Both tabs evaluated against the same empty starting point, which is
    // exactly the case that used to insert twice.
    await Promise.all([
      handleAchievementBulk(
        bulkRequest([{ achievementId: 'ach-1', progress: 40, unlocked: false }]),
        alice,
        envOf(db),
        respond,
      ),
      handleAchievementBulk(
        bulkRequest([{ achievementId: 'ach-1', progress: 60, unlocked: false }]),
        alice,
        envOf(db),
        respond,
      ),
    ])

    expect(db.userAchievements).toHaveLength(1)
  })

  it('cannot touch another singer’s row, even by naming their achievement', async () => {
    const db = new FakeD1()
    db.achievements.add('ach-1')
    db.userAchievements.push({
      id: 'row-1',
      userId: 'alice',
      achievementId: 'ach-1',
      progress: 10,
      unlocked: 0,
      unlockedAt: null,
    })

    // Bob claims the same achievement. There is no row id in the payload to
    // forge, so the only thing this can do is create BOB a row of his own.
    await handleAchievementBulk(
      bulkRequest([{ achievementId: 'ach-1', progress: 100, unlocked: true }]),
      bob,
      envOf(db),
      respond,
    )

    expect(db.userAchievements[0]).toMatchObject({
      userId: 'alice',
      progress: 10,
      unlocked: 0,
    })
    expect(db.userAchievements[1]).toMatchObject({
      userId: 'bob',
      achievementId: 'ach-1',
      unlocked: 1,
    })
  })

  it('drops ids that match no achievement rather than storing junk', async () => {
    const db = new FakeD1()
    db.achievements.add('ach-1')

    const res = await handleAchievementBulk(
      bulkRequest([
        { achievementId: 'ach-1', progress: 20, unlocked: false },
        { achievementId: 'not-a-real-achievement', progress: 99, unlocked: true },
      ]),
      alice,
      envOf(db),
      respond,
    )

    expect(await res.json()).toEqual({ written: 1, skipped: 1 })
    expect(db.userAchievements).toHaveLength(1)
  })

  it('clamps progress to a percentage', async () => {
    const db = new FakeD1()
    db.achievements.add('ach-1').add('ach-2')

    await handleAchievementBulk(
      bulkRequest([
        { achievementId: 'ach-1', progress: 4000, unlocked: false },
        { achievementId: 'ach-2', progress: -12, unlocked: false },
      ]),
      alice,
      envOf(db),
      respond,
    )

    expect(db.userAchievements.map((r) => r.progress)).toEqual([100, 0])
  })

  it('rejects a malformed row without writing any of them', async () => {
    const db = new FakeD1()
    db.achievements.add('ach-1')

    const res = await handleAchievementBulk(
      bulkRequest([
        { achievementId: 'ach-1', progress: 20, unlocked: false },
        { achievementId: 'ach-1', progress: 'lots', unlocked: false },
      ]),
      alice,
      envOf(db),
      respond,
    )

    expect(res.status).toBe(400)
    // All-or-none: the valid row in front of the bad one is not applied.
    expect(db.userAchievements).toHaveLength(0)
  })

  it('refuses a payload larger than the whole catalogue could produce', async () => {
    const db = new FakeD1()
    const rows = Array.from({ length: 201 }, (_, i) => ({
      achievementId: `ach-${i}`,
      progress: 1,
      unlocked: false,
    }))

    const res = await handleAchievementBulk(
      bulkRequest(rows),
      alice,
      envOf(db),
      respond,
    )

    expect(res.status).toBe(413)
    expect(db.batches).toBe(0)
  })

  it('rejects a body that is not { rows: [] }', async () => {
    const db = new FakeD1()
    const res = await handleAchievementBulk(
      new Request('https://api.test/api/userAchievements/bulk', {
        method: 'POST',
        body: JSON.stringify({ achievementId: 'ach-1' }),
      }),
      alice,
      envOf(db),
      respond,
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/userBadges/bulk', () => {
  const badgeRequest = (rows: unknown): Request =>
    new Request('https://api.test/api/userBadges/bulk', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    })

  it('writes every earned badge in one batch', async () => {
    const db = new FakeD1()
    db.badgeDefinitions.add('badge-1').add('badge-2')

    const res = await handleBadgeBulk(
      badgeRequest([
        { badgeId: 'badge-1', earnedAt: '2026-08-04T09:00:00.000Z' },
        { badgeId: 'badge-2', earnedAt: '2026-08-04T09:00:00.000Z' },
      ]),
      alice,
      envOf(db),
      respond,
    )

    expect(await res.json()).toEqual({ written: 2, skipped: 0 })
    expect(db.batches).toBe(1)
    expect(db.userBadges).toHaveLength(2)
  })

  it('is idempotent, so a retry cannot award a badge twice', async () => {
    // This is what makes the retry in grant-flush safe. The old code POSTed
    // badges one at a time, ignored the responses, and re-sent the whole
    // batch on any failure — so a badge that landed before the failure was
    // written again.
    const db = new FakeD1()
    db.badgeDefinitions.add('badge-1')
    const payload = badgeRequest([
      { badgeId: 'badge-1', earnedAt: '2026-08-04T09:00:00.000Z' },
    ])

    await handleBadgeBulk(payload, alice, envOf(db), respond)
    await handleBadgeBulk(
      badgeRequest([
        { badgeId: 'badge-1', earnedAt: '2026-08-04T10:00:00.000Z' },
      ]),
      alice,
      envOf(db),
      respond,
    )

    expect(db.userBadges).toHaveLength(1)
    // And the first time they earned it is the time that sticks.
    expect(db.userBadges[0]?.earnedAt).toBe('2026-08-04T09:00:00.000Z')
  })

  it('gives two singers their own row for the same badge', async () => {
    const db = new FakeD1()
    db.badgeDefinitions.add('badge-1')
    const row = [{ badgeId: 'badge-1', earnedAt: '2026-08-04T09:00:00.000Z' }]

    await handleBadgeBulk(badgeRequest(row), alice, envOf(db), respond)
    await handleBadgeBulk(badgeRequest(row), bob, envOf(db), respond)

    expect(db.userBadges.map((r) => r.userId)).toEqual(['alice', 'bob'])
  })

  it('drops ids that match no badge definition', async () => {
    const db = new FakeD1()
    db.badgeDefinitions.add('badge-1')

    const res = await handleBadgeBulk(
      badgeRequest([
        { badgeId: 'badge-1', earnedAt: '2026-08-04T09:00:00.000Z' },
        { badgeId: 'not-a-badge', earnedAt: '2026-08-04T09:00:00.000Z' },
      ]),
      alice,
      envOf(db),
      respond,
    )

    expect(await res.json()).toEqual({ written: 1, skipped: 1 })
  })

  it('rejects a malformed row without writing any of them', async () => {
    const db = new FakeD1()
    db.badgeDefinitions.add('badge-1')

    const res = await handleBadgeBulk(
      badgeRequest([
        { badgeId: 'badge-1', earnedAt: '2026-08-04T09:00:00.000Z' },
        { badgeId: 'badge-1' },
      ]),
      alice,
      envOf(db),
      respond,
    )

    expect(res.status).toBe(400)
    expect(db.userBadges).toHaveLength(0)
  })
})

describe('GET /api/me/grant-context', () => {
  it('returns every payload a pass reads, from one batch', async () => {
    const db = new FakeD1()
    db.tables = {
      badgeDefinitions: [{ id: 'b1' }],
      userBadges: [{ id: 'ub1', userId: 'alice' }, { id: 'ub2', userId: 'bob' }],
      achievements: [{ id: 'a1' }, { id: 'a2' }],
      userAchievements: [{ id: 'ua1', userId: 'alice', unlocked: 1 }],
      sessionRecords: [{ id: 's1', userId: 'alice', results: '[]' }],
      challengeDefinitions: [{ id: 'c1' }],
      challengeProgress: [{ id: 'cp1', userId: 'alice', completed: 1 }],
      userActivity: [{ userId: 'alice', kind: 'melody_created', refId: 'm1' }],
      userProfiles: [{ id: 'alice', currentStreak: 4 }],
      voiceprints: [{ id: 'v1', userId: 'alice' }],
      follows: [{ id: 'f1', userId: 'alice' }],
      sharedMelodies: [{ id: 'sm1', userId: 'alice' }],
      sharedSessions: [],
    }

    const res = await handleGrantContext(alice, envOf(db), respond)
    const body = (await res.json()) as Record<string, unknown>

    expect(db.batches).toBe(1)
    expect(body.badgeDefinitions).toHaveLength(1)
    expect(body.achievements).toHaveLength(2)
    expect(body.voiceprintCount).toBe(1)
    expect(body.followingCount).toBe(1)
    // The count that used to be the size of the whole community board.
    expect(body.sharesPosted).toBe(1)
    expect(body.profile).toMatchObject({ id: 'alice', currentStreak: 4 })
  })

  it('hydrates the columns D1 stores as 0/1 and as JSON text', async () => {
    const db = new FakeD1()
    db.tables = {
      badgeDefinitions: [],
      userBadges: [],
      achievements: [],
      userAchievements: [{ id: 'ua1', userId: 'alice', unlocked: 1 }],
      sessionRecords: [{ id: 's1', userId: 'alice', results: '[{"note":1}]' }],
      challengeDefinitions: [],
      challengeProgress: [],
      userActivity: [],
      userProfiles: [],
      voiceprints: [],
      follows: [],
      sharedMelodies: [],
      sharedSessions: [],
    }

    const body = (await (
      await handleGrantContext(alice, envOf(db), respond)
    ).json()) as Record<string, Array<Record<string, unknown>>>

    // A raw 1 here would make `unlocked === true` false on the client and
    // every unlocked goal would re-announce itself.
    expect(body.userAchievements?.[0]?.unlocked).toBe(true)
    expect(body.sessionRecords?.[0]?.results).toEqual([{ note: 1 }])
  })
})

describe('rateLimitSubject', () => {
  const ipRequest = new Request('https://api.test/api/sessionRecords', {
    headers: { 'CF-Connecting-IP': '203.0.113.7' },
  })

  it('gives two singers behind one IP independent buckets', () => {
    // The reported failure mode: a choir rehearsal room shares one NAT, so
    // one cap used to be the whole room's practice budget.
    expect(rateLimitSubject(ipRequest, alice)).not.toBe(
      rateLimitSubject(ipRequest, bob),
    )
  })

  it('gives two tabs of one singer the same bucket', () => {
    const otherTab = new Request('https://api.test/api/sessionRecords', {
      headers: { 'CF-Connecting-IP': '198.51.100.4' },
    })
    // Different network path, same account — still one budget, so a scripted
    // loop cannot buy itself more by changing IP.
    expect(rateLimitSubject(ipRequest, alice)).toBe(
      rateLimitSubject(otherTab, alice),
    )
  })

  it('falls back to the IP when there is no identity to key on', () => {
    expect(rateLimitSubject(ipRequest, null)).toBe('203.0.113.7')
    const headerless = new Request('https://api.test/api/sessionRecords')
    expect(rateLimitSubject(headerless, null)).toBe('127.0.0.1')
  })
})
