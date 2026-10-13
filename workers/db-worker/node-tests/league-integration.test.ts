// @vitest-environment node
//
// ── The weekly league, across more than one week ─────────────────────
//
// A defect that only shows once the cron has run more than once, which is
// why the pure cut tests in src/tests/league-cut.test.ts never saw it.
//
// The cut: each run cuts the weeks before the current one and stores the
// current week as its watermark. The next run asked for weeks strictly AFTER
// that watermark, so the week it named — still running when it was stored,
// finished now — was never cut, and neither was any week after the first.
// The ladder moved exactly once, ever, and logged nothing.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

// 2030-01-07 is a Monday.
const WEEK_1 = '2030-01-07'
const WEEK_2 = '2030-01-14'
const WEEK_3 = '2030-01-21'
const WEEK_4 = '2030-01-28'

let sqlite: DatabaseSync
let env: Env

interface Account {
  userId: string
  token: string
}

function call(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    {} as ExecutionContext,
  )
}

function at(day: string, time = '10:00:00'): void {
  vi.setSystemTime(new Date(`${day}T${time}.000Z`))
}

async function register(name: string): Promise<Account> {
  const response = await call('POST', '/api/auth/register', {
    email: `${name.toLowerCase().replace(/\s+/g, '-')}@example.com`,
    password: 'secret123',
    displayName: name,
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Account
}

/** A scored exercise run: the league's points source. */
async function practice(account: Account): Promise<void> {
  const now = new Date().toISOString()
  const response = await call(
    'POST',
    '/api/sessionRecords',
    {
      melodyName: 'Scale',
      source: 'exercise',
      startedAt: now,
      endedAt: now,
      score: 90,
      accuracy: 90,
      notesHit: 9,
      notesTotal: 10,
      streak: 1,
      results: [],
    },
    account.token,
  )
  expect(response.status).toBe(201)
}

/** The cron, as the scheduled handler runs it. */
async function cron(): Promise<void> {
  await worker.scheduled({} as ScheduledController, env, {} as ExecutionContext)
}

function rung(account: Account): unknown {
  return (
    sqlite
      .prepare('SELECT currentLeagueId FROM userProfiles WHERE id = ?')
      .get(account.userId) as { currentLeagueId: string }
  ).currentLeagueId
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at(WEEK_1)
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'league-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
})

afterEach(() => {
  vi.useRealTimers()
  sqlite.close()
})

describe('the weekly cut', () => {
  it('cuts every finished week, not only the first', async () => {
    const ada = await register('Ada')
    const bo = await register('Bo')

    await practice(ada)
    at(WEEK_2, '06:00:00')
    await cron()
    expect(rung(ada)).toBe('l2')
    expect(rung(bo)).toBe('l1')

    // Week 2: each is the only active member of their cohort.
    at(WEEK_2)
    await practice(ada)
    await practice(bo)

    at(WEEK_3, '06:00:00')
    await cron()
    expect(rung(ada)).toBe('l3')
    expect(rung(bo)).toBe('l2')
  })

  it('still cuts each week only once, however often the cron runs', async () => {
    const ada = await register('Ada')
    await practice(ada)

    at(WEEK_2, '06:00:00')
    await cron()
    at(WEEK_2, '12:00:00')
    await cron()
    expect(rung(ada)).toBe('l2')

    // Nothing happened in week 2, so week 3's runs have nothing to move.
    at(WEEK_3, '06:00:00')
    await cron()
    at(WEEK_4, '06:00:00')
    await cron()
    expect(rung(ada)).toBe('l2')
  })
})
