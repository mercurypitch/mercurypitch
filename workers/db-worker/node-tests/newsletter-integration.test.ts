// @vitest-environment node
//
// ── Asking to hear from us, and stopping ─────────────────────────────
//
// Consent is the kind of state that is only worth having if it is exactly
// right, so this runs against real SQLite with the real migrations applied
// and drives the worker's own routes: the checkbox on the register form, the
// one in Settings, and the link at the bottom of an email.
//
// What it is really guarding:
//
// - **Off unless asked.** Every path that creates an account must leave the
//   column at 0 unless a literal `true` arrived with it. A default of "on"
//   is not consent, and a truthy string is not an answer.
// - **The link cannot be guessed or aimed.** An unsubscribe token is the one
//   credential in this feature that travels through other people's mail
//   servers.
// - **The same answer either way.** A token for an account that does not
//   exist must look exactly like a token for one that does, or the endpoint
//   becomes a way to ask whether an address has an account.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { unsubscribeToken } from '../src/newsletter'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const PASSWORD = 'Newsletter123pass'
const LINK_SECRET = 'newsletter-integration-link-secret'

let sqlite: DatabaseSync
let env: Env

interface Account {
  token: string
  userId: string
}

interface ConsentRow {
  newsletterOptIn: number
  newsletterOptInAt: string | null
  newsletterOptOutAt: string | null
  newsletterSource: string | null
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function post(path: string, body: unknown): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  })
}

function authedPost(
  token: string,
  path: string,
  body: unknown,
): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

async function register(
  email: string,
  extra: Record<string, unknown> = {},
): Promise<Account> {
  const response = await post('/api/auth/register', {
    email,
    password: PASSWORD,
    displayName: 'Newsletter Singer',
    ...extra,
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Account
}

function consentOf(userId: string): ConsentRow {
  return sqlite
    .prepare(
      `SELECT newsletterOptIn, newsletterOptInAt, newsletterOptOutAt, newsletterSource
         FROM users WHERE id = ?`,
    )
    .get(userId) as ConsentRow
}

function freshDatabase(): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'newsletter-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    NEWSLETTER_LINK_SECRET: LINK_SECRET,
  }
}

beforeEach(() => {
  freshDatabase()
})

afterEach(() => {
  sqlite.close()
})

describe('the box on the register form', () => {
  it('leaves an account off the list when nobody ticked it', async () => {
    const account = await register('quiet@example.com')
    const row = consentOf(account.userId)
    expect(row.newsletterOptIn).toBe(0)
    expect(row.newsletterOptInAt).toBeNull()
    expect(row.newsletterSource).toBeNull()
  })

  it('records the yes, with when and where it came from', async () => {
    const account = await register('keen@example.com', {
      newsletterOptIn: true,
    })
    const row = consentOf(account.userId)
    expect(row.newsletterOptIn).toBe(1)
    expect(row.newsletterOptInAt).not.toBeNull()
    expect(row.newsletterSource).toBe('signup')
  })

  it('ignores anything that is not a literal true', async () => {
    // A client sending the string "true", or a 1, has not asked the question
    // properly — and an answer nobody gave is not consent.
    for (const [index, value] of ['true', 1, 'yes', null].entries()) {
      const account = await register(`sloppy${index}@example.com`, {
        newsletterOptIn: value,
      })
      expect(consentOf(account.userId).newsletterOptIn).toBe(0)
    }
  })

  it('carries the answer through an anonymous device upgrading in place', async () => {
    // The deviceId IS the identity here: /api/auth/anonymous is keyed on it.
    const deviceId = crypto.randomUUID()
    const anon = (await (
      await post('/api/auth/anonymous', { deviceId })
    ).json()) as Account
    const upgraded = await register('upgrader@example.com', {
      newsletterOptIn: true,
      deviceId,
    })
    expect(upgraded.userId).toBe(anon.userId)
    expect(consentOf(upgraded.userId).newsletterOptIn).toBe(1)
  })

  it('reports the answer back on /api/auth/me', async () => {
    const account = await register('reader@example.com', {
      newsletterOptIn: true,
    })
    const me = (await (
      await workerRequest('/api/auth/me', {
        headers: { Authorization: `Bearer ${account.token}` },
      })
    ).json()) as { user: { newsletterOptIn: boolean } }
    expect(me.user.newsletterOptIn).toBe(true)
  })
})

describe('the box in Settings', () => {
  it('turns updates on and off, stamping each transition', async () => {
    const account = await register('settings@example.com')

    expect(
      (
        await authedPost(account.token, '/api/newsletter/preference', {
          optIn: true,
        })
      ).status,
    ).toBe(200)
    const on = consentOf(account.userId)
    expect(on.newsletterOptIn).toBe(1)
    expect(on.newsletterOptInAt).not.toBeNull()
    expect(on.newsletterSource).toBe('settings')

    expect(
      (
        await authedPost(account.token, '/api/newsletter/preference', {
          optIn: false,
        })
      ).status,
    ).toBe(200)
    const off = consentOf(account.userId)
    expect(off.newsletterOptIn).toBe(0)
    expect(off.newsletterOptOutAt).not.toBeNull()
    // The yes is still on the row. The record of consent is when it was given
    // AND when it was taken back; keeping only the latest would lose half of
    // what a regulator asks for.
    expect(off.newsletterOptInAt).not.toBeNull()
  })

  it('refuses a caller with no session', async () => {
    const response = await post('/api/newsletter/preference', { optIn: true })
    expect(response.status).toBe(401)
  })

  it('refuses a body that did not answer the question', async () => {
    const account = await register('vague@example.com')
    for (const body of [{}, { optIn: 'true' }, { optIn: 1 }, { optIn: null }]) {
      const response = await authedPost(
        account.token,
        '/api/newsletter/preference',
        body,
      )
      expect(response.status).toBe(400)
    }
    expect(consentOf(account.userId).newsletterOptIn).toBe(0)
  })
})

describe('the link at the bottom of an email', () => {
  async function linkFor(userId: string): Promise<string> {
    const { newsletterOptInAt } = consentOf(userId)
    const token = await unsubscribeToken(LINK_SECRET, userId, newsletterOptInAt)
    return `/api/newsletter/unsubscribe?t=${encodeURIComponent(token)}`
  }

  it('unsubscribes without a sign-in, and says so', async () => {
    const account = await register('emailed@example.com', {
      newsletterOptIn: true,
    })
    const response = await workerRequest(await linkFor(account.userId))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toContain('You are unsubscribed')
    const row = consentOf(account.userId)
    expect(row.newsletterOptIn).toBe(0)
    expect(row.newsletterSource).toBe('email')
  })

  it('is idempotent, because a mail client may fetch it twice', async () => {
    const account = await register('twice@example.com', {
      newsletterOptIn: true,
    })
    const link = await linkFor(account.userId)
    expect((await workerRequest(link)).status).toBe(200)
    expect((await workerRequest(link)).status).toBe(200)
    expect(consentOf(account.userId).newsletterOptIn).toBe(0)
  })

  it('answers List-Unsubscribe-Post, which sends no JSON', async () => {
    const account = await register('oneclick@example.com', {
      newsletterOptIn: true,
    })
    const response = await workerRequest(await linkFor(account.userId), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    })
    expect(response.status).toBe(200)
    expect(consentOf(account.userId).newsletterOptIn).toBe(0)
  })

  it('retires every old link the moment they opt back in', async () => {
    const account = await register('returning@example.com', {
      newsletterOptIn: true,
    })
    const oldLink = await linkFor(account.userId)
    await workerRequest(oldLink)

    // A yes from Settings mints a new newsletterOptInAt, which the old
    // signature no longer covers. Otherwise last month's newsletter could
    // silently undo this afternoon's decision.
    await authedPost(account.token, '/api/newsletter/preference', {
      optIn: true,
    })
    const response = await workerRequest(oldLink)
    expect(response.status).toBe(200)
    expect(consentOf(account.userId).newsletterOptIn).toBe(1)
  })

  it('will not unsubscribe somebody else on a forged token', async () => {
    const victim = await register('victim@example.com', {
      newsletterOptIn: true,
    })
    const wrong = await unsubscribeToken(
      'not-the-secret',
      victim.userId,
      consentOf(victim.userId).newsletterOptInAt,
    )
    const response = await workerRequest(
      `/api/newsletter/unsubscribe?t=${encodeURIComponent(wrong)}`,
    )
    // Same page, same status: the endpoint must not become a way to find out
    // whether an id is real.
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('You are unsubscribed')
    expect(consentOf(victim.userId).newsletterOptIn).toBe(1)
  })

  it('answers a stranger exactly as it answers a subscriber', async () => {
    const real = await register('real@example.com', { newsletterOptIn: true })
    const realPage = await (
      await workerRequest(await linkFor(real.userId))
    ).text()
    const strangerPage = await (
      await workerRequest(
        '/api/newsletter/unsubscribe?t=00000000-0000-4000-8000-000000000000.bm90',
      )
    ).text()
    expect(strangerPage).toBe(realPage)
  })

  it('answers 503 where no link could have been minted', async () => {
    delete env.NEWSLETTER_LINK_SECRET
    const response = await workerRequest('/api/newsletter/unsubscribe?t=x.y')
    expect(response.status).toBe(503)
  })
})
