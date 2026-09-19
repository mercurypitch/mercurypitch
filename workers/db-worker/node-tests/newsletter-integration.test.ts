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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { unsubscribeToken } from '../src/newsletter'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const PASSWORD = 'Newsletter123pass'
const LINK_SECRET = 'newsletter-integration-link-secret'
const ADMIN_KEY = 'newsletter-integration-admin-key'

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
    ADMIN_KEY,
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

// ── Sending ──────────────────────────────────────────────────────────
//
// Everything above is about who is on the list. This is about the one action
// that cannot be taken back, so what it guards is mostly refusals: no admin
// key, no send; no signing key, no send; no `--send`, no send. The one
// positive test that matters is that the link inside the mail actually works
// — an unsubscribe link that 404s is worse than no newsletter.

describe('sending an issue', () => {
  const ISSUE = {
    issue: 'test-issue',
    subject: 'A test issue',
    preheader: 'Just the one.',
    intro: 'Here is what changed.',
    items: [{ title: 'A thing', body: 'It happened.' }],
  }

  /** Newsletter mails the worker asked Resend to send, oldest first.
   *  Registration also sends (verification, welcome), so these are picked out
   *  by subject rather than by the header under test. */
  let mailed: {
    to: string
    subject: string
    headers?: Record<string, string>
    html: string
  }[]
  const posted = (): typeof mailed =>
    mailed.filter((m) => m.subject === ISSUE.subject)

  beforeEach(() => {
    mailed = []
    env.RESEND_API_KEY = 'test-resend-key'
    // Only api.resend.com is intercepted; the worker's own fetch is not
    // involved here, and a stub that swallowed everything would hide a
    // request going somewhere it should not.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        if (!url.startsWith('https://api.resend.com/')) {
          throw new Error(`unexpected fetch to ${url}`)
        }
        const body = JSON.parse(String(init?.body)) as {
          to: string[]
          subject: string
          headers?: Record<string, string>
          html: string
        }
        mailed.push({
          to: body.to[0],
          subject: body.subject,
          headers: body.headers,
          html: body.html,
        })
        return new Response(JSON.stringify({ id: `msg-${mailed.length}` }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** A confirmed, opted-in address. Registration leaves emailVerified at 0,
   *  and an unverified address is deliberately not mailable. */
  async function subscriber(email: string): Promise<Account> {
    const account = await register(email, { newsletterOptIn: true })
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(account.userId)
    return account
  }

  function adminRequest(path: string, init?: RequestInit): Promise<Response> {
    return workerRequest(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
        ...(init?.headers ?? {}),
      },
    })
  }

  function send(body: object): Promise<Response> {
    return adminRequest('/api/newsletter/send', {
      method: 'POST',
      body: JSON.stringify({ ...ISSUE, ...body }),
    })
  }

  function sentRows(): { issue: string; userId: string }[] {
    return sqlite
      .prepare('SELECT issue, userId FROM newsletterSends')
      .all() as { issue: string; userId: string }[]
  }

  it('lists only people who said yes and confirmed their address', async () => {
    const yes = await subscriber('yes@example.com')
    await register('no@example.com')
    // Said yes, never clicked the confirm link: not mailable.
    await register('unconfirmed@example.com', { newsletterOptIn: true })

    const body = (await (
      await adminRequest('/api/newsletter/recipients')
    ).json()) as { recipients: { userId: string; email: string }[] }
    expect(body.recipients.map((r) => r.email)).toEqual(['yes@example.com'])
    expect(body.recipients[0].userId).toBe(yes.userId)
  })

  it('refuses a caller without the admin key', async () => {
    await subscriber('private@example.com')
    expect((await workerRequest('/api/newsletter/recipients')).status).toBe(403)
    const blocked = await workerRequest('/api/newsletter/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ISSUE),
    })
    expect(blocked.status).toBe(403)
    expect(posted()).toHaveLength(0)
  })

  it('sends nothing unless dryRun is explicitly false', async () => {
    await subscriber('rehearsal@example.com')
    for (const body of [{}, { dryRun: true }, { dryRun: 'false' }]) {
      const result = (await (await send(body)).json()) as {
        dryRun: boolean
        sent: number
      }
      expect(result.dryRun).toBe(true)
      expect(result.sent).toBe(0)
    }
    expect(posted()).toHaveLength(0)
    expect(sentRows()).toHaveLength(0)
  })

  it('renders a preview on a dry run without mailing it', async () => {
    await subscriber('preview@example.com')
    const result = (await (await send({})).json()) as {
      preview?: { subject: string; html: string }
    }
    expect(result.preview?.subject).toBe(ISSUE.subject)
    expect(result.preview?.html).toContain('A thing')
    expect(posted()).toHaveLength(0)
  })

  it('mails the list and logs what Resend accepted', async () => {
    const one = await subscriber('one@example.com')
    const two = await subscriber('two@example.com')

    const result = (await (await send({ dryRun: false })).json()) as {
      sent: number
      failed: number
    }
    expect(result.sent).toBe(2)
    expect(result.failed).toBe(0)
    expect(
      posted()
        .map((p) => p.to)
        .sort(),
    ).toEqual(['one@example.com', 'two@example.com'])
    expect(
      sentRows()
        .map((r) => r.userId)
        .sort(),
    ).toEqual([one.userId, two.userId].sort())
  })

  it('does not mail the same issue twice', async () => {
    await subscriber('again@example.com')
    await send({ dryRun: false })
    mailed = []

    const second = (await (await send({ dryRun: false })).json()) as {
      sent: number
    }
    expect(second.sent).toBe(0)
    expect(posted()).toHaveLength(0)
    expect(sentRows()).toHaveLength(1)
  })

  it('sends to one address when asked, and leaves the rest alone', async () => {
    await subscriber('chosen@example.com')
    await subscriber('untouched@example.com')

    await send({ dryRun: false, only: 'chosen@example.com' })
    expect(posted().map((p) => p.to)).toEqual(['chosen@example.com'])
  })

  it('carries a List-Unsubscribe link that actually unsubscribes', async () => {
    // The whole compliance story in one assertion: Gmail and Yahoo require
    // the header, and a header pointing at a link that does not work is
    // worse than not sending at all.
    const account = await subscriber('oneclick-send@example.com')
    await send({ dryRun: false })

    const header = posted()[0].headers?.['List-Unsubscribe'] ?? ''
    expect(posted()[0].headers?.['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    )
    const url = header.replace(/^<|>$/g, '')
    expect(posted()[0].html).toContain(url.replace(/&/g, '&amp;'))

    const response = await workerRequest(url.slice(new URL(url).origin.length))
    expect(response.status).toBe(200)
    expect(consentOf(account.userId).newsletterOptIn).toBe(0)
  })

  it('refuses to send where no unsubscribe link could be minted', async () => {
    await subscriber('unlinkable@example.com')
    delete env.NEWSLETTER_LINK_SECRET
    expect((await send({ dryRun: false })).status).toBe(503)
    expect(posted()).toHaveLength(0)
  })

  it('refuses an issue that is missing its copy', async () => {
    await subscriber('incomplete@example.com')
    for (const broken of [
      { issue: '' },
      { issue: 'Not A Slug' },
      { subject: '' },
      { intro: '' },
      { items: [] },
      { items: [{ title: 'No body' }] },
    ]) {
      expect((await send(broken)).status).toBe(400)
    }
    expect(posted()).toHaveLength(0)
  })
})
