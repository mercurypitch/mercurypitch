// @vitest-environment node
//
// ── Mail we owe every account holder ─────────────────────────────────
//
// A breach notice, a change to the terms, an account about to be deleted.
// This runs against real SQLite with the real migrations applied and drives
// the worker's own routes, because every property that matters here is a
// property of the two together: who the query reaches, what the log makes
// safe to repeat, and what is left behind when an account is erased.
//
// What it is really guarding:
//
// - **Everybody, not the list.** Somebody who unticked the newsletter box
//   must still get the breach notice, and somebody who never confirmed their
//   address must not -- it may be a stranger's.
// - **It cannot send by accident.** No admin key, no send; anything short of
//   a literal `dryRun: false`, no send.
// - **It can be run again.** A mailing is a loop, and a loop that stops half
//   way has to be safe to restart without telling anybody twice.
// - **One slug, one wording.** Two people must never hold two different
//   versions of the same notice.
// - **It carries no unsubscribe.** A switch that does nothing is a lie, and
//   what the mail carries instead is the reason it arrived.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const PASSWORD = 'Notice123pass'
const ADMIN_KEY = 'account-notices-integration-admin-key'

const NOTICE = {
  notice: '2026-09-terms-update',
  kind: 'legal',
  subject: 'Our terms are changing on 1 November',
  preheader: 'What changes, and what it means for your account.',
  intro: 'We are updating our terms of service.\n\nNothing changes today.',
  items: [{ title: 'What changes', body: 'Section 4 is clearer.' }],
}

let sqlite: DatabaseSync
let env: Env

interface Account {
  token: string
  userId: string
}

interface Mailed {
  to: string
  subject: string
  headers?: Record<string, string>
  html: string
  text: string
}

/** Everything the worker asked Resend to send, oldest first. Registration
 *  mails too (verification, welcome), so notices are picked out by subject. */
let mailed: Mailed[]
/** Addresses the provider refuses, for the tests about half-finished runs. */
let refused: Set<string>

const posted = (): Mailed[] =>
  mailed.filter((m) => m.subject.includes(NOTICE.subject))

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
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

function send(body: object = {}): Promise<Response> {
  return adminRequest('/api/notices/send', {
    method: 'POST',
    body: JSON.stringify({ ...NOTICE, ...body }),
  })
}

async function sendJson<T>(body: object = {}): Promise<T> {
  return (await (await send(body)).json()) as T
}

async function audience(notice = ''): Promise<{
  willReceive: number
  alreadySent: number
  unverified: number
  record: { contentHash: string; subject: string } | null
  canSend: { resend: boolean }
  recipients?: unknown
}> {
  const response = await adminRequest(
    `/api/notices/audience${notice ? `?notice=${notice}` : ''}`,
  )
  expect(response.status).toBe(200)
  return (await response.json()) as Awaited<ReturnType<typeof audience>>
}

async function register(
  email: string,
  extra: Record<string, unknown> = {},
): Promise<Account> {
  const response = await workerRequest('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36',
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      displayName: 'Notice Singer',
      ...extra,
    }),
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Account
}

/** An account whose address somebody confirmed. Registration leaves
 *  emailVerified at 0, and an unconfirmed address is deliberately not
 *  mailable. */
async function holder(
  email: string,
  extra: Record<string, unknown> = {},
): Promise<Account> {
  const account = await register(email, extra)
  sqlite
    .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
    .run(account.userId)
  return account
}

function sendRows(): { notice: string; userId: string }[] {
  return sqlite
    .prepare('SELECT notice, userId FROM accountNoticeSends ORDER BY userId')
    .all() as { notice: string; userId: string }[]
}

function records(): {
  notice: string
  kind: string
  subject: string
  content: string
  contentHash: string
  firstSentAt: string
  lastSentAt: string
}[] {
  return sqlite.prepare('SELECT * FROM accountNotices').all() as ReturnType<
    typeof records
  >
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'account-notices-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
    RESEND_API_KEY: 'test-resend-key',
  }
  mailed = []
  refused = new Set()
  // Only api.resend.com is intercepted. A stub that swallowed everything
  // would hide a request going somewhere it should not.
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
        text: string
      }
      if (refused.has(body.to[0])) {
        return new Response('{"message":"rate limited"}', { status: 429 })
      }
      mailed.push({
        to: body.to[0],
        subject: body.subject,
        headers: body.headers,
        html: body.html,
        text: body.text,
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
  sqlite.close()
})

describe('who a notice reaches', () => {
  it('counts every confirmed address, whatever they said about the newsletter', async () => {
    await holder('never-asked@example.com')
    await holder('said-yes@example.com', { newsletterOptIn: true })
    // Registered, never clicked the confirm link: may be a stranger's.
    await register('unconfirmed@example.com')

    const counts = await audience()
    expect(counts.willReceive).toBe(2)
    expect(counts.unverified).toBe(1)
    expect(counts.alreadySent).toBe(0)
  })

  it('hands back counts and no addresses', async () => {
    await holder('private@example.com')
    const counts = await audience(NOTICE.notice)
    expect(counts.recipients).toBeUndefined()
    expect(JSON.stringify(counts)).not.toContain('private@example.com')
  })

  it('leaves out accounts with no address and addresses that do not exist', async () => {
    await holder('real@example.com')
    await workerRequest('/api/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: crypto.randomUUID() }),
    })
    // A managed testing account: confirmed by construction, at a domain
    // that receives nothing. Mailing it is a bounce.
    const tester = await holder('placeholder@example.com')
    sqlite
      .prepare('UPDATE users SET email = ? WHERE id = ?')
      .run('campaign-tester@testing.mercurypitch.com', tester.userId)

    expect((await audience()).willReceive).toBe(1)
    await send({ dryRun: false })
    expect(posted().map((m) => m.to)).toEqual(['real@example.com'])
  })

  it('still reaches a suspended account, which is still an account', async () => {
    const account = await holder('suspended@example.com')
    sqlite
      .prepare(
        'UPDATE users SET suspendedAt = ?, suspensionReason = ? WHERE id = ?',
      )
      .run(new Date().toISOString(), 'test', account.userId)
    await send({ dryRun: false })
    expect(posted().map((m) => m.to)).toEqual(['suspended@example.com'])
  })

  it('reaches somebody who unsubscribed from the newsletter', async () => {
    const account = await holder('opted-out@example.com', {
      newsletterOptIn: true,
    })
    const off = await workerRequest('/api/newsletter/preference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${account.token}`,
      },
      body: JSON.stringify({ optIn: false }),
    })
    expect(off.status).toBe(200)

    await send({ dryRun: false })
    expect(posted().map((m) => m.to)).toEqual(['opted-out@example.com'])
  })
})

describe('the ways it refuses', () => {
  it('refuses a caller without the admin key', async () => {
    await holder('guarded@example.com')
    expect((await workerRequest('/api/notices/audience')).status).toBe(403)
    const blocked = await workerRequest('/api/notices/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...NOTICE, dryRun: false }),
    })
    expect(blocked.status).toBe(403)
    expect(posted()).toHaveLength(0)
  })

  it('sends nothing unless dryRun is explicitly false', async () => {
    await holder('rehearsal@example.com')
    for (const body of [
      {},
      { dryRun: true },
      { dryRun: 'false' },
      { dryRun: 0 },
    ]) {
      const result = await sendJson<{ dryRun: boolean; sent: number }>(body)
      expect(result.dryRun).toBe(true)
      expect(result.sent).toBe(0)
    }
    expect(posted()).toHaveLength(0)
    expect(sendRows()).toHaveLength(0)
    // A rehearsal is not a record that anything went out.
    expect(records()).toHaveLength(0)
  })

  it('refuses a notice that is missing its copy, or aims somewhere it should not', async () => {
    await holder('incomplete@example.com')
    for (const broken of [
      { notice: '' },
      { notice: 'Not A Slug' },
      { kind: 'marketing' },
      { kind: undefined },
      { subject: '' },
      { preheader: '' },
      { intro: '' },
      { items: 'nope' },
      { items: [{ title: 'No body' }] },
      {
        items: [
          { title: 'Link', body: 'Plain http.', href: 'http://example.com' },
        ],
      },
      { subject: 'x'.repeat(201) },
    ]) {
      expect((await send({ ...broken, dryRun: false })).status).toBe(400)
    }
    expect(posted()).toHaveLength(0)
  })

  it('takes a notice with no sections, because two sentences can be the whole of it', async () => {
    await holder('short@example.com')
    const response = await send({ items: [], dryRun: false })
    expect(response.status).toBe(200)
    expect(posted()).toHaveLength(1)
  })

  it('refuses a real send where there is no provider key, and still rehearses', async () => {
    await holder('keyless@example.com')
    delete env.RESEND_API_KEY
    expect((await send({ dryRun: false })).status).toBe(503)
    expect((await send({})).status).toBe(200)
    expect((await audience()).canSend.resend).toBe(false)
  })
})

describe('a rehearsal', () => {
  it('renders the mail without sending or recording it', async () => {
    await holder('preview@example.com')
    const result = await sendJson<{
      preview?: { subject: string; html: string; text: string }
      remaining: number
    }>()
    expect(result.preview?.subject).toBe(NOTICE.subject)
    expect(result.preview?.html).toContain('What changes')
    expect(result.remaining).toBe(1)
    expect(posted()).toHaveLength(0)
  })

  it('still renders when there is nobody left to render it for', async () => {
    const result = await sendJson<{ preview?: { html: string } }>()
    expect(result.preview?.html).toContain('Hi there,')
  })

  it('turns blank lines into paragraphs and escapes what was typed', async () => {
    const result = await sendJson<{ preview: { html: string; text: string } }>({
      intro: 'First <b>paragraph</b>.\n\nSecond paragraph\nwith a line break.',
    })
    expect(result.preview.html).toContain(
      'First &lt;b&gt;paragraph&lt;/b&gt;.</p>',
    )
    expect(result.preview.html).toContain(
      'Second paragraph<br>with a line break.</p>',
    )
    expect(result.preview.text).toContain(
      'First <b>paragraph</b>.\n\nSecond paragraph\nwith a line break.',
    )
  })
})

describe('the mailing', () => {
  it('mails everyone, logs what the provider accepted, and writes the notice down', async () => {
    const one = await holder('one@example.com')
    const two = await holder('two@example.com')

    const result = await sendJson<{
      sent: number
      failed: number
      remaining: number
      morePossible: boolean
    }>({ dryRun: false })
    expect(result).toMatchObject({
      sent: 2,
      failed: 0,
      remaining: 0,
      morePossible: false,
    })
    expect(
      posted()
        .map((m) => m.to)
        .sort(),
    ).toEqual(['one@example.com', 'two@example.com'])
    expect(
      sendRows()
        .map((r) => r.userId)
        .sort(),
    ).toEqual([one.userId, two.userId].sort())

    const [record] = records()
    expect(record).toMatchObject({
      notice: NOTICE.notice,
      kind: 'legal',
      subject: NOTICE.subject,
    })
    expect(record.contentHash).toMatch(/^[0-9a-f]{64}$/)
    // The wording itself, not a pointer to it: this row is the record of
    // what people were told.
    expect(JSON.parse(record.content)).toMatchObject({
      intro: NOTICE.intro,
      items: [{ title: 'What changes', body: 'Section 4 is clearer.' }],
    })
    expect((await audience(NOTICE.notice)).alreadySent).toBe(2)
  })

  it('does not tell anybody twice', async () => {
    await holder('again@example.com')
    await send({ dryRun: false })
    mailed = []

    const second = await sendJson<{ sent: number }>({ dryRun: false })
    expect(second.sent).toBe(0)
    expect(posted()).toHaveLength(0)
    expect(sendRows()).toHaveLength(1)
  })

  it('picks up where a half-finished run stopped', async () => {
    await holder('reached@example.com')
    const missed = await holder('missed@example.com')
    refused.add('missed@example.com')

    const first = await sendJson<{
      sent: number
      failed: number
      remaining: number
      morePossible: boolean
    }>({ dryRun: false })
    expect(first).toMatchObject({
      sent: 1,
      failed: 1,
      remaining: 1,
      morePossible: true,
    })
    // Not logged: a row for somebody the provider refused would make the
    // re-run skip the one person who still has not been told.
    expect(sendRows().map((r) => r.userId)).not.toContain(missed.userId)

    refused.clear()
    mailed = []
    const second = await sendJson<{ sent: number; remaining: number }>({
      dryRun: false,
    })
    expect(second).toMatchObject({ sent: 1, remaining: 0 })
    expect(posted().map((m) => m.to)).toEqual(['missed@example.com'])
  })

  it('takes the record back when the provider refused the whole first page', async () => {
    await holder('down@example.com')
    refused.add('down@example.com')
    const result = await sendJson<{ sent: number; failed: number }>({
      dryRun: false,
    })
    expect(result).toMatchObject({ sent: 0, failed: 1 })
    // Otherwise the table would say a notice went out on a day it reached
    // nobody.
    expect(records()).toHaveLength(0)
  })

  it('sends to one address when asked, and leaves the rest alone', async () => {
    await holder('chosen@example.com')
    await holder('untouched@example.com')
    const result = await sendJson<{ sent: number; morePossible: boolean }>({
      dryRun: false,
      only: 'Chosen@Example.com',
    })
    expect(result).toMatchObject({ sent: 1, morePossible: false })
    expect(posted().map((m) => m.to)).toEqual(['chosen@example.com'])
  })
})

describe('one slug, one wording', () => {
  it('refuses a later page whose wording changed', async () => {
    await holder('first-page@example.com')
    await send({ dryRun: false })
    await holder('second-page@example.com')
    mailed = []

    const changed = await send({
      dryRun: false,
      intro: 'We are updating our terms. This sentence is new.',
    })
    expect(changed.status).toBe(409)
    expect(posted()).toHaveLength(0)

    // The same wording carries on as if nothing had happened.
    const same = await sendJson<{ sent: number }>({ dryRun: false })
    expect(same.sent).toBe(1)
    expect(records()).toHaveLength(1)
  })

  it('says so on a rehearsal, before anybody has typed the word', async () => {
    await holder('warned@example.com')
    await send({ dryRun: false })
    const rehearsal = await sendJson<{ sameWording: boolean }>({
      subject: 'A different subject',
    })
    expect(rehearsal.sameWording).toBe(false)
    expect((await sendJson<{ sameWording: boolean }>()).sameWording).toBe(true)
  })

  it('hashes the wording, not the order a client sent its keys in', async () => {
    await holder('ordered@example.com')
    await send({ dryRun: false })
    await holder('reordered@example.com')
    const reordered = await adminRequest('/api/notices/send', {
      method: 'POST',
      body: JSON.stringify({
        dryRun: false,
        items: [{ body: 'Section 4 is clearer.', title: 'What changes' }],
        intro: NOTICE.intro,
        preheader: NOTICE.preheader,
        subject: NOTICE.subject,
        kind: NOTICE.kind,
        notice: NOTICE.notice,
      }),
    })
    expect(reordered.status).toBe(200)
  })
})

describe('a test copy', () => {
  it('is one marked email that leaves no trace', async () => {
    await holder('operator@example.com')
    await holder('bystander@example.com')

    const result = await sendJson<{ sent: number; test: boolean }>({
      dryRun: false,
      test: true,
      only: 'operator@example.com',
    })
    expect(result).toMatchObject({ sent: 1, test: true })
    expect(posted().map((m) => m.to)).toEqual(['operator@example.com'])
    expect(posted()[0].subject).toBe(`[TEST] ${NOTICE.subject}`)
    expect(posted()[0].html).toContain('This is a test copy')
    expect(sendRows()).toHaveLength(0)
    expect(records()).toHaveLength(0)

    // So the operator is still on the real mailing afterwards.
    expect((await audience(NOTICE.notice)).willReceive).toBe(2)
  })

  it('still arrives after the real notice has reached that address', async () => {
    await holder('operator@example.com')
    await send({ dryRun: false })
    mailed = []
    const result = await sendJson<{ sent: number }>({
      dryRun: false,
      test: true,
      only: 'operator@example.com',
    })
    expect(result.sent).toBe(1)
  })

  it('needs the one address, and only mails an account holder', async () => {
    await holder('operator@example.com')
    expect((await send({ dryRun: false, test: true })).status).toBe(400)
    const stranger = await sendJson<{ sent: number }>({
      dryRun: false,
      test: true,
      only: 'stranger@example.com',
    })
    expect(stranger.sent).toBe(0)
    expect(posted()).toHaveLength(0)
  })

  it('may use different wording from what went out, because it records nothing', async () => {
    await holder('operator@example.com')
    await send({ dryRun: false })
    const response = await send({
      dryRun: false,
      test: true,
      only: 'operator@example.com',
      intro: 'A draft of the correction.',
    })
    expect(response.status).toBe(200)
  })
})

describe('what the mail carries', () => {
  it('carries the reason it arrived, and no way out of it', async () => {
    await holder('reader@example.com')
    await send({ dryRun: false })
    const [mail] = posted()
    expect(mail.headers?.['List-Unsubscribe']).toBeUndefined()
    expect(mail.html.toLowerCase()).not.toContain('unsubscribe')
    expect(mail.text.toLowerCase()).not.toContain('unsubscribe')
    expect(mail.html).toContain('whatever their newsletter setting')
    expect(mail.text).toContain('whatever their newsletter setting')
    expect(mail.html).toContain('Legal notice')
  })

  it('says it will never ask for a password, on a security notice only', async () => {
    await holder('careful@example.com')
    await send({ dryRun: false })
    expect(posted()[0].html).not.toContain('never ask for your password')

    await send({
      dryRun: false,
      notice: '2026-09-incident',
      kind: 'security',
    })
    const security = posted().at(-1)
    expect(security?.html).toContain('Security notice')
    expect(security?.html).toContain('never ask for your password')
    expect(security?.text).toContain('never ask for your password')
  })
})

describe('when an account is erased', () => {
  it('forgets who was told, and keeps that the notice went out', async () => {
    const account = await holder('leaving@example.com')
    await send({ dryRun: false })
    expect(sendRows()).toHaveLength(1)

    sqlite.prepare('DELETE FROM users WHERE id = ?').run(account.userId)
    expect(sendRows()).toHaveLength(0)
    expect(records()).toHaveLength(1)
  })
})
