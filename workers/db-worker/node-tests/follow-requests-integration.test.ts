// @vitest-environment node
//
// ── Consent is the thing being tested ────────────────────────────────
//
// The defect: a single `follows` row was enough to read someone's streak,
// longest streak, average score, best score, accuracy and session count off
// the Friends leaderboard — and anyone could create that row for anyone,
// because `POST /api/follows` forced `userId` to the caller but took
// `followedUserId` on trust. The Friends view also skips the public board's
// opt-in gate and its qualifying thresholds, so the target need never have
// agreed to be ranked anywhere.
//
// `leaksThroughFriendsBoard` below is the reproduction. It is asserted false
// for a one-sided row and true only once both sides have agreed, so removing
// the `status = 'accepted'` clause from the leaderboard query turns it red.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigration, applyMigrations, SqliteD1Database } from './sqlite-d1'

const FOLLOW_MIGRATION = '0028_follow_requests.sql'
const NOW = '2026-08-09T12:00:00.000Z'
const ADMIN_KEY = 'follow-requests-test-admin'

let sqlite: DatabaseSync
let env: Env

interface Account {
  userId: string
  token: string
  displayName: string
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function authed(
  account: Account,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return workerRequest(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${account.token}`,
      ...(init.headers as Record<string, string>),
    },
  })
}

function post(
  account: Account,
  path: string,
  body: unknown,
): Promise<Response> {
  return authed(account, path, { method: 'POST', body: JSON.stringify(body) })
}

/**
 * A lazily provisioned device identity: no email, no password, and nothing
 * that could sign it in anywhere else. Exactly what the friend graph is now
 * closed to.
 */
async function anonymous(deviceId: string): Promise<Account> {
  const response = await workerRequest('/api/auth/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      deviceSecret: `device-secret-${deviceId.replace(/-/g, '')}`,
    }),
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { token: string; userId: string }
  expect(
    sqlite.prepare('SELECT authProvider FROM users WHERE id = ?').get(deviceId),
  ).toEqual({ authProvider: 'anonymous' })
  return { ...body, displayName: `Singer-${deviceId.slice(0, 6)}` }
}

async function register(displayName: string): Promise<Account> {
  const response = await workerRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${displayName.toLowerCase().replace(/\s+/g, '-')}@example.com`,
      password: 'secret123',
      displayName,
    }),
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { token: string; userId: string }
  return { ...body, displayName }
}

/** A scored run, so the singer has aggregates worth leaking. */
function seedSession(id: string, userId: string, score: number): void {
  sqlite
    .prepare(
      `INSERT INTO sessionRecords
         (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
          score, accuracy, notesHit, notesTotal, streak, results, source)
       VALUES (?, ?, ?, ?, 'Legend: Consent', ?, ?, ?, ?, 9, 10, 5, '{}',
               'exercise')`,
    )
    .run(id, NOW, NOW, userId, NOW, NOW, score, score)
}

/** Numbers only the owner and their real friends should see. */
function seedStreak(userId: string, current: number, longest: number): void {
  sqlite
    .prepare(
      'UPDATE userProfiles SET currentStreak = ?, longestStreak = ? WHERE id = ?',
    )
    .run(current, longest, userId)
}

/** The row the old unilateral follow used to write, minus the endpoint. */
function insertRawFollow(
  from: string,
  to: string,
  status: string = 'pending',
): void {
  sqlite
    .prepare(
      `INSERT INTO follows (id, createdAt, updatedAt, userId, followedUserId, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(`${from}->${to}`, NOW, NOW, from, to, status)
}

/**
 * Can `viewer` read `subject`'s practice record off the Friends board?
 *
 * This is the whole defect expressed as one boolean. It checks the numbers,
 * not merely the row's presence, because the Friends view is also what lifts
 * the streak redaction that the public board applies.
 */
async function leaksThroughFriendsBoard(
  viewer: Account,
  subject: Account,
): Promise<boolean> {
  const response = await authed(
    viewer,
    '/api/leaderboard?category=overall&period=all-time&view=friends',
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as {
    entries: Array<{ userId: string; streak: number; longestStreak: number }>
  }
  const row = body.entries.find((entry) => entry.userId === subject.userId)
  if (!row) return false
  // A row that shows zeroes for everything would not be a leak; the seeds
  // below make sure a real row cannot look like that.
  return row.streak > 0 || row.longestStreak > 0
}

async function followRow(
  from: string,
  to: string,
): Promise<{ status: string } | undefined> {
  return sqlite
    .prepare(
      'SELECT status FROM follows WHERE userId = ? AND followedUserId = ?',
    )
    .get(from, to) as { status: string } | undefined
}

function freshDatabase(): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'follow-requests-integration-secret',
    // These harnesses register real accounts, and registration now passes
    // through the Turnstile gate. A local origin with no TURNSTILE_SECRET is
    // the one configuration the gate lets by, and it is what a developer
    // running the worker locally has — so it is what these simulate.
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  }
}

describe('the follow graph needs both sides', () => {
  let asker: Account
  let target: Account

  beforeEach(async () => {
    freshDatabase()
    asker = await register('Asker Singer')
    target = await register('Target Singer')
    seedSession('asker-run', asker.userId, 80)
    seedSession('target-run', target.userId, 91)
    // Deliberately NOT opted in to the public board: the Friends view skips
    // that gate, which is exactly why an unagreed follow was worth having.
    seedStreak(asker.userId, 4, 6)
    seedStreak(target.userId, 11, 23)
  })

  afterEach(() => {
    sqlite.close()
  })

  it('does not publish a stranger to whoever inserted a one-sided row', async () => {
    // THE REGRESSION, at its most direct: the row exists, exactly as the old
    // create wrote it, and it buys nothing.
    insertRawFollow(asker.userId, target.userId)

    expect(await leaksThroughFriendsBoard(asker, target)).toBe(false)
  })

  it('refuses to write the follow graph through generic CRUD at all', async () => {
    const created = await post(asker, '/api/follows', {
      followedUserId: target.userId,
    })
    expect(created.status).toBe(405)
    await expect(created.json()).resolves.toMatchObject({
      error: 'Use /api/friends/* to change follows',
    })
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)

    insertRawFollow(asker.userId, target.userId)
    const id = `${asker.userId}->${target.userId}`
    const patched = await authed(asker, `/api/follows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    })
    expect(patched.status).toBe(405)
    const deleted = await authed(asker, `/api/follows/${id}`, {
      method: 'DELETE',
    })
    expect(deleted.status).toBe(405)
    expect(await followRow(asker.userId, target.userId)).toEqual({
      status: 'pending',
    })
  })

  it('does not let a pending request count toward a friends badge', async () => {
    // The grant context is the other place "how many friends do you have?"
    // is answered, and in cloud mode its payload wins over the client's own
    // count. Without the status filter a singer could unlock a social badge
    // by asking strangers who never answered.
    await post(asker, '/api/friends/request', { userId: target.userId })

    const pending = await authed(asker, '/api/me/grant-context')
    expect(pending.status).toBe(200)
    await expect(pending.json()).resolves.toMatchObject({ followingCount: 0 })

    await post(target, '/api/friends/accept', { userId: asker.userId })

    const accepted = await authed(asker, '/api/me/grant-context')
    await expect(accepted.json()).resolves.toMatchObject({ followingCount: 1 })
  })

  it('leaves a request pending, and pending grants nothing either way', async () => {
    const requested = await post(asker, '/api/friends/request', {
      userId: target.userId,
    })
    expect(requested.status).toBe(201)
    await expect(requested.json()).resolves.toEqual({ status: 'pending' })

    expect(await followRow(asker.userId, target.userId)).toEqual({
      status: 'pending',
    })
    expect(await followRow(target.userId, asker.userId)).toBeUndefined()
    expect(await leaksThroughFriendsBoard(asker, target)).toBe(false)
    expect(await leaksThroughFriendsBoard(target, asker)).toBe(false)
  })

  it('opens both boards the moment the request is accepted', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })
    const accepted = await post(target, '/api/friends/accept', {
      userId: asker.userId,
    })
    expect(accepted.status).toBe(200)
    await expect(accepted.json()).resolves.toEqual({ status: 'accepted' })

    expect(await followRow(asker.userId, target.userId)).toEqual({
      status: 'accepted',
    })
    expect(await followRow(target.userId, asker.userId)).toEqual({
      status: 'accepted',
    })
    expect(await leaksThroughFriendsBoard(asker, target)).toBe(true)
    expect(await leaksThroughFriendsBoard(target, asker)).toBe(true)
  })

  it('reports the real streak once accepted, not a redacted zero', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })
    await post(target, '/api/friends/accept', { userId: asker.userId })

    const response = await authed(
      asker,
      '/api/leaderboard?category=overall&period=all-time&view=friends',
    )
    const body = (await response.json()) as {
      entries: Array<{
        userId: string
        streak: number
        longestStreak: number
        bestScore: number
      }>
    }
    expect(
      body.entries.find((entry) => entry.userId === target.userId),
    ).toMatchObject({ streak: 11, longestStreak: 23, bestScore: 91 })
  })

  it('closes both boards again when either side removes the other', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })
    await post(target, '/api/friends/accept', { userId: asker.userId })

    // The person who did NOT press remove must lose their view too, or ending
    // a friendship would only end half of it.
    const removed = await post(target, '/api/friends/remove', {
      userId: asker.userId,
    })
    expect(removed.status).toBe(200)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)
    expect(await leaksThroughFriendsBoard(asker, target)).toBe(false)
    expect(await leaksThroughFriendsBoard(target, asker)).toBe(false)
  })

  it('declining is a remove of a request that was never accepted', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })
    const declined = await post(target, '/api/friends/remove', {
      userId: asker.userId,
    })
    expect(declined.status).toBe(200)
    expect(await followRow(asker.userId, target.userId)).toBeUndefined()

    // And the asker may ask again afterwards — a decline is not a ban.
    const again = await post(asker, '/api/friends/request', {
      userId: target.userId,
    })
    expect(again.status).toBe(201)
  })

  it('settles crossed requests without asking anyone twice', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })
    const crossed = await post(target, '/api/friends/request', {
      userId: asker.userId,
    })
    expect(crossed.status).toBe(200)
    await expect(crossed.json()).resolves.toEqual({ status: 'accepted' })

    expect(await followRow(asker.userId, target.userId)).toEqual({
      status: 'accepted',
    })
    expect(await followRow(target.userId, asker.userId)).toEqual({
      status: 'accepted',
    })
  })

  it('answers a repeated request with the state it is already in', async () => {
    const first = await post(asker, '/api/friends/request', {
      userId: target.userId,
    })
    expect(first.status).toBe(201)
    const second = await post(asker, '/api/friends/request', {
      userId: target.userId,
    })
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toEqual({ status: 'pending' })
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(1)

    await post(target, '/api/friends/accept', { userId: asker.userId })
    const third = await post(asker, '/api/friends/request', {
      userId: target.userId,
    })
    await expect(third.json()).resolves.toEqual({ status: 'accepted' })
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(2)
  })

  it('will not accept a request nobody made', async () => {
    const accepted = await post(target, '/api/friends/accept', {
      userId: asker.userId,
    })
    expect(accepted.status).toBe(404)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)
    expect(await leaksThroughFriendsBoard(target, asker)).toBe(false)
  })

  it('will not let the asker accept their own request', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })
    // The pending row is (asker → target); accepting looks for a row addressed
    // TO the caller, so the asker finds nothing of their own to approve.
    const selfAccept = await post(asker, '/api/friends/accept', {
      userId: target.userId,
    })
    expect(selfAccept.status).toBe(404)
    expect(await followRow(asker.userId, target.userId)).toEqual({
      status: 'pending',
    })
    expect(await leaksThroughFriendsBoard(asker, target)).toBe(false)
  })

  it('rejects self-friending, unknown singers, and malformed bodies', async () => {
    const self = await post(asker, '/api/friends/request', {
      userId: asker.userId,
    })
    expect(self.status).toBe(400)

    const nobody = await post(asker, '/api/friends/request', {
      userId: '00000000-0000-4000-8000-0000000009ff',
    })
    expect(nobody.status).toBe(404)

    for (const body of [
      {},
      { userId: '' },
      { userId: 42 },
      { userId: 'x'.repeat(129) },
    ]) {
      const response = await post(asker, '/api/friends/request', body)
      expect(response.status).toBe(400)
    }

    const malformed = await authed(asker, '/api/friends/request', {
      method: 'POST',
      body: '{',
    })
    expect(malformed.status).toBe(400)

    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)
  })

  it('turns every friend route away without a token', async () => {
    for (const path of [
      '/api/friends/request',
      '/api/friends/accept',
      '/api/friends/remove',
      '/api/friends/redeem',
    ]) {
      const response = await workerRequest(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: target.userId, code: 'ABCD1234' }),
      })
      expect(response.status).toBe(401)
    }
    for (const path of ['/api/friends/requests', '/api/friends/code']) {
      expect((await workerRequest(path)).status).toBe(401)
    }
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)
  })

  it('validates the body on accept and remove too, not just request', async () => {
    // Same guard, three routes: a missing or oversized userId must be a 400
    // before any statement runs, or the bind parameter is whatever arrived.
    for (const path of ['/api/friends/accept', '/api/friends/remove']) {
      for (const body of [{}, { userId: '' }, { userId: 7 }]) {
        expect((await post(asker, path, body)).status).toBe(400)
      }
      const malformed = await authed(asker, path, {
        method: 'POST',
        body: '{',
      })
      expect(malformed.status).toBe(400)
    }
    // A redeem with no code at all is the same class of miss.
    expect((await post(asker, '/api/friends/redeem', {})).status).toBe(400)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)
  })

  it('answers the wrong verb on a friend route with 405, not a write', async () => {
    for (const path of [
      '/api/friends/request',
      '/api/friends/accept',
      '/api/friends/remove',
    ]) {
      const response = await authed(asker, path, { method: 'GET' })
      expect(response.status).toBe(405)
    }
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)
  })
})

describe('the requests list', () => {
  let asker: Account
  let target: Account
  let bystander: Account

  beforeEach(async () => {
    freshDatabase()
    asker = await register('Asker Singer')
    target = await register('Target Singer')
    bystander = await register('Bystander Singer')
  })

  afterEach(() => {
    sqlite.close()
  })

  it('shows each side its own half of the same request', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })

    const mine = await authed(asker, '/api/friends/requests')
    expect(mine.status).toBe(200)
    await expect(mine.json()).resolves.toMatchObject({
      incoming: [],
      outgoing: [
        {
          userId: target.userId,
          displayName: 'Target Singer',
          createdAt: expect.any(String),
        },
      ],
    })

    const theirs = await authed(target, '/api/friends/requests')
    await expect(theirs.json()).resolves.toMatchObject({
      incoming: [{ userId: asker.userId, displayName: 'Asker Singer' }],
      outgoing: [],
    })
  })

  it('is the only way to see an incoming request — the generic list cannot', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })

    // GET /api/follows is scoped to rows the caller owns, and the request row
    // belongs to the asker. Without the endpoint the target could never learn
    // they had been asked.
    const generic = await authed(target, '/api/follows')
    const rows = (await generic.json()) as Array<{ userId: string }>
    expect(rows).toEqual([])
  })

  it('drops a request from both lists once it is answered', async () => {
    await post(asker, '/api/friends/request', { userId: target.userId })
    await post(bystander, '/api/friends/request', { userId: target.userId })
    await post(target, '/api/friends/accept', { userId: asker.userId })

    const theirs = (await (
      await authed(target, '/api/friends/requests')
    ).json()) as { incoming: Array<{ userId: string }> }
    expect(theirs.incoming.map((r) => r.userId)).toEqual([bystander.userId])

    const mine = (await (
      await authed(asker, '/api/friends/requests')
    ).json()) as { outgoing: unknown[] }
    expect(mine.outgoing).toEqual([])
  })

  it('names a singer with no profile row rather than showing a blank', async () => {
    sqlite.prepare('DELETE FROM userProfiles WHERE id = ?').run(asker.userId)
    await post(asker, '/api/friends/request', { userId: target.userId })

    const theirs = (await (
      await authed(target, '/api/friends/requests')
    ).json()) as { incoming: Array<{ displayName: string; avatarUrl: null }> }
    expect(theirs.incoming[0]).toEqual({
      userId: asker.userId,
      displayName: `Singer-${asker.userId.slice(0, 6)}`,
      avatarUrl: null,
      createdAt: expect.any(String),
    })
  })
})

describe('friend codes still link both directions at once', () => {
  let owner: Account
  let redeemer: Account

  beforeEach(async () => {
    freshDatabase()
    owner = await register('Code Owner')
    redeemer = await register('Code Redeemer')
    seedSession('owner-run', owner.userId, 88)
    seedSession('redeemer-run', redeemer.userId, 77)
    seedStreak(owner.userId, 9, 14)
    seedStreak(redeemer.userId, 2, 3)
  })

  afterEach(() => {
    sqlite.close()
  })

  async function codeFor(account: Account): Promise<string> {
    const response = await authed(account, '/api/friends/code')
    expect(response.status).toBe(200)
    return ((await response.json()) as { code: string }).code
  }

  it('accepts on redeem, because handing over the code was the yes', async () => {
    const redeemed = await post(redeemer, '/api/friends/redeem', {
      code: await codeFor(owner),
    })
    expect(redeemed.status).toBe(200)
    await expect(redeemed.json()).resolves.toMatchObject({
      ok: true,
      userId: owner.userId,
      status: 'accepted',
    })

    expect(await followRow(redeemer.userId, owner.userId)).toEqual({
      status: 'accepted',
    })
    expect(await followRow(owner.userId, redeemer.userId)).toEqual({
      status: 'accepted',
    })
    expect(await leaksThroughFriendsBoard(redeemer, owner)).toBe(true)
    expect(await leaksThroughFriendsBoard(owner, redeemer)).toBe(true)
  })

  it('upgrades a request that was already pending rather than stranding it', async () => {
    // Ask, get no answer, then be handed the code. The pending row must not
    // survive as pending — that would leave the friendship half-made.
    await post(redeemer, '/api/friends/request', { userId: owner.userId })
    const redeemed = await post(redeemer, '/api/friends/redeem', {
      code: await codeFor(owner),
    })
    expect(redeemed.status).toBe(200)

    expect(await followRow(redeemer.userId, owner.userId)).toEqual({
      status: 'accepted',
    })
    expect(await followRow(owner.userId, redeemer.userId)).toEqual({
      status: 'accepted',
    })
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(2)
  })

  it('still refuses an unknown code, your own code, and a malformed one', async () => {
    expect(
      (await post(redeemer, '/api/friends/redeem', { code: 'ZZZZZZZZ' }))
        .status,
    ).toBe(404)
    expect(
      (await post(owner, '/api/friends/redeem', { code: await codeFor(owner) }))
        .status,
    ).toBe(400)
    expect(
      (await post(redeemer, '/api/friends/redeem', { code: 'short' })).status,
    ).toBe(400)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)
  })

  it('keeps codes and redemption to real accounts', async () => {
    sqlite
      .prepare("UPDATE users SET authProvider = 'anonymous' WHERE id = ?")
      .run(redeemer.userId)
    const code = await codeFor(owner)

    const minted = await authed(redeemer, '/api/friends/code')
    expect(minted.status).toBe(403)
    const redeemed = await post(redeemer, '/api/friends/redeem', { code })
    expect(redeemed.status).toBe(403)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM follows').get()?.n).toBe(0)
  })

  it('returns the same code on every later call', async () => {
    const first = await codeFor(owner)
    expect(await codeFor(owner)).toBe(first)
  })

  it('rejects a malformed redeem body before touching anything', async () => {
    const malformed = await authed(owner, '/api/friends/redeem', {
      method: 'POST',
      body: '{',
    })
    expect(malformed.status).toBe(400)
    await expect(malformed.json()).resolves.toEqual({
      error: 'Invalid JSON body',
    })
  })

  // ── Minting under contention ────────────────────────────────────────
  //
  // Two requests for the same account can race, and the code is UNIQUE
  // across every account. Both losing paths return a code rather than an
  // error, and neither had ever been executed before these tests.

  /**
   * Run `body` with the first `UPDATE userProfiles SET friendCode` intercepted
   * — the stand-in for another request getting there first.
   */
  async function withLostMintRace(
    interfere: () => void,
    body: () => Promise<Response>,
  ): Promise<Response> {
    const real = env.DB
    let fired = false
    env.DB = new Proxy(real, {
      get(base, prop, receiver) {
        if (prop !== 'prepare') return Reflect.get(base, prop, receiver)
        return (sql: string) => {
          if (!fired && sql.startsWith('UPDATE userProfiles SET friendCode')) {
            fired = true
            interfere()
          }
          return real.prepare(sql)
        }
      },
    }) as D1Database
    try {
      return await body()
    } finally {
      env.DB = real
    }
  }

  it('hands back the code the winning request minted', async () => {
    const response = await withLostMintRace(
      () =>
        sqlite
          .prepare('UPDATE userProfiles SET friendCode = ? WHERE id = ?')
          .run('WINNER12', owner.userId),
      () => authed(owner, '/api/friends/code'),
    )

    expect(response.status).toBe(200)
    // Our UPDATE's `friendCode IS NULL` no longer holds, so it changes nothing
    // and the re-read is what answers. Minting a second code would have been
    // the bug: one account, two codes, and a stale one in circulation.
    await expect(response.json()).resolves.toEqual({ code: 'WINNER12' })
    expect(
      sqlite
        .prepare('SELECT friendCode FROM userProfiles WHERE id = ?')
        .get(owner.userId),
    ).toEqual({ friendCode: 'WINNER12' })
  })

  it('draws again when a code is already taken', async () => {
    // The UNIQUE index on friendCode rejects the draw; the loop's job is to
    // try another rather than surface a collision to the singer.
    const response = await withLostMintRace(
      () => {
        throw new Error('UNIQUE constraint failed: userProfiles.friendCode')
      },
      () => authed(owner, '/api/friends/code'),
    )

    expect(response.status).toBe(200)
    const { code } = (await response.json()) as { code: string }
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
  })

  it('gives up honestly when no draw can land', async () => {
    // No profile row, so every UPDATE matches nothing and every re-read comes
    // back empty. Five attempts and then a 503 — not a hang, and not a 200
    // carrying no code.
    sqlite.prepare('DELETE FROM userProfiles WHERE id = ?').run(owner.userId)

    const response = await authed(owner, '/api/friends/code')
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Could not allocate a code, try again',
    })
  })
})

describe('migration 0028 on rows written before it', () => {
  const ALICE = '00000000-0000-4000-8000-0000000000a1'
  const BOB = '00000000-0000-4000-8000-0000000000b1'
  const CAROL = '00000000-0000-4000-8000-0000000000c1'

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec('PRAGMA foreign_keys = ON')
    applyMigrations(sqlite, FOLLOW_MIGRATION)
  })

  afterEach(() => {
    sqlite.close()
  })

  function legacyFollow(from: string, to: string): void {
    sqlite
      .prepare(
        `INSERT INTO follows (id, createdAt, updatedAt, userId, followedUserId)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(`${from}->${to}`, NOW, NOW, from, to)
  }

  it('accepts reciprocal pairs and leaves lone rows pending', async () => {
    // Alice and Bob swapped a friend code: both directions exist, and that
    // only ever happened with consent. Alice also followed Carol on her own.
    legacyFollow(ALICE, BOB)
    legacyFollow(BOB, ALICE)
    legacyFollow(ALICE, CAROL)

    applyMigration(sqlite, FOLLOW_MIGRATION)

    const rows = sqlite
      .prepare('SELECT userId, followedUserId, status FROM follows ORDER BY id')
      .all() as Array<{
      userId: string
      followedUserId: string
      status: string
    }>
    expect(rows).toEqual([
      { userId: ALICE, followedUserId: BOB, status: 'accepted' },
      { userId: ALICE, followedUserId: CAROL, status: 'pending' },
      { userId: BOB, followedUserId: ALICE, status: 'accepted' },
    ])
  })

  it('defaults new rows to pending without the writer saying so', async () => {
    applyMigration(sqlite, FOLLOW_MIGRATION)
    legacyFollow(ALICE, CAROL)

    expect(
      sqlite.prepare('SELECT status FROM follows WHERE userId = ?').get(ALICE),
    ).toEqual({ status: 'pending' })
  })
})

// ── Friends are a registered-account feature ─────────────────────────
//
// Friend CODES were already account-only; requests and accepts were not. So
// an anonymous singer — a device id in one browser's localStorage, with no
// way to sign in from anywhere else — could send an ask, and be sent one.
// Neither works out: they cannot answer from a second device, they cannot
// take an ask back after clearing the browser, and the friendship disappears
// with the profile, leaving a dead name in somebody else's list.
//
// Every test below is a reproduction. Delete the `accountRequired` /
// `TARGET_ACCOUNT_REQUIRED` guards in src/friends.ts and each one goes red on
// a 200/201 and a row that should not exist.

describe('friends are a registered-account feature', () => {
  const DEVICE = '00000000-0000-4000-8000-00000000d001'
  const OTHER_DEVICE = '00000000-0000-4000-8000-00000000d002'

  let singer: Account
  let anon: Account

  beforeEach(async () => {
    freshDatabase()
    singer = await register('Registered Singer')
    anon = await anonymous(DEVICE)
    seedSession('singer-run', singer.userId, 84)
    seedSession('anon-run', anon.userId, 66)
    seedStreak(singer.userId, 7, 19)
    seedStreak(anon.userId, 3, 5)
  })

  afterEach(() => {
    sqlite.close()
  })

  function followCount(): number {
    return (
      sqlite.prepare('SELECT COUNT(*) n FROM follows').get() as { n: number }
    ).n
  }

  it('turns an anonymous singer away from every route that adds a friend', async () => {
    for (const path of ['/api/friends/request', '/api/friends/accept']) {
      const response = await post(anon, path, { userId: singer.userId })
      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toEqual({
        error: 'Create an account to add friends',
      })
    }

    const redeemed = await post(anon, '/api/friends/redeem', {
      code: 'ABCD1234',
    })
    expect(redeemed.status).toBe(403)

    const minted = await authed(anon, '/api/friends/code')
    expect(minted.status).toBe(403)

    expect(followCount()).toBe(0)
  })

  it('refuses the request before reading the body, so nothing is half-checked', async () => {
    // The gate runs ahead of validation on purpose: an anonymous caller gets
    // the same answer whatever they send, rather than learning which shapes
    // of body would have been accepted had they held an account.
    for (const body of [{}, { userId: '' }, { userId: 42 }]) {
      expect((await post(anon, '/api/friends/request', body)).status).toBe(403)
    }
    const malformed = await authed(anon, '/api/friends/request', {
      method: 'POST',
      body: '{',
    })
    expect(malformed.status).toBe(403)
    expect(followCount()).toBe(0)
  })

  it('will not let a registered singer ask an anonymous one', async () => {
    // The other half of the rule, and the one that would otherwise strand a
    // request: accepting is gated, so this row could never have been answered
    // while telling the asker it had been sent.
    const asked = await post(singer, '/api/friends/request', {
      userId: anon.userId,
    })
    expect(asked.status).toBe(403)
    await expect(asked.json()).resolves.toEqual({
      error: 'That singer hasn’t created an account yet',
    })
    expect(await followRow(singer.userId, anon.userId)).toBeUndefined()
    expect(followCount()).toBe(0)
    expect(await leaksThroughFriendsBoard(singer, anon)).toBe(false)
  })

  it('still says "no such singer" for an id that is nobody', async () => {
    // The anonymous refusal must not swallow the missing-user case: a 403
    // for an id that does not exist would claim an account state for a
    // singer who has none.
    const nobody = await post(singer, '/api/friends/request', {
      userId: '00000000-0000-4000-8000-0000000009ff',
    })
    expect(nobody.status).toBe(404)
    await expect(nobody.json()).resolves.toEqual({ error: 'No such singer' })
  })

  it('refuses to accept a pending row left by an anonymous asker', async () => {
    // Rows like this predate the rule. Accepting one would mint exactly the
    // friendship the rule exists to prevent, so the check is repeated here
    // rather than trusted to have happened at ask time.
    insertRawFollow(anon.userId, singer.userId)

    const accepted = await post(singer, '/api/friends/accept', {
      userId: anon.userId,
    })
    expect(accepted.status).toBe(403)
    await expect(accepted.json()).resolves.toEqual({
      error: 'That singer hasn’t created an account yet',
    })
    expect(await followRow(anon.userId, singer.userId)).toEqual({
      status: 'pending',
    })
    expect(await followRow(singer.userId, anon.userId)).toBeUndefined()
    expect(await leaksThroughFriendsBoard(singer, anon)).toBe(false)
    expect(await leaksThroughFriendsBoard(anon, singer)).toBe(false)
  })

  it('answers the requests list with the same 403, not a list to act on', async () => {
    insertRawFollow(anon.userId, singer.userId)
    insertRawFollow(singer.userId, anon.userId)

    const listed = await authed(anon, '/api/friends/requests')
    expect(listed.status).toBe(403)
    await expect(listed.json()).resolves.toEqual({
      error: 'Create an account to add friends',
    })
  })

  it('lets an anonymous singer out of a row they cannot get into', async () => {
    // The deliberate exemption. Removing is what declining is built on, and
    // requiring an account to LEAVE a friendship that needed none to start
    // would strand precisely the people this change is protecting.
    insertRawFollow(anon.userId, singer.userId, 'accepted')
    insertRawFollow(singer.userId, anon.userId, 'accepted')

    const removed = await post(anon, '/api/friends/remove', {
      userId: singer.userId,
    })
    expect(removed.status).toBe(200)
    expect(followCount()).toBe(0)
    expect(await leaksThroughFriendsBoard(singer, anon)).toBe(false)
  })

  it('leaves a friendship made before the rule standing until someone ends it', async () => {
    // Not a hard cutover: rows already agreed to keep working. The rule
    // governs what can be CREATED, and the remove above is how either side
    // opts out. Deleting them under people instead would be a separate,
    // louder decision.
    insertRawFollow(anon.userId, singer.userId, 'accepted')
    insertRawFollow(singer.userId, anon.userId, 'accepted')

    expect(await leaksThroughFriendsBoard(anon, singer)).toBe(true)
    expect(await leaksThroughFriendsBoard(singer, anon)).toBe(true)
  })

  it('does not count an anonymous singer toward a friends badge', async () => {
    // followingCount feeds the social grants, and in cloud mode its payload
    // beats the client's own count. Answering the legacy ask is what would
    // have turned it into a friend — the refusal has to hold all the way
    // through to the badge, not merely to the endpoint.
    insertRawFollow(anon.userId, singer.userId)
    expect(
      (await post(singer, '/api/friends/accept', { userId: anon.userId }))
        .status,
    ).toBe(403)

    const context = await authed(singer, '/api/me/grant-context')
    expect(context.status).toBe(200)
    await expect(context.json()).resolves.toMatchObject({ followingCount: 0 })
  })

  it('leaves two registered singers able to become friends as before', async () => {
    // The regression guard: the gate must refuse anonymous callers without
    // catching anybody else, including while an anonymous account sits in
    // the same table.
    const friend = await register('Second Singer')
    seedSession('friend-run', friend.userId, 93)
    seedStreak(friend.userId, 12, 30)

    expect(
      (await post(singer, '/api/friends/request', { userId: friend.userId }))
        .status,
    ).toBe(201)
    expect(
      (await post(friend, '/api/friends/accept', { userId: singer.userId }))
        .status,
    ).toBe(200)

    expect(await leaksThroughFriendsBoard(singer, friend)).toBe(true)
    expect(await leaksThroughFriendsBoard(friend, singer)).toBe(true)
    // And still nothing for the anonymous account sharing the database.
    expect(await leaksThroughFriendsBoard(anon, singer)).toBe(false)
  })

  it('opens the whole feature the moment that device registers', async () => {
    // An anonymous singer is not banned, they are early. Registering with the
    // same deviceId upgrades the row in place, so the id that was refused a
    // minute ago is the id that now works — no second identity, no lost
    // history.
    const upgrade = await workerRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'upgraded@example.com',
        password: 'secret123',
        displayName: 'Upgraded Singer',
        deviceId: DEVICE,
        deviceSecret: `device-secret-${DEVICE.replace(/-/g, '')}`,
      }),
    })
    expect(upgrade.status).toBe(200)
    const upgraded = (await upgrade.json()) as { token: string; userId: string }
    expect(upgraded.userId).toBe(anon.userId)

    const account: Account = { ...upgraded, displayName: 'Upgraded Singer' }
    expect(
      (await post(account, '/api/friends/request', { userId: singer.userId }))
        .status,
    ).toBe(201)
    expect((await authed(account, '/api/friends/code')).status).toBe(200)
    expect((await authed(account, '/api/friends/requests')).status).toBe(200)

    // And the registered singer may now ask them back.
    const second = await anonymous(OTHER_DEVICE)
    expect(
      (await post(singer, '/api/friends/request', { userId: second.userId }))
        .status,
    ).toBe(403)
    expect(
      (await post(singer, '/api/friends/request', { userId: account.userId }))
        .status,
    ).toBe(200)
  })
})
