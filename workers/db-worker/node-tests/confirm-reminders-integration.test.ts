// @vitest-environment node
//
// ── Fresh confirm links ──────────────────────────────────────────────
//
// One more confirm link for accounts that registered and never confirmed.
// Run against real SQLite with every migration applied, through the
// worker's own routes, because what matters is the two together: who the
// query picks, what the ledger makes safe to repeat, what a confirm stamps,
// and what goes when an account is erased. Only Resend is faked, and the
// fake keeps Resend's idempotency rules, because the worker relies on them.
//
// What it guards:
//
// - **One link per account, ever.** The mail promises "we won't write to
//   this address again", and the ledger is what keeps that true, across
//   campaigns and across two pages running at once.
// - **It cannot send by accident.** No admin key, no send; anything short of
//   a literal `dryRun: false`, no send, no ledger row and no new link.
// - **A refused send changes nothing.** The claim and the unsent link are
//   taken back, and the old link still works.
// - **A lost answer is not a second mail.** The worker asks again word for
//   word, and Resend answers with the send that already went.
// - **The right clock.** An account that registered on a device with an
//   old anonymous identity keeps that identity's createdAt; its sign-up is
//   dated by its confirm link instead.
// - **The right host.** The console calls through the Access-gated door; the
//   link in the mail must point at the public one.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import { SELECTION_MAX } from '../src/confirm-reminders'
import worker from '../src/index'
import { applyMigrations, interleaved, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'confirm-reminders-integration-admin-key'
const CAMPAIGN = 'fresh-link-2026-10'
const PASSWORD = 'Fresh123link'
const APP = 'https://dev.app.test'
const PUBLIC_API = 'https://api.public.test'
/** Where the console's requests arrive: the Access-gated door. */
const DOOR = 'https://studio.door.test'
const DAY = 24 * 60 * 60 * 1000
const PLAIN_SUBJECT = 'A fresh link to confirm your Mercury Pitch email'
const TWIN_SUBJECT = 'Your voiceprint is still on your account'
const CONFIRMED = `${APP}/#everified=1`
const DEAD_LINK = `${APP}/#everified_error=invalid_or_used`

/** A request as it reached Resend. */
interface Attempt {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
  idempotencyKey: string | null
  body: string
}

/** A mail Resend sent, with the id it answered. */
interface Mailed extends Attempt {
  id: string
}

interface Account {
  userId: string
  email: string
  /** The confirm link from the sign-up mail. */
  signupLink: string
}

let sqlite: DatabaseSync
let env: Env
let attempts: Attempt[]
let mailed: Mailed[]
/** Addresses Resend refuses. */
let refused: Set<string>
/** Addresses whose next mail goes out but whose answer never comes back. */
let lostAnswers: Set<string>
/** The gaps the worker asked for between requests. */
let gaps: number[]
let nextIp = 1

const isFreshLink = (subject: string): boolean =>
  subject.endsWith(PLAIN_SUBJECT) || subject.endsWith(TWIN_SUBJECT)

const fresh = (): Mailed[] => mailed.filter((m) => isFreshLink(m.subject))

function call(url: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(url, init), env, {} as ExecutionContext)
}

function admin(path: string, init?: RequestInit): Promise<Response> {
  return call(`${DOOR}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
      ...(init?.headers ?? {}),
    },
  })
}

function send(body: object = {}): Promise<Response> {
  return admin('/api/confirm-reminders/send', {
    method: 'POST',
    body: JSON.stringify({ campaign: CAMPAIGN, ...body }),
  })
}

async function sendJson<T = Record<string, unknown>>(
  body: object = {},
): Promise<T> {
  const response = await send(body)
  expect(response.status).toBe(200)
  return (await response.json()) as T
}

interface Audience {
  unconfirmed: number
  eligible: number
  tooNew: number
  tooOld: number
  alreadyReminded: number
  sentThisCampaign: number
  confirmedAfter: number
  history: { campaign: string; sent: number; confirmedAfter: number }[]
}

async function audience(): Promise<Audience> {
  const response = await admin(
    `/api/confirm-reminders/audience?campaign=${CAMPAIGN}`,
  )
  expect(response.status).toBe(200)
  return (await response.json()) as Audience
}

function linkIn(mail: { subject: string; text: string }): string {
  const match = /Confirm my email: (\S+)/.exec(mail.text)
  if (match === null) throw new Error(`no confirm link in "${mail.subject}"`)
  return match[1] as string
}

/** Signs an account up with a password, then dates the sign-up `daysAgo`. */
async function register(
  email: string,
  daysAgo = 3,
  extra: Record<string, unknown> = {},
): Promise<Account> {
  const response = await call(`${PUBLIC_API}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Five sign-ups per address per five minutes; a suite makes more.
      'CF-Connecting-IP': `203.0.113.${nextIp++ % 250}`,
    },
    body: JSON.stringify({ email, password: PASSWORD, ...extra }),
  })
  expect(response.status).toBe(200)
  const { userId } = (await response.json()) as { userId: string }
  const confirm = mailed.filter((m) => m.to === email).at(-1)
  if (confirm === undefined) throw new Error(`no sign-up mail for ${email}`)
  backdate(userId, daysAgo)
  return { userId, email, signupLink: linkIn(confirm) }
}

/** Moves a sign-up, and the 24-hour link it was sent, into the past. */
function backdate(userId: string, daysAgo: number, createdDaysAgo = daysAgo) {
  const at = (days: number) => new Date(Date.now() - days * DAY).toISOString()
  sqlite
    .prepare('UPDATE users SET createdAt = ? WHERE id = ?')
    .run(at(createdDaysAgo), userId)
  sqlite
    .prepare(
      'UPDATE emailVerifications SET createdAt = ?, expiresAt = ? WHERE userId = ?',
    )
    .run(at(daysAgo), at(daysAgo - 1), userId)
}

function confirmEmail(userId: string): void {
  sqlite.prepare('UPDATE users SET emailVerified = 1 WHERE id = ?').run(userId)
}

interface LedgerRow {
  campaign: string
  userId: string
  resendId: string | null
  confirmedAt: string | null
}

function ledger(): LedgerRow[] {
  return sqlite
    .prepare(
      'SELECT campaign, userId, resendId, confirmedAt FROM confirmReminderSends ORDER BY userId',
    )
    .all() as unknown as LedgerRow[]
}

function ledgerBy(userId: string): LedgerRow | undefined {
  return ledger().find((row) => row.userId === userId)
}

function links(): { userId: string; tokenHash: string }[] {
  return sqlite
    .prepare(
      'SELECT userId, tokenHash FROM emailVerifications ORDER BY userId, tokenHash',
    )
    .all() as { userId: string; tokenHash: string }[]
}

function saveVoiceprint(userId: string, twin: string): void {
  const now = new Date().toISOString()
  sqlite
    .prepare(
      'INSERT INTO voiceprints (id, createdAt, updatedAt, userId, summary, twin, source, takenAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      crypto.randomUUID(),
      now,
      now,
      userId,
      JSON.stringify({
        lowMidi: 36,
        highMidi: 60,
        accuracy: 70,
        steadiness: 75,
      }),
      twin,
      'mirror',
      now,
    )
}

/** Where a link lands: the redirect back into the app. */
async function follow(link: string): Promise<string> {
  const response = await call(link)
  return response.headers.get('Location') ?? `status ${response.status}`
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'confirm-reminders-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
    RESEND_API_KEY: 'test-resend-key',
    APP_FALLBACK_ORIGIN: APP,
    PUBLIC_API_ORIGIN: PUBLIC_API,
  }
  attempts = []
  mailed = []
  refused = new Set()
  lostAnswers = new Set()
  gaps = []
  const usedKeys = new Map<string, { body: string; id: string }>()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // The 600 ms between sends is real time the suite need not spend. The
  // gap is still asked for, and recorded, so a test can say it was.
  const realSetTimeout = globalThis.setTimeout
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    handler: () => void,
    ms?: number,
  ) => {
    if (ms === 600) {
      gaps.push(ms)
      return realSetTimeout(handler, 0)
    }
    return realSetTimeout(handler, ms)
  }) as typeof setTimeout)
  // Only Resend is answered. A stub that swallowed everything would hide a
  // request going somewhere it should not.
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url !== 'https://api.resend.com/emails') {
        throw new Error(`unexpected fetch to ${url}`)
      }
      const body = String(init?.body)
      const parsed = JSON.parse(body) as {
        to: string[]
        subject: string
        html: string
        text: string
        headers?: Record<string, string>
      }
      const requestHeaders = (init?.headers ?? {}) as Record<string, string>
      const key = requestHeaders['Idempotency-Key'] ?? null
      const attempt: Attempt = {
        to: parsed.to[0] as string,
        subject: parsed.subject,
        html: parsed.html,
        text: parsed.text,
        headers: parsed.headers,
        idempotencyKey: key,
        body,
      }
      attempts.push(attempt)
      // Resend's rules for a used key: the same body gets the first answer
      // and no second mail; a different body is refused.
      const earlier = key === null ? undefined : usedKeys.get(key)
      if (earlier !== undefined) {
        return earlier.body === body
          ? Response.json({ id: earlier.id })
          : Response.json(
              { name: 'invalid_idempotent_request' },
              { status: 409 },
            )
      }
      if (refused.has(attempt.to)) {
        return Response.json({ name: 'validation_error' }, { status: 422 })
      }
      const id = `re_${mailed.length + 1}`
      mailed.push({ ...attempt, id })
      if (key !== null) usedKeys.set(key, { body, id })
      if (lostAnswers.delete(attempt.to)) {
        throw new TypeError('Network connection lost.')
      }
      return Response.json({ id })
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  sqlite.close()
})

describe('who gets a fresh link', () => {
  it('splits unconfirmed accounts into eligible, too new, too old and already reminded, which add up', async () => {
    await register('eligible@example.test', 3)
    await register('too-new@example.test', 0)
    await register('too-old@example.test', 120)
    const reminded = await register('reminded@example.test', 5)
    sqlite
      .prepare(
        'INSERT INTO confirmReminderSends (campaign, userId, sentAt) VALUES (?, ?, ?)',
      )
      .run('fresh-link-2026-09', reminded.userId, new Date().toISOString())

    expect(await audience()).toMatchObject({
      unconfirmed: 4,
      eligible: 1,
      tooNew: 1,
      tooOld: 1,
      alreadyReminded: 1,
    })
  })

  it('never counts or mails a confirmed, suspended, anonymous or managed test account', async () => {
    confirmEmail((await register('confirmed@example.test')).userId)
    const suspended = await register('suspended@example.test')
    sqlite
      .prepare('UPDATE users SET suspendedAt = ? WHERE id = ?')
      .run(new Date().toISOString(), suspended.userId)
    const tester = await register('tester@example.test')
    sqlite
      .prepare('UPDATE users SET email = ? WHERE id = ?')
      .run('campaign-tester@testing.mercurypitch.com', tester.userId)
    const anonymous = await call(`${PUBLIC_API}/api/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: crypto.randomUUID(),
        deviceSecret: 'n0b0dyHasThisDeviceSecret00000',
      }),
    })
    expect(anonymous.status).toBe(200)

    expect((await audience()).unconfirmed).toBe(0)
    expect((await sendJson({ dryRun: false })).sent).toBe(0)
    expect(fresh()).toEqual([])
  })

  it('dates a sign-up by its confirm link, not by the anonymous identity it took over', async () => {
    const deviceId = crypto.randomUUID()
    const deviceSecret = 'fr3shL1nkDev1ceSecret0123456789'
    const anonymous = await call(`${PUBLIC_API}/api/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, deviceSecret }),
    })
    expect(anonymous.status).toBe(200)
    // Singing anonymously for 200 days, then signing up three days ago.
    const account = await register('upgraded@example.test', 3, {
      deviceId,
      deviceSecret,
    })
    expect(account.userId).toBe(deviceId)
    backdate(account.userId, 3, 200)

    expect((await audience()).eligible).toBe(1)
    await sendJson({ dryRun: false })

    const signedUp = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.now() - 3 * DAY))
    expect(fresh()[0]?.text).toContain(`You signed up on ${signedUp}`)
  })
})

describe('the ways it refuses', () => {
  it('refuses a caller without the admin key', async () => {
    await register('guarded@example.test')

    const counts = await call(`${DOOR}/api/confirm-reminders/audience`)
    const sending = await call(`${DOOR}/api/confirm-reminders/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign: CAMPAIGN, dryRun: false }),
    })

    expect(counts.status).toBe(403)
    expect(sending.status).toBe(403)
    expect(fresh()).toEqual([])
    expect(ledger()).toEqual([])
  })

  it('sends nothing, records nothing and mints no link unless dryRun is literally false', async () => {
    await register('rehearsal@example.test')
    const before = links()

    for (const body of [
      {},
      { dryRun: true },
      { dryRun: 'false' },
      { dryRun: 0 },
      { dryRun: null },
    ]) {
      const result = await sendJson<{ dryRun: boolean; sent: number }>(body)
      expect(result.dryRun).toBe(true)
      expect(result.sent).toBe(0)
    }

    expect(fresh()).toEqual([])
    expect(ledger()).toEqual([])
    expect(links()).toEqual(before)
  })

  it('refuses addresses in a selection, an oversized one, a bad campaign and an empty window', async () => {
    const tooMany = Array.from({ length: SELECTION_MAX + 1 }, () =>
      crypto.randomUUID(),
    )
    const cases: [object, RegExp][] = [
      [{ campaign: '' }, /campaign is required/],
      [{ campaign: 'Not A Slug' }, /lowercase/],
      [{ userIds: ['someone@example.test'] }, /never addresses/],
      [{ userIds: 'everyone' }, /list of account ids/],
      [{ userIds: [] }, /selection is empty/],
      [{ userIds: tooMany }, /at most 100/],
      [{ minAgeHours: 200, maxAgeDays: 2 }, /window is empty/],
      [{ variant: 'marketing' }, /variant/],
      [{ test: true }, /one address/],
    ]
    for (const [body, error] of cases) {
      const response = await send({ dryRun: false, ...body })
      expect(response.status).toBe(400)
      expect(((await response.json()) as { error: string }).error).toMatch(
        error,
      )
    }
    expect(ledger()).toEqual([])
  })

  it('refuses a real send or a test without a provider key, and still rehearses', async () => {
    await register('no-key@example.test')
    env.RESEND_API_KEY = undefined

    const real = await send({ dryRun: false })
    const test = await send({
      dryRun: false,
      test: true,
      only: 'operator@example.test',
    })
    const rehearsal = await send({})

    expect(real.status).toBe(503)
    expect(test.status).toBe(503)
    expect(rehearsal.status).toBe(200)
    expect(ledger()).toEqual([])
  })
})

describe('a rehearsal', () => {
  it('renders the first account it would reach, with a link that confirms nothing', async () => {
    const first = await register('first@example.test', 9)
    await register('second@example.test', 4)
    saveVoiceprint(first.userId, 'Johnny Cash')

    const result = await sendJson<{
      wouldReach: number
      previewFor: string
      preview: { subject: string; html: string; text: string }
    }>()

    expect(result.wouldReach).toBe(2)
    expect(result.previewFor).toBe('account')
    // The oldest sign-up, in that account's own copy.
    expect(result.preview.subject).toBe(TWIN_SUBJECT)
    expect(result.preview.text).toContain('Johnny Cash')
    expect(await follow(linkIn(result.preview))).toBe(DEAD_LINK)
  })

  it('renders either sample copy on request, from no account at all', async () => {
    const plain = await sendJson<{
      previewFor: string
      preview: { subject: string }
    }>({ variant: 'plain' })
    const twin = await sendJson<{
      previewFor: string
      preview: { subject: string; text: string }
    }>({ variant: 'voiceprint' })

    expect(plain.previewFor).toBe('sample')
    expect(plain.preview.subject).toBe(PLAIN_SUBJECT)
    expect(twin.preview.subject).toBe(TWIN_SUBJECT)
    expect(twin.preview.text).toContain('Frank Sinatra')
  })

  it('counts why picked accounts would be skipped, and lets a picked new account through', async () => {
    const brandNew = await register('brand-new@example.test', 0)
    const confirmed = await register('confirmed@example.test')
    confirmEmail(confirmed.userId)
    const old = await register('old@example.test', 200)

    const result = await sendJson<{
      selected: number
      wouldReach: number
      skippedBy: Record<string, number>
    }>({
      userIds: [
        brandNew.userId,
        confirmed.userId,
        old.userId,
        crypto.randomUUID(),
      ],
    })

    expect(result.selected).toBe(4)
    expect(result.wouldReach).toBe(1)
    expect(result.skippedBy).toEqual({
      notFound: 1,
      noAddress: 0,
      confirmed: 1,
      testAccount: 0,
      suspended: 0,
      alreadyReminded: 0,
      tooOld: 1,
    })
  })
})

describe('the mailing', () => {
  it('mails each eligible account once, oldest first, through the public host', async () => {
    const older = await register('older@example.test', 8)
    const newer = await register('newer@example.test', 2)
    await register('too-new@example.test', 0)

    const result = await sendJson({ dryRun: false })

    expect(result).toMatchObject({
      sent: 2,
      failed: 0,
      skipped: 0,
      remaining: 0,
      morePossible: false,
    })
    expect(fresh().map((m) => m.to)).toEqual([older.email, newer.email])
    expect(gaps).toEqual([600])
    const mail = fresh()[0] as Mailed
    const link = linkIn(mail)
    expect(link.startsWith(`${PUBLIC_API}/api/auth/verify-email?token=`)).toBe(
      true,
    )
    expect(link).toContain(`returnTo=${encodeURIComponent(APP)}`)
    expect(mail.text).toContain('The link works for 7 days.')
    expect(mail.idempotencyKey).toBe(`fresh-link-${CAMPAIGN}-${older.userId}`)
    // Transactional: there is no list to leave, so no unsubscribe header.
    // The mail says it will not write again instead.
    expect(mail.headers).toBeUndefined()
    expect(ledgerBy(older.userId)?.resendId).toBe(mail.id)
    expect(ledgerBy(newer.userId)?.resendId).toBe(fresh()[1]?.id)
    expect(await follow(link)).toBe(CONFIRMED)
  })

  it('kills the sign-up link once the fresh one has gone, and the fresh one confirms', async () => {
    // Picked by hand on the day it signed up, so its first link still works.
    const today = await register('wrote-in-today@example.test', 0)
    await register('not-picked@example.test', 5)

    const result = await sendJson({ dryRun: false, userIds: [today.userId] })

    expect(result).toMatchObject({ sent: 1, remaining: 0 })
    expect(fresh().map((m) => m.to)).toEqual([today.email])
    expect(await follow(today.signupLink)).toBe(DEAD_LINK)
    expect(await follow(linkIn(fresh()[0] as Mailed))).toBe(CONFIRMED)
  })

  it('never mails an account a second time, under this campaign or another', async () => {
    await register('once@example.test')
    await sendJson({ dryRun: false })

    const again = await sendJson({ dryRun: false })
    const nextMonth = await sendJson({
      dryRun: false,
      campaign: 'fresh-link-2026-11',
    })

    expect(again.sent).toBe(0)
    expect(nextMonth.sent).toBe(0)
    expect(fresh()).toHaveLength(1)
    expect((await audience()).alreadyReminded).toBe(1)
  })

  it('takes everything back when Resend refuses, so the account is still owed and its old link works', async () => {
    const account = await register('bounces@example.test', 0)
    refused.add(account.email)
    const before = links()

    const result = await sendJson({ dryRun: false, userIds: [account.userId] })

    expect(result).toMatchObject({
      sent: 0,
      failed: 1,
      remaining: 1,
      morePossible: true,
    })
    expect(ledger()).toEqual([])
    expect(links()).toEqual(before)
    refused.clear()
    const retry = await sendJson({ dryRun: false, userIds: [account.userId] })
    expect(retry).toMatchObject({ sent: 1, failed: 0 })
    expect(fresh()).toHaveLength(1)
    expect(attempts.filter((a) => isFreshLink(a.subject))).toHaveLength(2)
  })

  it('asks again word for word when no answer comes back, and the mail goes once', async () => {
    const account = await register('lost-answer@example.test')
    lostAnswers.add(account.email)

    const result = await sendJson({ dryRun: false })

    expect(result).toMatchObject({ sent: 1, failed: 0 })
    const tries = attempts.filter((a) => isFreshLink(a.subject))
    expect(tries).toHaveLength(2)
    expect(tries[1]?.body).toBe(tries[0]?.body)
    expect(tries[1]?.idempotencyKey).toBe(
      `fresh-link-${CAMPAIGN}-${account.userId}`,
    )
    expect(gaps).toEqual([600])
    expect(fresh()).toHaveLength(1)
    expect(ledgerBy(account.userId)?.resendId).toBe(fresh()[0]?.id)
    expect(await follow(linkIn(fresh()[0] as Mailed))).toBe(CONFIRMED)
  })

  it('stops after the page it was given and carries on from there', async () => {
    const first = await register('page-one@example.test', 6)
    const second = await register('page-two@example.test', 3)

    const one = await sendJson({ dryRun: false, limit: 1 })
    const two = await sendJson({ dryRun: false, limit: 1 })

    expect(one).toMatchObject({ sent: 1, remaining: 1, morePossible: true })
    expect(two).toMatchObject({ sent: 1, remaining: 0, morePossible: false })
    expect(fresh().map((m) => m.to)).toEqual([first.email, second.email])
  })

  it('mails each account once when two pages under two campaigns run at the same time', async () => {
    await register('race-one@example.test')
    await register('race-two@example.test')
    env.DB = interleaved(new SqliteD1Database(sqlite))

    const [a, b] = await Promise.all([
      sendJson({ dryRun: false }),
      sendJson({ dryRun: false, campaign: 'fresh-link-2026-10-b' }),
    ])

    expect(Number(a.sent) + Number(b.sent)).toBe(2)
    expect(
      fresh()
        .map((m) => m.to)
        .sort(),
    ).toEqual(['race-one@example.test', 'race-two@example.test'])
    expect(ledger()).toHaveLength(2)
  })
})

describe('what the mail says', () => {
  it("tells each account about its own voiceprint and nobody else's", async () => {
    const cash = await register('cash@example.test', 5)
    const bowie = await register('bowie@example.test', 4)
    await register('none@example.test', 3)
    saveVoiceprint(cash.userId, 'Johnny Cash')
    saveVoiceprint(bowie.userId, 'David Bowie')

    await sendJson({ dryRun: false })

    const [toCash, toBowie, toNone] = fresh()
    expect(toCash?.to).toBe(cash.email)
    expect(toCash?.html).toContain('Johnny Cash')
    expect(toCash?.html).not.toContain('David Bowie')
    expect(toBowie?.html).toContain('David Bowie')
    expect(toBowie?.html).not.toContain('Johnny Cash')
    expect(toNone?.subject).toBe(PLAIN_SUBJECT)
    expect(toNone?.html).not.toContain('Johnny Cash')
    expect(toNone?.html).not.toContain(cash.email)
  })

  it('never puts a stored twin that is not a catalogue legend into the mail', async () => {
    const account = await register('forged@example.test')
    saveVoiceprint(account.userId, '<img src=x onerror=alert(1)>')

    await sendJson({ dryRun: false })

    expect(fresh()[0]?.subject).toBe(PLAIN_SUBJECT)
    expect(fresh()[0]?.html).not.toContain('<img src=x')
  })
})

describe('whether it worked', () => {
  it('stamps confirmedAt for the reminded account that confirms, and only that one', async () => {
    const confirms = await register('confirms@example.test', 5)
    const waits = await register('waits@example.test', 4)
    await sendJson({ dryRun: false })
    const outsider = await register('outsider@example.test', 0)

    expect(await follow(linkIn(fresh()[0] as Mailed))).toBe(CONFIRMED)
    expect(await follow(outsider.signupLink)).toBe(CONFIRMED)

    expect(ledgerBy(confirms.userId)?.confirmedAt).not.toBeNull()
    expect(ledgerBy(waits.userId)?.confirmedAt).toBeNull()
    expect(ledgerBy(outsider.userId)).toBeUndefined()
    const counts = await audience()
    expect(counts.confirmedAfter).toBe(1)
    expect(counts.history).toEqual([
      expect.objectContaining({
        campaign: CAMPAIGN,
        sent: 2,
        confirmedAfter: 1,
      }),
    ])
  })
})

describe('a test copy', () => {
  it('is one marked mail to an account holder, with sample data, that leaves no trace', async () => {
    const operator = await register('operator@example.test')
    confirmEmail(operator.userId)
    await register('owed@example.test')
    const before = links()

    const result = await sendJson({
      dryRun: false,
      test: true,
      only: operator.email,
      variant: 'voiceprint',
    })

    expect(result).toMatchObject({ test: true, sent: 1, failed: 0 })
    expect(fresh()).toHaveLength(1)
    const copy = fresh()[0] as Mailed
    expect(copy.to).toBe(operator.email)
    expect(copy.subject).toBe(`[TEST] ${TWIN_SUBJECT}`)
    expect(copy.text).toContain('Frank Sinatra')
    expect(await follow(linkIn(copy))).toBe(DEAD_LINK)
    expect(ledger()).toEqual([])
    expect(links()).toEqual(before)
  })

  it('mails nobody when the address is not a confirmed account holder', async () => {
    const unconfirmed = await register('not-yet@example.test')

    for (const only of ['stranger@example.test', unconfirmed.email]) {
      const result = await sendJson({ dryRun: false, test: true, only })
      expect(result.sent).toBe(0)
    }
    expect(fresh()).toEqual([])
  })
})

describe('when an account is erased', () => {
  it('takes its ledger row with it', async () => {
    const leaving = await register('leaving@example.test')
    await sendJson({ dryRun: false })
    expect(ledger()).toHaveLength(1)
    const login = await call(`${PUBLIC_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: leaving.email, password: PASSWORD }),
    })
    const { token } = (await login.json()) as { token: string }

    const erased = await call(`${PUBLIC_API}/api/auth/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(erased.status).toBe(200)
    expect(ledger()).toEqual([])
  })
})

describe('the deployed configuration', () => {
  it('points mailed links at the public API host on dev and prod, never the Access door', () => {
    const config = readFileSync(
      join(import.meta.dirname, '../wrangler.jsonc'),
      'utf8',
    )
    const origins = [...config.matchAll(/"PUBLIC_API_ORIGIN": "([^"]+)"/g)].map(
      (match) => match[1],
    )
    expect(origins).toEqual([
      'https://api-dev.mercurypitch.com',
      'https://api.mercurypitch.com',
    ])
  })
})
