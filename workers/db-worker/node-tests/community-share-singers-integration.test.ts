// @vitest-environment node
//
// ── A share names its poster by id (REQ-RB-042) ──────────────────────
//
// The phone's Community (slice 4c of docs/plans/native-more-and-community.md)
// offers Report and Block on every share another singer posted: a report
// that names the share, a block of the singer behind it. Both are made from
// what the public reads send, so those reads must carry the poster's own
// account id beside their name, to anyone who reads them, signed in or not.
// Real accounts, registered through the real route, on every migration in
// order; the report and the block go through their real routes too.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

let sqlite: DatabaseSync
let env: Env

interface Account {
  userId: string
  token: string
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function as(account: Account, path: string, body?: unknown) {
  return request(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${account.token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

async function register(displayName: string): Promise<Account> {
  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${displayName.toLowerCase().replace(/\s+/g, '-')}@example.com`,
      password: 'secret123',
      displayName,
    }),
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Account
}

async function created(response: Promise<Response>): Promise<string> {
  const answer = await response
  expect(answer.status).toBe(201)
  return ((await answer.json()) as { id: string }).id
}

type Row = Record<string, unknown>

async function rows(path: string, reader: Account | null): Promise<Row[]> {
  const response =
    reader === null ? await request(path) : await as(reader, path)
  expect(response.status).toBe(200)
  return (await response.json()) as Row[]
}

const MELODIES = '/api/sharedMelodies?where[isPublic]=true&orderBy=createdAt'
const RESULTS = '/api/sharedSessions?where[isPublic]=true&orderBy=createdAt'

let ada: Account
let ben: Account
let melodyId: string
let resultId: string

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'community-share-singers-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
  ada = await register('Ada Singer')
  ben = await register('Ben Singer')
  melodyId = await created(
    as(ada, '/api/sharedMelodies', {
      melodyId: '',
      melodyName: 'Ada Tune',
      author: 'Someone Else',
      tags: [],
      itemsJson: '[]',
      isPublic: true,
    }),
  )
  resultId = await created(
    as(ada, '/api/sharedSessions', {
      sessionId: '',
      sessionName: 'Ada Run',
      author: 'Someone Else',
      score: 80,
      accuracy: 0,
      resultsJson: '[80]',
      isPublic: true,
    }),
  )
})

afterEach(() => sqlite.close())

describe('a public share', () => {
  it('names its poster by their own id and their name, to a reader signed in or not', async () => {
    for (const reader of [null, ben]) {
      for (const path of [MELODIES, RESULTS]) {
        expect(
          (await rows(path, reader)).map((row) => [row.userId, row.author]),
        ).toEqual([[ada.userId, 'Ada Singer']])
      }
      for (const path of [
        `/api/sharedMelodies/${melodyId}`,
        `/api/sharedSessions/${resultId}`,
      ]) {
        const byId = await (reader === null ? request(path) : as(reader, path))
        expect(byId.status).toBe(200)
        const row = (await byId.json()) as Row
        expect([row.userId, row.author], path).toEqual([
          ada.userId,
          'Ada Singer',
        ])
      }
    }
  })

  it('carries nothing of its poster beyond the id and the name', async () => {
    const melody = [
      'author',
      'createdAt',
      'id',
      'isPublic',
      'itemsJson',
      'melodyId',
      'melodyName',
      'tags',
      'updatedAt',
      'userId',
    ]
    const result = [
      'accuracy',
      'author',
      'createdAt',
      'id',
      'isPublic',
      'resultsJson',
      'score',
      'sessionId',
      'sessionName',
      'updatedAt',
      'userId',
    ]
    for (const [path, keys] of [
      [MELODIES, melody],
      [`/api/sharedMelodies/${melodyId}`, melody],
      [RESULTS, result],
      [`/api/sharedSessions/${resultId}`, result],
    ] as const) {
      const body = (await (await request(path)).json()) as Row | Row[]
      const share = Array.isArray(body) ? body[0] : body
      expect(Object.keys(share ?? {}).sort(), path).toEqual([...keys].sort())
      expect(JSON.stringify(share), path).not.toContain('@example.com')
    }
  })

  it('is reported by its id, and its poster blocked by the id it carries', async () => {
    const [melody] = await rows(MELODIES, ben)
    const [result] = await rows(RESULTS, ben)

    for (const [targetKind, row] of [
      ['melody', melody],
      ['session', result],
    ] as const) {
      const report = await as(ben, '/api/reports', {
        targetKind,
        targetId: row?.id,
        reason: 'spam',
      })
      expect(report.status).toBe(201)
    }
    expect(
      (await as(ben, '/api/blocks', { userId: melody?.userId })).status,
    ).toBe(201)

    expect(await rows(MELODIES, ben)).toEqual([])
    expect(await rows(RESULTS, ben)).toEqual([])
    expect(melody?.id).toBe(melodyId)
    expect(result?.id).toBe(resultId)
  })
})
