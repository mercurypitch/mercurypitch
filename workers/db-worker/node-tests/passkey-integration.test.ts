// @vitest-environment node
//
// ── The gates around a passkey ───────────────────────────────────────
//
// The WebAuthn ceremony needs a real authenticator, and forging an attestation
// here would exercise @simplewebauthn's CBOR rather than this worker. So what
// is pinned here is everything the worker decides BEFORE and AROUND that
// ceremony, driven through the real HTTP surface against real SQLite:
//
//   • an environment with no relying-party id refuses outright,
//   • the endpoints need a session, and a stale one needs a second proof,
//   • the credential cap is enforced before options are ever minted,
//   • listing and deletion are scoped to the account that asks,
//   • a counter that runs backwards is recorded as a possible clone,
//   • and deleting an account takes its credentials with it.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { listPasskeys, MAX_PASSKEYS_PER_USER, touchPasskey, } from '../src/passkeys'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const PASSWORD = 'Passkey123pass'
const RP_ID = 'localhost'

let sqlite: DatabaseSync
let env: Env

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function post(path: string, body: unknown, token?: string): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  })
}

async function register(
  email: string,
): Promise<{ token: string; userId: string }> {
  const response = await post('/api/auth/register', {
    email,
    password: PASSWORD,
    displayName: 'Passkey Singer',
  })
  expect(response.status).toBe(200)
  return (await response.json()) as { token: string; userId: string }
}

/** Write a credential straight in — the ceremony that would mint one needs
 *  an authenticator, and none of these tests are about the ceremony. */
function seedPasskey(userId: string, id: string, counter = 0): void {
  sqlite
    .prepare(
      `INSERT INTO webauthnCredentials
         (id, userId, publicKey, counter, deviceName, backedUp, createdAt)
       VALUES (?, ?, 'AAAA', ?, 'Passkey on iPhone', 1, datetime('now'))`,
    )
    .run(id, userId, counter)
}

/** Push a session's createdAt into the past, out of the sudo window. */
function ageSession(userId: string): void {
  sqlite
    .prepare(
      `UPDATE authSessions SET createdAt = '2020-01-01 00:00:00' WHERE userId = ?`,
    )
    .run(userId)
}

function freshDatabase(overrides: Partial<Env> = {}): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'passkey-integration-secret',
    TOTP_KEK: 'passkey-integration-kek',
    PASSKEY_RP_ID: RP_ID,
    ALLOWED_ORIGINS: 'http://localhost:3000',
    ADMIN_KEY: 'passkey-test-admin',
    ...overrides,
  }
}

beforeEach(() => {
  freshDatabase()
})

afterEach(() => {
  sqlite.close()
})

describe('an environment that cannot do passkeys', () => {
  it('says so, and says it is available nowhere else', async () => {
    freshDatabase({ PASSKEY_RP_ID: undefined })
    const status = await workerRequest('/api/auth/passkey/status')
    expect(status.status).toBe(200)
    expect(((await status.json()) as { available: boolean }).available).toBe(
      false,
    )
  })

  it('refuses every other endpoint with 503, not 500', async () => {
    // Nothing is broken and nothing the caller did is wrong: there is simply
    // no domain a credential could honestly be minted for here.
    freshDatabase({ PASSKEY_RP_ID: undefined })
    const account = await register('nopasskeys@example.com')
    for (const path of [
      '/api/auth/passkey/register/options',
      '/api/auth/passkey/login/options',
    ]) {
      const response = await post(path, {}, account.token)
      expect(response.status).toBe(503)
    }
  })

  it('reports itself available where it is configured', async () => {
    const status = await workerRequest('/api/auth/passkey/status')
    expect(((await status.json()) as { available: boolean }).available).toBe(
      true,
    )
  })
})

describe('who may add one', () => {
  it('turns away a request with no session', async () => {
    const response = await post('/api/auth/passkey/register/options', {})
    expect(response.status).toBe(401)
  })

  it('lets a session that just signed in add one directly', async () => {
    const account = await register('fresh@example.com')
    const response = await post(
      '/api/auth/passkey/register/options',
      {},
      account.token,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      options: { challenge: string; rp: { id: string } }
      ceremony: string
    }
    // Minted for the app's domain, not the API host it was requested from.
    expect(body.options.rp.id).toBe(RP_ID)
    expect(typeof body.ceremony).toBe('string')
  })

  it('demands a second proof from a session that has proved nothing lately', async () => {
    // Sudo mode. A passkey skips the 2FA challenge and survives a password
    // reset, so an unattended laptop must not be enough to mint one.
    const account = await register('stale@example.com')
    ageSession(account.userId)

    const response = await post(
      '/api/auth/passkey/register/options',
      {},
      account.token,
    )
    expect(response.status).toBe(403)
    const body = (await response.json()) as { reauth?: boolean }
    // Flagged so the client can show a code field rather than a dead end.
    expect(body.reauth).toBe(true)
  })

  it('refuses a wrong proof from a stale session', async () => {
    const account = await register('wrongproof@example.com')
    ageSession(account.userId)
    const response = await post(
      '/api/auth/passkey/register/options',
      { proof: '000000' },
      account.token,
    )
    expect(response.status).toBe(403)
  })

  it('takes the password from a stale session with no second factor', async () => {
    // The common case by far: most accounts have no authenticator enrolled.
    // Accepting only a 2FA code here would make this button permanently
    // unusable for them — a dead end with a field nobody can fill.
    const account = await register('bypassword@example.com')
    ageSession(account.userId)

    const refused = await post(
      '/api/auth/passkey/register/options',
      {},
      account.token,
    )
    expect(refused.status).toBe(403)
    expect(((await refused.json()) as { accepts: string[] }).accepts).toEqual([
      'password',
    ])

    const accepted = await post(
      '/api/auth/passkey/register/options',
      { proof: PASSWORD },
      account.token,
    )
    expect(accepted.status).toBe(200)
  })

  it('refuses a wrong password from a stale session', async () => {
    const account = await register('badpassword@example.com')
    ageSession(account.userId)
    const response = await post(
      '/api/auth/passkey/register/options',
      { proof: 'Not-the-password-1' },
      account.token,
    )
    expect(response.status).toBe(403)
  })

  it('says an account with nothing to present must sign in again', async () => {
    // A Google identity that never enrolled a second factor. It genuinely
    // cannot prove anything here, and an empty `accepts` is what lets the
    // client offer the one thing that does work.
    const account = await register('nothing@example.com')
    sqlite
      .prepare(`UPDATE users SET passwordHash = NULL WHERE id = ?`)
      .run(account.userId)
    ageSession(account.userId)

    const response = await post(
      '/api/auth/passkey/register/options',
      {},
      account.token,
    )
    expect(response.status).toBe(403)
    const body = (await response.json()) as {
      accepts: string[]
      error: string
    }
    expect(body.accepts).toEqual([])
    expect(body.error).toContain('Sign in again')
  })

  it('stops at the cap before minting anything', async () => {
    const account = await register('full@example.com')
    for (let i = 0; i < MAX_PASSKEYS_PER_USER; i += 1) {
      seedPasskey(account.userId, `cred-${i}`)
    }
    const response = await post(
      '/api/auth/passkey/register/options',
      {},
      account.token,
    )
    expect(response.status).toBe(409)
  })

  it('refuses a forged registration ceremony', async () => {
    const account = await register('forged@example.com')
    const response = await post(
      '/api/auth/passkey/register/verify',
      { ceremony: 'not.atoken', response: {} },
      account.token,
    )
    expect(response.status).toBe(400)
  })

  it('refuses a ceremony minted for a different account', async () => {
    // The ceremony carries a userId. Presenting somebody else's must not
    // register a credential against the presenter.
    const mine = await register('mine@example.com')
    const theirs = await register('theirs@example.com')
    const start = await post(
      '/api/auth/passkey/register/options',
      {},
      theirs.token,
    )
    const { ceremony } = (await start.json()) as { ceremony: string }

    const response = await post(
      '/api/auth/passkey/register/verify',
      { ceremony, response: {} },
      mine.token,
    )
    expect(response.status).toBe(400)
  })
})

describe('signing in with one', () => {
  it('offers options to nobody in particular', async () => {
    // No session and no username: the credentials are discoverable, which is
    // the whole reason the button can work before anything is typed.
    const response = await post('/api/auth/passkey/login/options', {})
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      options: { rpId: string; userVerification: string }
      ceremony: string
    }
    expect(body.options.rpId).toBe(RP_ID)
    // Not 'preferred'. This is what makes a passkey two factors rather than
    // one, and it is why passkey sign-in skips the TOTP challenge.
    expect(body.options.userVerification).toBe('required')
  })

  it('refuses an assertion with a forged ceremony', async () => {
    const account = await register('login@example.com')
    seedPasskey(account.userId, 'cred-login')
    const response = await post('/api/auth/passkey/login/verify', {
      ceremony: 'not.atoken',
      response: { id: 'cred-login' },
    })
    expect(response.status).toBe(401)
  })

  it('refuses an assertion for a credential nobody has', async () => {
    const start = await post('/api/auth/passkey/login/options', {})
    const { ceremony } = (await start.json()) as { ceremony: string }
    const response = await post('/api/auth/passkey/login/verify', {
      ceremony,
      response: { id: 'no-such-credential' },
    })
    expect(response.status).toBe(401)
  })
})

describe('managing them', () => {
  it("lists only the asking account's own", async () => {
    const mine = await register('list-mine@example.com')
    const theirs = await register('list-theirs@example.com')
    seedPasskey(mine.userId, 'cred-mine')
    seedPasskey(theirs.userId, 'cred-theirs')

    const response = await workerRequest('/api/auth/passkey/list', {
      headers: { Authorization: `Bearer ${mine.token}` },
    })
    const body = (await response.json()) as { passkeys: { id: string }[] }
    expect(body.passkeys.map((p) => p.id)).toEqual(['cred-mine'])
  })

  it('will not delete a credential belonging to somebody else', async () => {
    // Credential ids travel in every assertion, so knowing one must buy
    // nothing. The DELETE is scoped by userId in the statement itself.
    const mine = await register('del-mine@example.com')
    const theirs = await register('del-theirs@example.com')
    seedPasskey(theirs.userId, 'cred-theirs')

    const response = await post(
      '/api/auth/passkey/delete',
      { id: 'cred-theirs' },
      mine.token,
    )
    expect(response.status).toBe(404)
    expect(await listPasskeys(env.DB, theirs.userId)).toHaveLength(1)
  })

  it('removes its own, and answers with what is left', async () => {
    const account = await register('del@example.com')
    seedPasskey(account.userId, 'cred-a')
    seedPasskey(account.userId, 'cred-b')

    const response = await post(
      '/api/auth/passkey/delete',
      { id: 'cred-a' },
      account.token,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { passkeys: { id: string }[] }
    expect(body.passkeys.map((p) => p.id)).toEqual(['cred-b'])
  })
})

describe('the signature counter', () => {
  it('records a regression as a possible clone', async () => {
    // The one signal that a credential may have been copied, and it must not
    // read like an ordinary bad signature.
    const account = await register('counter@example.com')
    seedPasskey(account.userId, 'cred-counter', 9)
    const rows = await listPasskeys(env.DB, account.userId)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await touchPasskey(env.DB, rows[0]!, 4)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('possible cloned authenticator'),
      )
    } finally {
      warn.mockRestore()
    }
  })

  it('says nothing about an authenticator that always reports zero', async () => {
    // Plenty of them do, Apple's included. Warning on that would make the
    // clone signal worthless by drowning it.
    const account = await register('zero@example.com')
    seedPasskey(account.userId, 'cred-zero', 0)
    const rows = await listPasskeys(env.DB, account.userId)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await touchPasskey(env.DB, rows[0]!, 0)
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
    // And the use is still recorded.
    const after = await listPasskeys(env.DB, account.userId)
    expect(after[0]?.lastUsedAt).not.toBeNull()
  })
})

describe('deleting the account', () => {
  it('takes the credentials with it', async () => {
    const account = await register('erase@example.com')
    seedPasskey(account.userId, 'cred-erase')

    const response = await workerRequest('/api/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${account.token}` },
    })
    expect(response.status).toBe(200)
    const left = sqlite
      .prepare('SELECT COUNT(*) AS n FROM webauthnCredentials')
      .get() as { n: number }
    expect(left.n).toBe(0)
  })
})
