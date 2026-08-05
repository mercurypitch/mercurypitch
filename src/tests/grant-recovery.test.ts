// ============================================================
// Grant recovery — what a lost flush costs, and what repairs it
// ============================================================
//
// `grant-flush.test.ts` covers a flush that FAILS: the request comes back
// non-ok, the rows go back on the queue, a retry sends them. This file covers
// the case no retry can reach — the buffer disappearing with the tab. A crash,
// a force-quit or a dead battery between windows takes the in-memory Maps with
// it, and neither `visibilitychange` nor `pagehide` fires.
//
// The claim being pinned is that this costs nothing permanently, and the reason
// is worth stating because it is not obvious from `grant-flush.ts` alone: the
// engine diffs what it just computed against the rows the SERVER returned, not
// against a local copy of what it believed it wrote. So a server left stale by
// a lost flush disagrees with the next evaluation, and disagreement is exactly
// what queues a row. Were the diff taken against local state, the second pass
// would see its own optimistic write, find nothing to do, and the cloud would
// stay wrong for good.
//
// The seam is `fetch`, and the fake behind it is a real little server: the
// bulk endpoints write into the same object `/api/me/grant-context` reads back,
// so a test cannot pass by asserting on a request that changed nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'

// Partial: the engine's graph reads more of this module than the flush does
// (`IS_DEV` among them), and stubbing it wholesale fails the suite at import.
vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

const notifications: string[] = []
vi.mock('@/stores/notifications-store', () => ({
  showNotification: (message: string) => {
    notifications.push(message)
  },
}))

import { checkAndGrantBadges } from '@/db/services/badge-grant-engine'
import { discardPendingGrants, flushGrants, pendingCount, } from '@/db/services/grant-flush'
import { setAuthToken } from '@/db/services/user-service'

interface ServerAchievementRow {
  achievementId: string
  progress: number
  unlocked: boolean
  unlockedAt?: string
}

/**
 * Two goals a handful of drills can move, and nothing else — a small
 * catalogue keeps the assertions about counts readable. Names are the join
 * key: `buildMeasures` is keyed by achievement name, not by id.
 */
const ACHIEVEMENTS = [
  { id: 'a-drill', name: 'Drill Sergeant', required: 4 },
  { id: 'a-first', name: 'First Note', required: 1 },
]

/** Mutable server state. The bulk endpoints write here; the context reads it. */
let server: {
  userAchievements: ServerAchievementRow[]
  sessionRecords: Array<Record<string, unknown>>
}

const requests: string[] = []

function drill(endedAt: string): Record<string, unknown> {
  return {
    id: `s-${endedAt}`,
    userId: 'singer-1',
    melodyName: 'scale',
    startedAt: endedAt,
    endedAt,
    score: 60,
    accuracy: 60,
    notesHit: 8,
    notesTotal: 10,
    streak: 1,
    source: 'exercise',
  }
}

function grantContextBody(): string {
  return JSON.stringify({
    badgeDefinitions: [],
    userBadges: [],
    achievements: ACHIEVEMENTS.map((a) => ({
      ...a,
      description: a.name,
      category: 'beginnings',
      points: 10,
      icon: 'x',
    })),
    userAchievements: server.userAchievements,
    sessionRecords: server.sessionRecords,
    challengeDefinitions: [],
    challengeProgress: [],
    userActivity: [],
    profile: null,
    voiceprintCount: 0,
    followingCount: 0,
    sharesPosted: 0,
  })
}

/** Upsert on achievementId — the same contract the D1 endpoint has. */
function applyBulk(rows: ServerAchievementRow[]): void {
  for (const row of rows) {
    const found = server.userAchievements.find(
      (r) => r.achievementId === row.achievementId,
    )
    if (found) Object.assign(found, row)
    else server.userAchievements.push({ ...row })
  }
}

/** A token `hasValidToken` accepts, so the cloud path is the one taken. */
function signInFake(): void {
  const b64 = (o: object): string =>
    btoa(JSON.stringify(o))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  const payload = {
    sub: 'singer-1',
    provider: 'password',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  setAuthToken(`${b64({ alg: 'HS256' })}.${b64(payload)}.sig`)
}

beforeEach(() => {
  server = { userAchievements: [], sessionRecords: [] }
  requests.length = 0
  notifications.length = 0
  discardPendingGrants()
  signInFake()
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const path = String(url)
    requests.push(path)
    if (path.endsWith('/api/me/grant-context')) {
      return Promise.resolve(new Response(grantContextBody(), { status: 200 }))
    }
    if (path.endsWith('/api/userAchievements/bulk')) {
      const body = JSON.parse(String(init?.body)) as {
        rows: ServerAchievementRow[]
      }
      applyBulk(body.rows)
      return Promise.resolve(new Response('{}', { status: 200 }))
    }
    return Promise.resolve(new Response('{}', { status: 200 }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  discardPendingGrants()
  setAuthToken(null)
})

const stored = (id: string): ServerAchievementRow | undefined =>
  server.userAchievements.find((r) => r.achievementId === id)

describe('a grant pass over the cloud', () => {
  it('counts drills, so an exercise run moves a goal measured on them', async () => {
    // The regression this guards is real: until 2026-08-04 finishing an
    // exercise ran no pass at all, and a dev account with 32 drills had three
    // achievement rows to show for them. Here the measure is what is pinned —
    // `bySource.exercise` reaching a goal keyed on drills.
    server.sessionRecords = [drill('2026-08-05T10:00:00.000Z')]

    await checkAndGrantBadges()
    await flushGrants()

    expect(stored('a-drill')).toMatchObject({ progress: 25, unlocked: false })
    expect(stored('a-first')).toMatchObject({ progress: 100, unlocked: true })
  })

  it('writes nothing the second time when the server already agrees', async () => {
    server.sessionRecords = [drill('2026-08-05T10:00:00.000Z')]
    await checkAndGrantBadges()
    await flushGrants()

    requests.length = 0
    await checkAndGrantBadges()
    await flushGrants()

    expect(requests.filter((r) => r.includes('bulk'))).toEqual([])
    expect(pendingCount()).toBe(0)
  })
})

describe('a flush lost with the tab', () => {
  it('repairs itself on the next pass, because the diff is against the server', async () => {
    server.sessionRecords = [
      drill('2026-08-05T10:00:00.000Z'),
      drill('2026-08-05T10:01:00.000Z'),
    ]

    // Pass one earns two rows and queues them...
    await checkAndGrantBadges()
    expect(pendingCount()).toBe(2)

    // ...and then the tab dies. No flush, no beacon, no keepalive fetch: the
    // buffer simply ceases to exist, which is what a crash looks like from the
    // outside.
    discardPendingGrants()
    expect(pendingCount()).toBe(0)
    expect(server.userAchievements).toEqual([])

    // The singer comes back and finishes another run. Nothing replays the lost
    // buffer — the repair is that the evaluation disagrees with the server.
    server.sessionRecords.push(drill('2026-08-05T11:00:00.000Z'))
    await checkAndGrantBadges()
    await flushGrants()

    expect(stored('a-first')).toMatchObject({ progress: 100, unlocked: true })
    expect(stored('a-drill')).toMatchObject({ progress: 75, unlocked: false })
  })

  it('recovers an UNLOCK, not just a progress percentage', async () => {
    // The distinction matters: progress is re-derived every pass and cheap to
    // lose, but `unlocked` is once-only and the engine skips any goal already
    // unlocked. If the skip were keyed on local belief rather than on the
    // server's row, a lost flush would strand the unlock permanently.
    server.sessionRecords = Array.from({ length: 4 }, (_, i) =>
      drill(`2026-08-05T1${i}:00:00.000Z`),
    )

    await checkAndGrantBadges()
    discardPendingGrants() // the unlock is lost mid-air

    await checkAndGrantBadges()
    await flushGrants()

    expect(stored('a-drill')).toMatchObject({ progress: 100, unlocked: true })
    expect(stored('a-drill')?.unlockedAt).toBeTypeOf('string')
  })

  it('announces an unlock again after losing it, and only once it sticks', async () => {
    // The toast is driven by the evaluation, so a lost flush costs a duplicate
    // announcement on the pass that repairs it. That is the right trade — a
    // singer seeing "unlocked" twice is better than a goal that never records —
    // but it should not keep repeating once the row is actually stored.
    server.sessionRecords = [drill('2026-08-05T10:00:00.000Z')]

    await checkAndGrantBadges()
    discardPendingGrants()
    await checkAndGrantBadges()
    await flushGrants()

    const first = notifications.filter((n) => n.includes('First Note'))
    expect(first).toHaveLength(2)

    notifications.length = 0
    await checkAndGrantBadges()
    await flushGrants()
    expect(notifications).toEqual([])
  })
})

describe('a pass that can see nothing', () => {
  it('leaves stored rows alone when the context read fails', async () => {
    // A pass on an unreachable API evaluates against an empty context and
    // would otherwise conclude the singer has achieved nothing — then write
    // that. Rows already earned must survive it.
    server.sessionRecords = [drill('2026-08-05T10:00:00.000Z')]
    await checkAndGrantBadges()
    await flushGrants()
    const before = JSON.parse(JSON.stringify(server.userAchievements))

    vi.stubGlobal('fetch', (url: string) => {
      const path = String(url)
      requests.push(path)
      if (path.endsWith('/api/me/grant-context')) {
        return Promise.resolve(new Response('nope', { status: 500 }))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    await checkAndGrantBadges()
    await flushGrants()

    expect(server.userAchievements).toEqual(before)
  })
})
