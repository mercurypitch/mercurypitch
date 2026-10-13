// @vitest-environment node
// ============================================================
// Challenge progress through the real client, after a read that found nothing
// ============================================================
//
// An anonymous web singer's token lives thirty days, and nothing on the web
// renews it. Once it lapses, a read of a private table resolves [] without a
// request, and the next write provisions the SAME identity again (the worker
// keys /api/auth/anonymous on the device id). So the first challenge attempt
// after the lapse computes its outcome from no previous progress and saves it
// as a create, and that create meets the row the account already has.
//
// This drives the real challenges-service, HybridAdapter and ServerAdapter
// against the real worker and SQLite. Only the composition root (`getDb`) and
// the stored identity (`getUserId`) are replaced, both at the browser edge.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { DatabaseAdapter } from '../../../src/db/types'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const state = vi.hoisted(() => ({
  db: null as unknown,
  userId: '',
  token: '',
  tokenValid: false,
}))

vi.mock('@/db', () => ({ getDb: async () => state.db }))
vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserId: () => state.userId,
}))

interface Progress {
  id: string
  userId: string
  challengeId: string
  progress: number
  currentScore: number
  bestScore: number
  status: 'locked' | 'active' | 'completed'
  completed: boolean
  completedAt?: string | null
  attempts: number
}

// Loaded through Vitest's module loader, as client-api-integration does:
// importing their implementation types into the worker-only TS program would
// pull in the DOM app.
const { ServerAdapter } = await vi.importActual<{
  ServerAdapter: new (config: {
    baseUrl: string
    headers: () => Record<string, string>
    writeIdentity: () => string
  }) => DatabaseAdapter
}>('../../../src/db/adapters/server-adapter')
const { HybridAdapter } = await vi.importActual<{
  HybridAdapter: new (
    cloud: DatabaseAdapter,
    local: DatabaseAdapter,
    isAuthed: () => boolean,
    ensureAuthed: () => Promise<boolean>,
    currentIdentity: () => string,
  ) => DatabaseAdapter
}>('../../../src/db/adapters/hybrid-adapter')
const { loadChallengeProgress, saveChallengeProgress } = await vi.importActual<{
  loadChallengeProgress: (expectedUserId?: string) => Promise<Progress[]>
  saveChallengeProgress: (
    progress: Omit<Progress, 'id'>,
    expectedUserId?: string,
  ) => Promise<Progress | null>
}>('../../../src/db/services/challenges-service')
const { computeAttemptOutcome } = await vi.importActual<{
  computeAttemptOutcome: (
    prev: Pick<Progress, 'attempts' | 'bestScore' | 'completed'> | null,
    score: number,
    targetScore: number,
  ) => {
    attempts: number
    bestScore: number
    progress: number
    status: 'active' | 'completed'
    completed: boolean
    newlyCompleted: boolean
  }
}>('../../../src/features/challenges/challenge-attempt')

const ORIGIN = 'https://api.test'
const DEVICE = '00000000-0000-4000-8000-00000000e002'
const COMPLETED_AT = '2026-09-01T10:00:00.000Z'
let sqlite: DatabaseSync
let env: Env

async function provision(): Promise<boolean> {
  const response = await worker.fetch(
    new Request(`${ORIGIN}/api/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: DEVICE,
        deviceSecret: `device-secret-${DEVICE.replace(/-/g, '')}`,
      }),
    }),
    env,
    {} as ExecutionContext,
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as { token: string; userId: string }
  expect(body.userId).toBe(DEVICE)
  state.token = body.token
  state.tokenValid = true
  return true
}

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'challenge-progress-client-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      // This bridge must never send an auth token or request to a real server.
      expect(new URL(request.url).origin).toBe(ORIGIN)
      return worker.fetch(request, env, {} as ExecutionContext)
    },
  )
  state.userId = DEVICE
  const cloud = new ServerAdapter({
    baseUrl: ORIGIN,
    headers: (): Record<string, string> =>
      state.token === '' ? {} : { Authorization: `Bearer ${state.token}` },
    writeIdentity: () => state.userId,
  })
  const local: DatabaseAdapter = {
    schemaVersion: 1,
    getRepository: () => {
      throw new Error('challengeProgress must not fall through to local')
    },
    transaction: async () => {
      throw new Error('No local transaction should run')
    },
    destroy: async () => undefined,
  }
  state.db = new HybridAdapter(
    cloud,
    local,
    () => state.tokenValid,
    provision,
    () => state.userId,
  )
  await provision()
})

afterEach(() => {
  vi.unstubAllGlobals()
  sqlite.close()
})

/** What recordChallengeAttempt saves for one run, from what its read found. */
async function attempt(score: number, targetScore: number) {
  const seen = await loadChallengeProgress(DEVICE)
  const prev = seen.find((p) => p.challengeId === 'hold-a5') ?? null
  const outcome = computeAttemptOutcome(prev, score, targetScore)
  const saved = await saveChallengeProgress(
    {
      userId: DEVICE,
      challengeId: 'hold-a5',
      progress: outcome.progress,
      currentScore: score,
      bestScore: outcome.bestScore,
      status: outcome.status,
      completed: outcome.completed,
      attempts: outcome.attempts,
      ...(outcome.newlyCompleted ? { completedAt: COMPLETED_AT } : {}),
    },
    DEVICE,
  )
  return { seen, saved }
}

it('keeps a completed challenge completed when a lapsed token makes the next attempt start from nothing', async () => {
  // Weeks ago: four attempts, the last one completed it with 95.
  for (const score of [50, 60, 70, 95]) await attempt(score, 80)

  // Thirty days later the token has lapsed; nothing renews it on the web.
  state.tokenValid = false
  const { seen, saved } = await attempt(40, 80)

  // The attempt really did start from nothing, and still saved.
  expect(seen).toEqual([])
  expect(state.tokenValid).toBe(true)
  // recordChallengeAttempt reads `saved.completed` as the persisted verdict.
  expect(saved).toMatchObject({ completed: true, bestScore: 95, attempts: 4 })
  // What the Challenges screen picks: the row for this challenge.
  const shown = (await loadChallengeProgress(DEVICE)).filter(
    (p) => p.challengeId === 'hold-a5',
  )
  expect(shown).toHaveLength(1)
  expect(shown[0]).toMatchObject({
    completed: true,
    status: 'completed',
    completedAt: COMPLETED_AT,
    bestScore: 95,
    progress: 95,
    attempts: 4,
    currentScore: 40,
  })
})
