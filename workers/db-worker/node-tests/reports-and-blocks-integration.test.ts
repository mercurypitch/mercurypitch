// @vitest-environment node
//
// ── Reports, blocks and the name filter, on the real migrations ──────
//
// What App Store guideline 1.2 asks of an app whose singers post, worked
// through the worker end to end: a block hides two singers from each other
// on every list and board (and never moves anyone's place), a report reaches
// the owner's console once per reporter and target, the owner can answer it
// and take a share down, a suspended singer's shares go dark, and the names
// other singers read pass the filter. Real accounts, registered through the
// real route, on every migration in order.

import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { isoWeekStart } from '../src/league'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'reports-blocks-test-admin'
const NOW = new Date().toISOString()
const CHALLENGE_ID = 'legend-reports-blocks'

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

function admin(path: string, init: RequestInit = {}): Promise<Response> {
  return workerRequest(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
      ...(init.headers as Record<string, string>),
    },
  })
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
  return { ...body, displayName: `Singer-${deviceId.slice(0, 6)}` }
}

async function shareMelody(
  account: Account,
  melodyName: string,
  opts: { lyrics?: string[]; isPublic?: boolean; author?: string } = {},
): Promise<Response> {
  const lyrics = opts.lyrics ?? ['la']
  return post(account, '/api/sharedMelodies', {
    melodyId: '',
    melodyName,
    author: opts.author ?? account.displayName,
    tags: ['my-melody', 'practice'],
    itemsJson: JSON.stringify(
      lyrics.map((lyricText, index) => ({
        id: index + 1,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
        startBeat: index,
        duration: 1,
        lyricText,
      })),
    ),
    isPublic: opts.isPublic ?? true,
  })
}

async function sharedId(account: Account, melodyName: string): Promise<string> {
  const response = await shareMelody(account, melodyName)
  expect(response.status).toBe(201)
  return ((await response.json()) as { id: string }).id
}

async function publicMelodies(
  viewer: Account | null,
): Promise<Array<{ melodyName: string; author: string }>> {
  const path = '/api/sharedMelodies?where[isPublic]=true&orderBy=createdAt'
  const response =
    viewer === null ? await workerRequest(path) : await authed(viewer, path)
  expect(response.status).toBe(200)
  return (await response.json()) as Array<{
    melodyName: string
    author: string
  }>
}

async function melodyNames(viewer: Account | null): Promise<string[]> {
  return (await publicMelodies(viewer)).map((row) => row.melodyName).sort()
}

async function block(blocker: Account, blocked: Account): Promise<Response> {
  return post(blocker, '/api/blocks', { userId: blocked.userId })
}

/** A singer the public board will rank: opted in, three days, one run. */
function seedBoardRun(account: Account, score: number): void {
  sqlite
    .prepare(
      `UPDATE userProfiles
       SET leaderboardOptIn = 1, leaderboardOptInAt = ?, currentStreak = 3,
           longestStreak = 3
       WHERE id = ?`,
    )
    .run(NOW, account.userId)
  sqlite
    .prepare(
      `INSERT INTO sessionRecords
         (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
          score, accuracy, notesHit, notesTotal, streak, weeklyChallengeId,
          results, source)
       VALUES (?, ?, ?, ?, 'Legend: Blocks', ?, ?, ?, ?, 9, 10, 3, ?, '{}',
               'weekly')`,
    )
    .run(
      `run-${account.userId}`,
      NOW,
      NOW,
      account.userId,
      NOW,
      NOW,
      score,
      score,
      CHALLENGE_ID,
    )
}

function seedChallenge(): void {
  sqlite
    .prepare(
      `INSERT INTO weeklyChallenges
         (id, createdAt, updatedAt, slug, title, description, featType,
          difficulty, targetItems, targetScore, startsAt, endsAt, evergreen,
          status)
       VALUES (?, ?, ?, 'blocks-legend', 'Blocks', 'One week of it',
               'money-note', 'intermediate', '[]', 80, ?, ?, 0, 'active')`,
    )
    .run(CHALLENGE_ID, NOW, NOW, NOW, NOW)
}

function seedLeague(members: Array<[Account, number]>): void {
  const weekStart = isoWeekStart()
  sqlite
    .prepare(
      `INSERT INTO leagueCohorts (id, createdAt, leagueId, weekStart)
       VALUES ('cohort-blocks', ?, 'l1', ?)`,
    )
    .run(NOW, weekStart)
  for (const [account, points] of members) {
    sqlite
      .prepare(
        `INSERT INTO leagueMembership (id, updatedAt, userId, cohortId, weekStart, points)
         VALUES (?, ?, ?, 'cohort-blocks', ?, ?)`,
      )
      .run(`member-${account.userId}`, NOW, account.userId, weekStart, points)
  }
}

function rowCount(sql: string, ...binds: string[]): number {
  return (sqlite.prepare(sql).get(...binds) as { n: number }).n
}

function freshDatabase(): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'reports-blocks-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  }
}

describe('a block', () => {
  let ada: Account
  let ben: Account
  let cleo: Account

  beforeEach(async () => {
    freshDatabase()
    ada = await register('Ada Singer')
    ben = await register('Ben Singer')
    cleo = await register('Cleo Singer')
  })

  it('hides each singer’s shares from the other, and from nobody else', async () => {
    const adas = await sharedId(ada, 'Ada Tune')
    await sharedId(ben, 'Ben Tune')

    expect((await block(ben, ada)).status).toBe(201)

    expect(await melodyNames(ben)).toEqual(['Ben Tune'])
    expect(await melodyNames(ada)).toEqual(['Ada Tune'])
    expect(await melodyNames(cleo)).toEqual(['Ada Tune', 'Ben Tune'])
    expect(await melodyNames(null)).toEqual(['Ada Tune', 'Ben Tune'])
    expect((await authed(ben, `/api/sharedMelodies/${adas}`)).status).toBe(404)
    expect((await authed(cleo, `/api/sharedMelodies/${adas}`)).status).toBe(200)

    const lifted = await authed(ben, `/api/blocks/${ada.userId}`, {
      method: 'DELETE',
    })
    expect(lifted.status).toBe(200)
    expect(await melodyNames(ben)).toEqual(['Ada Tune', 'Ben Tune'])
  })

  it('belongs to the account, not to whoever signs in next on the device', async () => {
    await sharedId(ada, 'Ada Tune')
    await block(ben, ada)
    // The same phone, signed into another account: the block stays Ben's.
    expect(await melodyNames(cleo)).toEqual(['Ada Tune'])
    expect(await melodyNames(ben)).toEqual([])
  })

  it('lists whom the singer blocked, by their current name', async () => {
    await block(ben, ada)
    expect((await block(ben, ada)).status).toBe(200)
    const response = await authed(ben, '/api/blocks')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    const body = (await response.json()) as {
      blocks: Array<{ userId: string; displayName: string }>
    }
    expect(body.blocks).toEqual([
      expect.objectContaining({
        userId: ada.userId,
        displayName: 'Ada Singer',
      }),
    ])
    const adas = (await (await authed(ada, '/api/blocks')).json()) as {
      blocks: unknown[]
    }
    expect(adas.blocks).toEqual([])
  })

  it('ends a friendship, and refuses a request either way without naming the block', async () => {
    expect(
      (await post(ada, '/api/friends/request', { userId: ben.userId })).status,
    ).toBe(201)
    expect(
      (await post(ben, '/api/friends/accept', { userId: ada.userId })).status,
    ).toBe(200)
    expect(
      rowCount(
        'SELECT COUNT(*) AS n FROM follows WHERE userId IN (?, ?)',
        ada.userId,
        ben.userId,
      ),
    ).toBe(2)

    await block(ben, ada)
    expect(
      rowCount(
        'SELECT COUNT(*) AS n FROM follows WHERE userId IN (?, ?)',
        ada.userId,
        ben.userId,
      ),
    ).toBe(0)

    const asked = await post(ada, '/api/friends/request', {
      userId: ben.userId,
    })
    expect(asked.status).toBe(404)
    expect(await asked.json()).toEqual({ error: 'No such singer' })
    const asking = await post(ben, '/api/friends/request', {
      userId: ada.userId,
    })
    expect(asking.status).toBe(409)
  })

  it('hides names on the leaderboard and keeps every place', async () => {
    seedBoardRun(ada, 90)
    seedBoardRun(ben, 80)
    seedBoardRun(cleo, 70)
    await block(cleo, ada)

    const board = async (viewer: Account) => {
      const response = await authed(
        viewer,
        '/api/leaderboard?category=overall&period=all-time&view=global',
      )
      expect(response.status).toBe(200)
      return (await response.json()) as {
        total: number
        entries: Array<{ userId: string; rank: number }>
      }
    }
    const cleos = await board(cleo)
    expect(cleos.entries.map((row) => [row.userId, row.rank])).toEqual([
      [ben.userId, 2],
      [cleo.userId, 3],
    ])
    expect(cleos.total).toBe(2)
    const bens = await board(ben)
    expect(bens.entries.map((row) => row.rank)).toEqual([1, 2, 3])
  })

  it('hides names on the Legend’s board and keeps every place', async () => {
    seedChallenge()
    seedBoardRun(ada, 90)
    seedBoardRun(ben, 80)
    seedBoardRun(cleo, 70)
    await block(ada, cleo)

    const response = await authed(cleo, `/api/weekly/board?id=${CHALLENGE_ID}`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      top: Array<Record<string, unknown>>
      you: { rank: number }
      rankedCount: number
    }
    expect(body.top.map((row) => [row.displayName, row.rank])).toEqual([
      ['Ben Singer', 2],
      ['Cleo Singer', 3],
    ])
    expect(body.top.every((row) => !('userId' in row))).toBe(true)
    expect(body.you.rank).toBe(3)
    expect(body.rankedCount).toBe(3)
  })

  it('hides names in the league and keeps every place and the cohort’s size', async () => {
    seedLeague([
      [ada, 300],
      [ben, 200],
      [cleo, 100],
    ])
    sqlite.prepare('UPDATE userProfiles SET leaderboardOptIn = 1').run()
    await block(cleo, ada)

    const response = await authed(cleo, '/api/league/me')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      rank: number
      cohortSize: number
      standings: Array<{ userId: string; rank: number }>
    }
    expect(body.standings.map((row) => [row.userId, row.rank])).toEqual([
      [ben.userId, 2],
      [cleo.userId, 3],
    ])
    expect(body.rank).toBe(3)
    expect(body.cohortSize).toBe(3)
  })

  it('leaves a league row under a pseudonym in place, so a block unmasks nobody', async () => {
    seedLeague([
      [ada, 300],
      [ben, 200],
      [cleo, 100],
    ])
    // Ada never opted in: the others see her row as a pseudonym.
    sqlite
      .prepare('UPDATE userProfiles SET leaderboardOptIn = 1 WHERE id <> ?')
      .run(ada.userId)
    await block(cleo, ada)

    const response = await authed(cleo, '/api/league/me')
    const body = (await response.json()) as {
      standings: Array<{ userId: string; displayName: string; rank: number }>
    }
    expect(body.standings.map((row) => row.rank)).toEqual([1, 2, 3])
    expect(body.standings[0].userId).not.toBe(ada.userId)
    expect(body.standings[0].displayName).toMatch(/^Singer-/)
  })

  it('stops at as many as the list can show', async () => {
    const insert = sqlite.prepare(
      'INSERT INTO userBlocks (blockerId, blockedId, createdAt) VALUES (?, ?, ?)',
    )
    for (let index = 0; index < 500; index += 1) {
      insert.run(ada.userId, `gone-${index}`, NOW)
    }
    expect((await block(ada, ben)).status).toBe(409)
    sqlite.prepare("DELETE FROM userBlocks WHERE blockedId = 'gone-0'").run()
    expect((await block(ada, ben)).status).toBe(201)
  })

  it('answers a malformed body with 400, not a crash', async () => {
    const nothing = await authed(ada, '/api/blocks', {
      method: 'POST',
      body: 'null',
    })
    expect(nothing.status).toBe(400)
  })

  it('is for registered accounts, and never of yourself or nobody', async () => {
    const device = await anonymous('00000000-0000-4000-8000-0000000000aa')
    expect((await block(device, ada)).status).toBe(403)
    expect((await block(ada, ada)).status).toBe(400)
    expect(
      (await post(ada, '/api/blocks', { userId: 'nobody-at-all' })).status,
    ).toBe(404)
    expect((await post(ada, '/api/blocks', {})).status).toBe(400)
  })
})

describe('a report', () => {
  let ada: Account
  let ben: Account
  let cleo: Account

  beforeEach(async () => {
    freshDatabase()
    ada = await register('Ada Singer')
    ben = await register('Ben Singer')
    cleo = await register('Cleo Singer')
  })

  it('is taken once per reporter and target while it is open', async () => {
    const melody = await sharedId(ada, 'Ada Tune')
    const report = {
      targetKind: 'melody',
      targetId: melody,
      reason: 'offensive',
      note: '  The title  ',
    }
    const first = await post(ben, '/api/reports', report)
    expect(first.status).toBe(201)
    const again = await post(ben, '/api/reports', report)
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ status: 'open' })

    expect(
      sqlite
        .prepare(
          'SELECT reporterId, targetUserId, reason, note, status FROM contentReports',
        )
        .all(),
    ).toEqual([
      {
        reporterId: ben.userId,
        targetUserId: ada.userId,
        reason: 'offensive',
        note: 'The title',
        status: 'open',
      },
    ])
  })

  it('is refused for a private share, yourself, an unknown reason, or no account', async () => {
    const hidden = await shareMelody(ada, 'Ada Draft', { isPublic: false })
    expect(hidden.status).toBe(201)
    const hiddenId = ((await hidden.json()) as { id: string }).id
    const shown = await sharedId(ada, 'Ada Tune')
    const device = await anonymous('00000000-0000-4000-8000-0000000000bb')

    const about = (targetId: string, reason = 'spam') => ({
      targetKind: 'melody',
      targetId,
      reason,
    })
    expect((await post(ben, '/api/reports', about(hiddenId))).status).toBe(404)
    expect((await post(ada, '/api/reports', about(shown))).status).toBe(400)
    expect(
      (await post(ben, '/api/reports', about(shown, 'bored'))).status,
    ).toBe(400)
    expect((await post(device, '/api/reports', about(shown))).status).toBe(403)
    expect(
      (
        await post(ben, '/api/reports', {
          targetKind: 'user',
          targetId: ada.userId,
          reason: 'abuse',
          note: 'x'.repeat(501),
        })
      ).status,
    ).toBe(400)
  })

  it('reaches the owner’s console, which answers every open report on the target at once', async () => {
    const melody = await sharedId(ada, 'Ada Tune')
    for (const reporter of [ben, cleo]) {
      expect(
        (
          await post(reporter, '/api/reports', {
            targetKind: 'melody',
            targetId: melody,
            reason: 'offensive',
          })
        ).status,
      ).toBe(201)
    }

    expect((await workerRequest('/api/admin/reports')).status).toBe(403)
    const listed = await admin('/api/admin/reports')
    expect(listed.status).toBe(200)
    const { reports } = (await listed.json()) as {
      reports: Array<{
        id: string
        targetTitle: string
        targetSinger: string
        openOnTarget: number
      }>
    }
    expect(reports).toHaveLength(2)
    expect(reports[0]).toMatchObject({
      targetTitle: 'Ada Tune',
      targetSinger: 'Ada Singer',
      openOnTarget: 2,
    })

    const resolved = await admin(`/api/admin/reports/${reports[0].id}`, {
      method: 'POST',
      body: JSON.stringify({ status: 'dismissed' }),
    })
    expect(resolved.status).toBe(200)
    expect(await resolved.json()).toEqual({ status: 'dismissed', resolved: 2 })
    expect(
      rowCount(
        "SELECT COUNT(*) AS n FROM contentReports WHERE status = 'open'",
      ),
    ).toBe(0)
    expect(
      (
        await admin('/api/admin/reports/not-a-report', {
          method: 'POST',
          body: JSON.stringify({ status: 'dismissed' }),
        })
      ).status,
    ).toBe(404)
  })

  it('mails the owner once for a target, and again once it was answered', async () => {
    const sent: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      if (String(input).includes('api.resend.com')) {
        sent.push(String(init?.body ?? ''))
        return new Response(JSON.stringify({ id: 'mail' }), { status: 200 })
      }
      return realFetch(input, init)
    }) as typeof fetch
    env = {
      ...env,
      RESEND_API_KEY: 'test-key',
      BILLING_ALERT_EMAIL: 'owner@example.com',
    }
    try {
      const melody = await sharedId(ada, 'Ada Tune')
      const about = { targetKind: 'melody', targetId: melody, reason: 'spam' }
      const first = await post(ben, '/api/reports', about)
      await post(cleo, '/api/reports', about)
      expect(sent).toHaveLength(1)
      expect(sent[0]).toContain('[MercuryPitch report]')
      expect(sent[0]).toContain('Ada Tune')

      const { id } = (await first.json()) as { id: string }
      await admin(`/api/admin/reports/${id}`, {
        method: 'POST',
        body: JSON.stringify({ status: 'dismissed' }),
      })
      await post(ben, '/api/reports', about)
      expect(sent).toHaveLength(2)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('answers malformed admin input with 400, not a crash', async () => {
    const melody = await sharedId(ada, 'Ada Tune')
    const reported = await post(ben, '/api/reports', {
      targetKind: 'melody',
      targetId: melody,
      reason: 'spam',
    })
    const { id } = (await reported.json()) as { id: string }
    expect(
      (
        await admin(`/api/admin/reports/${id}`, {
          method: 'POST',
          body: 'null',
        })
      ).status,
    ).toBe(400)
    expect(
      (await admin('/api/admin/shares/constructor/x', { method: 'DELETE' }))
        .status,
    ).toBe(400)
    expect((await admin('/api/admin/name-audit?kind=constructor')).status).toBe(
      400,
    )
  })

  it('can end in a takedown, which answers the reports as actioned', async () => {
    const melody = await sharedId(ada, 'Ada Tune')
    await post(ben, '/api/reports', {
      targetKind: 'melody',
      targetId: melody,
      reason: 'sexual',
    })

    const takedown = await admin(`/api/admin/shares/melody/${melody}`, {
      method: 'DELETE',
    })
    expect(takedown.status).toBe(200)
    expect(await takedown.json()).toEqual({ removed: true, resolved: 1 })
    expect(await melodyNames(cleo)).toEqual([])
    expect(
      rowCount(
        "SELECT COUNT(*) AS n FROM contentReports WHERE status = 'actioned'",
      ),
    ).toBe(1)
    expect(
      (await admin(`/api/admin/shares/melody/${melody}`, { method: 'DELETE' }))
        .status,
    ).toBe(404)
  })
})

describe('a suspended singer', () => {
  it('has their shares hidden from every list and link', async () => {
    freshDatabase()
    const ada = await register('Ada Singer')
    const ben = await register('Ben Singer')
    const melody = await sharedId(ada, 'Ada Tune')

    const suspended = await admin('/api/admin/user-suspension', {
      method: 'POST',
      body: JSON.stringify({
        userId: ada.userId,
        suspended: true,
        reason: 'Posted abuse under a share',
      }),
    })
    expect(suspended.status).toBe(200)

    expect(await melodyNames(ben)).toEqual([])
    expect(await melodyNames(null)).toEqual([])
    expect((await authed(ben, `/api/sharedMelodies/${melody}`)).status).toBe(
      404,
    )
  })
})

describe('the names other singers read', () => {
  let ada: Account

  beforeEach(async () => {
    freshDatabase()
    ada = await register('Ada Singer')
  })

  it('refuses a crude display name, on the profile and at sign-up', async () => {
    const crude = await authed(ada, `/api/userProfiles/${ada.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Fuckface' }),
    })
    expect(crude.status).toBe(400)
    expect(await crude.json()).toEqual({
      error: 'displayName uses a word that is not allowed',
    })
    const fine = await authed(ada, `/api/userProfiles/${ada.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Ada Lovelace' }),
    })
    expect(fine.status).toBe(200)

    const signUp = await workerRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'crude@example.com',
        password: 'secret123',
        displayName: 'sh1t singer',
      }),
    })
    expect(signUp.status).toBe(400)
    expect(await signUp.json()).toEqual({
      error: 'Choose another display name',
      code: 'display_name_refused',
    })
  })

  it('posts a share under the singer’s own name, kept current', async () => {
    const response = await shareMelody(ada, 'Ada Tune', {
      author: 'MercuryPitch Team',
    })
    expect(response.status).toBe(201)
    const stored = sqlite
      .prepare('SELECT author FROM sharedMelodies')
      .get() as { author: string }
    expect(stored.author).toBe('Ada Singer')

    await authed(ada, `/api/userProfiles/${ada.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Ada Lovelace' }),
    })
    expect((await publicMelodies(null)).map((row) => row.author)).toEqual([
      'Ada Lovelace',
    ])
  })

  it('refuses a crude title, and a slur in the lyrics, but not a crude lyric', async () => {
    expect((await shareMelody(ada, 'Bitch Please')).status).toBe(400)
    expect(
      (await shareMelody(ada, 'Night Song', { lyrics: ['you', 'n1gger'] }))
        .status,
    ).toBe(400)
    expect(
      (
        await shareMelody(ada, 'Night Song', {
          lyrics: ['what', 'the', 'fuck'],
        })
      ).status,
    ).toBe(201)
  })

  it('reads lyrics sent as an array as closely as lyrics sent as text', async () => {
    const response = await post(ada, '/api/sharedMelodies', {
      melodyId: '',
      melodyName: 'Night Song',
      tags: [],
      itemsJson: [
        { id: 1, lyricText: 'you' },
        { id: 2, lyricText: 'n1gger' },
      ],
      isPublic: true,
    })
    expect(response.status).toBe(400)
  })

  it('never filters or sorts shares by the stored author, which nobody is shown', async () => {
    await shareMelody(ada, 'Ada Tune')
    const reader = await register('Ben Singer')
    expect(
      (await authed(reader, '/api/sharedMelodies?where[author]=Ada%20Singer'))
        .status,
    ).toBe(400)
    expect(
      (await authed(reader, '/api/sharedMelodies?orderBy=author')).status,
    ).toBe(400)
  })

  it('lists rows written before the filter for the owner, once', async () => {
    sqlite
      .prepare('UPDATE userProfiles SET displayName = ? WHERE id = ?')
      .run('Big Ass Singer', ada.userId)
    const response = await admin('/api/admin/name-audit?kind=profiles')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      kind: 'profiles',
      scanned: 1,
      hits: [
        {
          id: ada.userId,
          userId: ada.userId,
          field: 'displayName',
          problem: 'words',
          text: 'Big Ass Singer',
        },
      ],
      next: null,
    })
  })
})

describe('account deletion', () => {
  it('erases the singer’s blocks and the reports about them, and keeps their open reports unsigned', async () => {
    freshDatabase()
    const ada = await register('Ada Singer')
    const ben = await register('Ben Singer')
    const cleo = await register('Cleo Singer')
    await block(ada, ben)
    await block(cleo, ada)
    await post(ada, '/api/reports', {
      targetKind: 'user',
      targetId: ben.userId,
      reason: 'abuse',
    })
    await post(cleo, '/api/reports', {
      targetKind: 'user',
      targetId: ada.userId,
      reason: 'spam',
    })
    await post(ben, '/api/reports', {
      targetKind: 'user',
      targetId: cleo.userId,
      reason: 'spam',
    })

    const deleted = await authed(ada, '/api/auth/me', { method: 'DELETE' })
    expect(deleted.status).toBe(200)

    expect(rowCount('SELECT COUNT(*) AS n FROM userBlocks')).toBe(0)
    const left = sqlite
      .prepare(
        'SELECT id, reporterId, targetUserId FROM contentReports ORDER BY targetUserId = ? DESC',
      )
      .all(ben.userId) as Array<{
      id: string
      reporterId: string
      targetUserId: string
    }>
    expect(left).toHaveLength(2)
    expect(left[0]).toEqual({
      id: left[0].id,
      reporterId: `erased:${left[0].id}`,
      targetUserId: ben.userId,
    })
    expect(left[1]).toMatchObject({
      reporterId: ben.userId,
      targetUserId: cleo.userId,
    })
  })
})
