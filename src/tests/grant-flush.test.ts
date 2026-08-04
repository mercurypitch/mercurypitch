// ============================================================
// Grant flush — one request per window, and nothing lost on the way
// ============================================================
//
// The claim this file holds: a burst of runs costs ONE achievements request,
// and a request that fails costs none of the progress it was carrying.
//
// The cloud path is what is exercised here (the local repository path is
// covered by grant-pass-cost.test.ts), so `fetch` is the seam — every call it
// records is a real HTTPS round trip in production, which is the number the
// whole exercise was about.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'http://api.test' }))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

import { discardPendingGrants, flushGrants, pendingAchievement, pendingCount, queueAchievement, queueBadge, } from '@/db/services/grant-flush'
import { setAuthToken } from '@/db/services/user-service'

interface Recorded {
  url: string
  body: unknown
  keepalive: boolean
}

const recorded: Recorded[] = []
let respondWith: () => Response = () => new Response('{}', { status: 200 })

/** A token that `hasValidToken` accepts: unexpired, well-formed enough. */
function signInFake(): void {
  const payload = {
    sub: 'singer-1',
    provider: 'password',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const b64 = (o: object): string =>
    btoa(JSON.stringify(o))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  setAuthToken(`${b64({ alg: 'HS256' })}.${b64(payload)}.sig`)
}

beforeEach(() => {
  recorded.length = 0
  respondWith = () => new Response('{}', { status: 200 })
  discardPendingGrants()
  signInFake()
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    recorded.push({
      url: String(url),
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      keepalive: init?.keepalive === true,
    })
    return Promise.resolve(respondWith())
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  discardPendingGrants()
  setAuthToken(null)
})

describe('flushGrants', () => {
  it('sends every queued achievement as one request', async () => {
    for (let i = 0; i < 9; i++) {
      queueAchievement({
        achievementId: `ach-${i}`,
        progress: i * 10,
        unlocked: false,
      })
    }
    await flushGrants()

    // Nine rows used to be nine serial PATCHes at ~85 ms each.
    expect(recorded).toHaveLength(1)
    expect(recorded[0]?.url).toBe('http://api.test/api/userAchievements/bulk')
    expect((recorded[0]?.body as { rows: unknown[] }).rows).toHaveLength(9)
    expect(pendingCount()).toBe(0)
  })

  it('keeps only the newest value for an achievement queued twice', async () => {
    queueAchievement({ achievementId: 'ach-1', progress: 20, unlocked: false })
    queueAchievement({ achievementId: 'ach-1', progress: 40, unlocked: false })
    queueAchievement({ achievementId: 'ach-1', progress: 60, unlocked: true })
    expect(pendingCount()).toBe(1)

    await flushGrants()
    const rows = (recorded[0]?.body as { rows: Array<Record<string, unknown>> })
      .rows
    expect(rows).toEqual([
      { achievementId: 'ach-1', progress: 60, unlocked: true },
    ])
  })

  it('does nothing at all when there is nothing queued', async () => {
    await flushGrants()
    expect(recorded).toHaveLength(0)
  })

  it('puts the rows back when the request fails', async () => {
    respondWith = () => new Response('nope', { status: 500 })
    queueAchievement({ achievementId: 'ach-1', progress: 30, unlocked: false })

    await flushGrants()

    // Dropping the buffer here would reset the singer's visible progress to
    // whatever was last stored, which is worse than being a minute stale.
    expect(pendingCount()).toBe(1)
    expect(pendingAchievement('ach-1')?.progress).toBe(30)
  })

  it('does not overwrite a fresher value while retrying a failed flush', async () => {
    respondWith = () => new Response('nope', { status: 500 })
    queueAchievement({ achievementId: 'ach-1', progress: 30, unlocked: false })
    const failing = flushGrants()
    // A pass lands while the doomed request is in the air.
    queueAchievement({ achievementId: 'ach-1', progress: 45, unlocked: false })
    await failing

    expect(pendingAchievement('ach-1')?.progress).toBe(45)
  })

  it('abandons the buffer rather than writing it to the next account', async () => {
    respondWith = () => new Response('nope', { status: 500 })
    queueAchievement({ achievementId: 'ach-1', progress: 30, unlocked: false })
    const failing = flushGrants()
    // Sign-out happens while the flush is in the air. Its rows belong to the
    // identity that earned them, so a failure must not re-queue them.
    discardPendingGrants()
    await failing

    expect(pendingCount()).toBe(0)
  })

  it('marks the unload flush keepalive so it survives the page going away', async () => {
    queueAchievement({ achievementId: 'ach-1', progress: 30, unlocked: false })
    await flushGrants(true)
    expect(recorded[0]?.keepalive).toBe(true)
  })

  it('posts badges separately — they are rare, and there is no bulk for them', async () => {
    queueAchievement({ achievementId: 'ach-1', progress: 100, unlocked: true })
    queueBadge('badge-1', '2026-08-04T10:00:00.000Z')
    await flushGrants()

    expect(recorded.map((r) => r.url)).toEqual([
      'http://api.test/api/userAchievements/bulk',
      'http://api.test/api/userBadges',
    ])
  })
})
