// @vitest-environment node
//
// ── The anonymous credential is no longer printed on the leaderboard ─
//
// The defect: an anonymous account's id IS the client's deviceId, that id is
// published (userProfiles.publicCols includes 'id', and every leaderboard row
// carries userId), and the id was the whole credential. Two escalations
// followed from one harvested value:
//
//   session takeover   POST /api/auth/anonymous {deviceId} → a valid JWT
//   permanent takeover POST /api/auth/register {email, password, deviceId}
//                      → the row becomes the attacker's, owner locked out
//
// `harvestUserId` below reads the public board with no Authorization header at
// all — that is the attacker's whole reconnaissance step, and it still works,
// because the id is meant to be public. What must not work is using it.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigration, applyMigrations, SqliteD1Database } from './sqlite-d1'

const SECRET_MIGRATION = '0029_device_secret.sql'
const NOW = '2026-08-09T12:00:00.000Z'

const VICTIM_DEVICE = '00000000-0000-4000-8000-0000000000d1'
const OTHER_DEVICE = '00000000-0000-4000-8000-0000000000d2'
const VICTIM_SECRET = 'zt4Vv9Qk2Lm7Xr0Bc5Nh8Jf3Wp6Ys1Ad4Ge7Ku0Mq2'
const ATTACKER_SECRET = 'aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4'

let sqlite: DatabaseSync
let env: Env

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function postJson(path: string, body: unknown): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function seedSession(id: string, userId: string, score: number): void {
  sqlite
    .prepare(
      `INSERT INTO sessionRecords
         (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
          score, accuracy, notesHit, notesTotal, streak, results, source)
       VALUES (?, ?, ?, ?, 'Legend: Harvest', ?, ?, ?, ?, 9, 10, 5, '{}',
               'exercise')`,
    )
    .run(id, NOW, NOW, userId, NOW, NOW, score, score)
}

/**
 * The attacker's reconnaissance, unchanged by the fix: read the public board,
 * no token, and take an id straight out of it.
 */
async function harvestUserId(): Promise<string> {
  const response = await workerRequest(
    '/api/leaderboard?category=overall&period=all-time&view=global',
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as {
    entries: Array<{ userId: string }>
  }
  expect(body.entries.length).toBeGreaterThan(0)
  return body.entries[0].userId
}

function authProviderOf(id: string): string | undefined {
  return (
    sqlite.prepare('SELECT authProvider FROM users WHERE id = ?').get(id) as
      | { authProvider: string }
      | undefined
  )?.authProvider
}

function secretHashOf(id: string): string | null | undefined {
  return (
    sqlite
      .prepare('SELECT deviceSecretHash FROM users WHERE id = ?')
      .get(id) as { deviceSecretHash: string | null } | undefined
  )?.deviceSecretHash
}

function freshDatabase(): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'device-secret-integration-secret',
    // These harnesses register real accounts, and registration now passes
    // through the Turnstile gate. A local origin with no TURNSTILE_SECRET is
    // the one configuration the gate lets by, and it is what a developer
    // running the worker locally has — so it is what these simulate.
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY: 'device-secret-test-admin',
  }
}

/** Sign in anonymously the way the current client does. */
function anonymous(deviceId: string, deviceSecret?: string): Promise<Response> {
  return postJson('/api/auth/anonymous', { deviceId, deviceSecret })
}

describe('an id off the leaderboard is not a credential', () => {
  beforeEach(async () => {
    freshDatabase()
    // The victim is a singer who has practised and appears on the board.
    const created = await anonymous(VICTIM_DEVICE, VICTIM_SECRET)
    expect(created.status).toBe(200)
    seedSession('victim-run', VICTIM_DEVICE, 88)
    sqlite
      .prepare(
        `UPDATE userProfiles SET leaderboardOptIn = 1, currentStreak = 9,
           longestStreak = 12 WHERE id = ?`,
      )
      .run(VICTIM_DEVICE)
  })

  afterEach(() => {
    sqlite.close()
  })

  it('still publishes the id — that part was never the bug', async () => {
    // The id is a join key for sessionRecords, follows, shares and profiles.
    // Hiding it would orphan all of them; the fix is that it stops being
    // sufficient, not that it stops being visible.
    expect(await harvestUserId()).toBe(VICTIM_DEVICE)
  })

  it('refuses a session to whoever replays that id', async () => {
    // THE REGRESSION. Pre-fix this returned 200 and a 30-day JWT.
    const harvested = await harvestUserId()

    expect((await anonymous(harvested)).status).toBe(403)
    expect((await anonymous(harvested, ATTACKER_SECRET)).status).toBe(403)
  })

  it('refuses to let a replay register over the account', async () => {
    // The worse half: this rewrote authProvider, email and passwordHash on the
    // victim's row and bumped tokenVersion, evicting them permanently.
    const harvested = await harvestUserId()

    const stolen = await postJson('/api/auth/register', {
      email: 'attacker@example.com',
      password: 'Attacker123!pass',
      deviceId: harvested,
      deviceSecret: ATTACKER_SECRET,
    })
    expect(stolen.status).toBe(403)

    expect(authProviderOf(VICTIM_DEVICE)).toBe('anonymous')
    expect(
      sqlite.prepare('SELECT email FROM users WHERE id = ?').get(VICTIM_DEVICE),
    ).toEqual({ email: null })
    // A registration that cannot claim the device must not silently become a
    // brand-new account either — the caller asked for one specific thing.
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) n FROM users WHERE email = 'attacker@example.com'",
        )
        .get()?.n,
    ).toBe(0)
  })

  it('refuses to let a replay take the account over with Google', async () => {
    // No GOOGLE_CLIENT_ID here, so the POST endpoint is 501 — but the redirect
    // start is what the app actually uses, and it must not sign the victim's
    // deviceId into a state that the callback would then act on.
    env.GOOGLE_CLIENT_ID = 'test-client'
    env.GOOGLE_CLIENT_SECRET = 'test-secret'
    const harvested = await harvestUserId()

    const started = await postJson('/api/auth/google/start', {
      deviceId: harvested,
      deviceSecret: ATTACKER_SECRET,
      returnTo: 'http://localhost:3000/',
    })
    expect(started.status).toBe(200)
    const { url } = (await started.json()) as { url: string }
    const state = new URL(url).searchParams.get('state') as string
    const claim = JSON.parse(
      Buffer.from(state.split('.')[0], 'base64url').toString(),
    ) as { deviceId?: string }

    // Dropped, not signed. Sign-in still completes — it just creates a fresh
    // account rather than absorbing the victim's.
    expect(claim.deviceId).toBeUndefined()
  })

  it('lets the real device back in, and only it', async () => {
    const mine = await anonymous(VICTIM_DEVICE, VICTIM_SECRET)
    expect(mine.status).toBe(200)
    await expect(mine.json()).resolves.toMatchObject({
      userId: VICTIM_DEVICE,
      isNew: false,
    })
  })

  it('lets the real device upgrade to a password account', async () => {
    const upgraded = await postJson('/api/auth/register', {
      email: 'victim@example.com',
      password: 'Victim123!pass',
      deviceId: VICTIM_DEVICE,
      deviceSecret: VICTIM_SECRET,
    })
    expect(upgraded.status).toBe(200)
    await expect(upgraded.json()).resolves.toMatchObject({
      userId: VICTIM_DEVICE,
    })
    expect(authProviderOf(VICTIM_DEVICE)).toBe('password')
    // The practice history stayed attached to the same id — the entire reason
    // the in-place upgrade exists.
    expect(
      sqlite
        .prepare('SELECT COUNT(*) n FROM sessionRecords WHERE userId = ?')
        .get(VICTIM_DEVICE)?.n,
    ).toBe(1)
  })

  it('signs the real device into the Google redirect', async () => {
    env.GOOGLE_CLIENT_ID = 'test-client'
    env.GOOGLE_CLIENT_SECRET = 'test-secret'

    const started = await postJson('/api/auth/google/start', {
      deviceId: VICTIM_DEVICE,
      deviceSecret: VICTIM_SECRET,
      returnTo: 'http://localhost:3000/',
    })
    const { url } = (await started.json()) as { url: string }
    const state = new URL(url).searchParams.get('state') as string
    const claim = JSON.parse(
      Buffer.from(state.split('.')[0], 'base64url').toString(),
    ) as { deviceId?: string; returnTo: string }

    expect(claim.deviceId).toBe(VICTIM_DEVICE)
    expect(claim.returnTo).toBe('http://localhost:3000/')
  })

  it('leaves an account that is no longer anonymous alone', async () => {
    // After upgrading, the browser still holds the same deviceId and still
    // sends it. A password account is not claimable by presenting a device
    // secret, and nothing may be written to it on the way to finding that out.
    env.GOOGLE_CLIENT_ID = 'test-client'
    env.GOOGLE_CLIENT_SECRET = 'test-secret'
    sqlite
      .prepare(
        "UPDATE users SET authProvider = 'password', email = 'v@example.com' WHERE id = ?",
      )
      .run(VICTIM_DEVICE)
    sqlite
      .prepare('UPDATE users SET deviceSecretHash = NULL WHERE id = ?')
      .run(VICTIM_DEVICE)

    const started = await postJson('/api/auth/google/start', {
      deviceId: VICTIM_DEVICE,
      deviceSecret: ATTACKER_SECRET,
      returnTo: 'http://localhost:3000/',
    })
    expect(started.status).toBe(200)
    const { url } = (await started.json()) as { url: string }
    const state = new URL(url).searchParams.get('state') as string
    const claim = JSON.parse(
      Buffer.from(state.split('.')[0], 'base64url').toString(),
    ) as { deviceId?: string }

    expect(claim.deviceId).toBeUndefined()
    expect(secretHashOf(VICTIM_DEVICE)).toBeNull()
  })

  it('shrugs off a deviceId for an account that does not exist', async () => {
    env.GOOGLE_CLIENT_ID = 'test-client'
    env.GOOGLE_CLIENT_SECRET = 'test-secret'

    const started = await postJson('/api/auth/google/start', {
      deviceId: '00000000-0000-4000-8000-0000000009ff',
      deviceSecret: ATTACKER_SECRET,
      returnTo: 'http://localhost:3000/',
    })
    expect(started.status).toBe(200)
    const { url } = (await started.json()) as { url: string }
    const state = new URL(url).searchParams.get('state') as string
    expect(
      (
        JSON.parse(
          Buffer.from(state.split('.')[0], 'base64url').toString(),
        ) as { deviceId?: string }
      ).deviceId,
    ).toBeUndefined()
  })

  it('stores only a hash, never the secret', async () => {
    const stored = secretHashOf(VICTIM_DEVICE)
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
    expect(stored).not.toBe(VICTIM_SECRET)
    expect(
      sqlite
        .prepare('SELECT COUNT(*) n FROM users WHERE deviceSecretHash = ?')
        .get(VICTIM_SECRET)?.n,
    ).toBe(0)
  })

  it('rejects a secret that is not one', async () => {
    // Short, empty or punctuation-bearing values are not CSPRNG output. They
    // are treated as absent rather than bound, so a client bug cannot lock an
    // account to a guessable string.
    for (const bad of [
      '',
      'short',
      'has spaces in it and is long enough',
      'x'.repeat(200),
    ]) {
      const response = await anonymous(OTHER_DEVICE, bad)
      expect(response.status).toBe(200)
      expect(secretHashOf(OTHER_DEVICE)).toBeNull()
      sqlite.prepare('DELETE FROM users WHERE id = ?').run(OTHER_DEVICE)
      sqlite.prepare('DELETE FROM userProfiles WHERE id = ?').run(OTHER_DEVICE)
    }
  })
})

describe('accounts that predate the secret', () => {
  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec('PRAGMA foreign_keys = ON')
    applyMigrations(sqlite, SECRET_MIGRATION)
    // An anonymous singer created by the released build: no secret exists
    // anywhere, on the server or on their device.
    sqlite
      .prepare(
        `INSERT INTO users
           (id, createdAt, updatedAt, authProvider, providerId, email,
            emailVerified, passwordHash, lastLoginAt, tokenVersion)
         VALUES (?, ?, ?, 'anonymous', NULL, NULL, 0, NULL, ?, 1)`,
      )
      .run(VICTIM_DEVICE, NOW, NOW, NOW)
    sqlite
      .prepare(
        `INSERT INTO userProfiles (id, createdAt, updatedAt, displayName, joinDate)
         VALUES (?, ?, ?, 'Singer-0000', ?)`,
      )
      .run(VICTIM_DEVICE, NOW, NOW, NOW)
    applyMigration(sqlite, SECRET_MIGRATION)
    env = {
      DB: new SqliteD1Database(sqlite) as unknown as D1Database,
      JWT_SECRET: 'device-secret-integration-secret',
      // These harnesses register real accounts, and registration now passes
      // through the Turnstile gate. A local origin with no TURNSTILE_SECRET is
      // the one configuration the gate lets by, and it is what a developer
      // running the worker locally has — so it is what these simulate.
      ALLOWED_ORIGINS: 'http://localhost',
      ADMIN_KEY: 'device-secret-test-admin',
    }
  })

  afterEach(() => {
    sqlite.close()
  })

  it('leaves existing rows unbound rather than inventing a secret', () => {
    // Nothing could be back-filled: the secret only ever existed on a client,
    // and these accounts never had one.
    expect(secretHashOf(VICTIM_DEVICE)).toBeNull()
  })

  it('still lets them in, and binds the secret they bring', async () => {
    // The grandfather clause. A hard cutover would have signed every existing
    // anonymous singer out of their own practice history on deploy day.
    const first = await anonymous(VICTIM_DEVICE, VICTIM_SECRET)
    expect(first.status).toBe(200)
    expect(secretHashOf(VICTIM_DEVICE)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('closes the window as soon as it is used once', async () => {
    await anonymous(VICTIM_DEVICE, VICTIM_SECRET)

    expect((await anonymous(VICTIM_DEVICE)).status).toBe(403)
    expect((await anonymous(VICTIM_DEVICE, ATTACKER_SECRET)).status).toBe(403)
    expect((await anonymous(VICTIM_DEVICE, VICTIM_SECRET)).status).toBe(200)
  })

  it('admits an old client build that sends no secret at all', async () => {
    // A cached bundle from before this shipped. Refusing it would lock out the
    // very accounts the clause exists for; it simply stays unbound.
    const response = await anonymous(VICTIM_DEVICE)
    expect(response.status).toBe(200)
    expect(secretHashOf(VICTIM_DEVICE)).toBeNull()
  })

  it('is trust-on-first-use, and this is who wins the race', async () => {
    // Stated rather than hidden: whoever presents a secret first keeps the
    // account. That is the accepted cost of not evicting existing singers —
    // see docs/agent/BUGS.md.
    expect((await anonymous(VICTIM_DEVICE, ATTACKER_SECRET)).status).toBe(200)
    expect((await anonymous(VICTIM_DEVICE, VICTIM_SECRET)).status).toBe(403)
  })

  it('grandfathers the register upgrade the same way', async () => {
    const upgraded = await postJson('/api/auth/register', {
      email: 'legacy@example.com',
      password: 'Legacy123!pass',
      deviceId: VICTIM_DEVICE,
      deviceSecret: VICTIM_SECRET,
    })
    expect(upgraded.status).toBe(200)
    expect(authProviderOf(VICTIM_DEVICE)).toBe('password')
  })
})
