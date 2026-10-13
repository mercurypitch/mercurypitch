// @vitest-environment node
//
// ── One Encore a week, however many ask for it ───────────────────────
//
// When nothing is active or queued, the first GET /api/weekly/active of a
// week re-runs a closed evergreen challenge as an Encore. The check ("is
// anything active?") and the insert were separate statements, and the first
// loads after a rollover arrive together: the second request landing between
// them got a 500 (both picked the same slug), or, with more than one
// evergreen to pick from, inserted a SECOND active challenge, so singers were
// split between two weeks' boards.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, justBefore, SqliteD1Database } from './sqlite-d1'

let sqlite: DatabaseSync
let d1: SqliteD1Database
let env: Env

async function active(): Promise<{ status: number; body: any }> {
  const response = await worker.fetch(
    new Request('https://api.test/api/weekly/active'),
    env,
    {} as ExecutionContext,
  )
  return { status: response.status, body: await response.json() }
}

function seedClosedEvergreens(n: number): void {
  const insert = sqlite.prepare(
    `INSERT INTO weeklyChallenges (id, createdAt, updatedAt, slug, title,
       description, featType, difficulty, targetItems, startsAt, endsAt,
       evergreen, status, resultsJson)
     VALUES (?, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z', ?, ?,
       'd', 'sustain', 'beginner', '[]', '2025-01-06T00:00:00.000Z',
       '2025-01-13T00:00:00.000Z', 1, 'closed', NULL)`,
  )
  for (let i = 0; i < n; i++)
    insert.run(`ev-${i}`, `legend-${i}`, `Legend ${i}`)
}

function activeRows(): unknown[] {
  return sqlite
    .prepare("SELECT id FROM weeklyChallenges WHERE status = 'active'")
    .all()
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  d1 = new SqliteD1Database(sqlite)
  env = {
    DB: d1 as unknown as D1Database,
    JWT_SECRET: 'weekly-encore-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
})

afterEach(() => {
  sqlite.close()
})

describe('two first loads of a week with nothing active', () => {
  for (const evergreens of [1, 2]) {
    it(`agree on one Encore (${evergreens} to pick from)`, async () => {
      seedClosedEvergreens(evergreens)
      let second: { status: number; body: any } | undefined
      justBefore(d1, /INSERT INTO weeklyChallenges/, async () => {
        second = await active()
      })
      const first = await active()

      expect([first.status, second?.status]).toEqual([200, 200])
      expect(first.body.challenge?.id).toBeDefined()
      expect(first.body.challenge?.id).toBe(second?.body.challenge?.id)
      expect(activeRows()).toHaveLength(1)
    })
  }
})
