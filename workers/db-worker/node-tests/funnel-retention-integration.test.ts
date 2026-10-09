// @vitest-environment node
//
// ── Retention sweeps, against real SQLite ────────────────────────────
//
// The cron deletes what the privacy notice says is not kept (privacy plan
// 4.2): funnel rows after 13 months, the Google click id after 90 days (its
// row stays), rate-limit rows after 2 days, and a promo code's email records
// 30 days after the code closes. This file seeds rows on both
// sides of every cutoff and runs the sweep the cron runs, plus the cron
// itself once, so a wrong column, a wrong comparison or a sweep left out of
// scheduled() fails here.
//
// It also pins the bound: one tick deletes at most batchRows x maxBatches
// rows per rule and leaves the rest for the next, so a first run over a
// backlog stays inside D1's limits.
//
// Real SQLite with every migration applied.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import { retentionConfig, sweepFunnelRetention } from '../src/funnel-retention'
import worker from '../src/index'
import { applyMigration, applyMigrations, SqliteD1Database } from './sqlite-d1'

const DAY = 86_400_000
/** A cron tick: 06:17 UTC on the v0.9.17 tag day. */
const NOW = Date.parse('2026-10-11T06:17:00.000Z')
/** 13 calendar months before NOW. */
const FUNNEL_CUTOFF = Date.parse('2025-09-11T06:17:00.000Z')
const DEFAULTS = retentionConfig({}).config

let sqlite: DatabaseSync
let db: D1Database
let env: Env

const iso = (ms: number): string => new Date(ms).toISOString()

let eventSeq = 0
function event(createdAtMs: number, clientId = 'client-a'): string {
  eventSeq += 1
  const id = `event-${eventSeq}`
  sqlite
    .prepare(
      "INSERT INTO mirrorEvents (id, createdAt, clientId, event, metricsJson) VALUES (?, ?, ?, 'mirror_view', NULL)",
    )
    .run(id, iso(createdAtMs), clientId)
  return id
}

function acquisition(
  clientId: string,
  createdAtMs: number,
  gclid: string | null = 'CjwKCA-test',
): void {
  sqlite
    .prepare(
      "INSERT INTO funnelAcquisition (clientId, createdAt, gclid, utmSource, utmCampaign) VALUES (?, ?, ?, 'google', 'E')",
    )
    .run(clientId, iso(createdAtMs), gclid)
}

function rateLimit(ip: string, windowStartMs: number): void {
  sqlite
    .prepare(
      "INSERT INTO auth_ratelimit (ip, endpoint, count, windowStart) VALUES (?, 'login', 3, ?)",
    )
    .run(ip, windowStartMs)
}

function promoCode(id: string, expiresAt: string | null): void {
  sqlite
    .prepare(
      `INSERT INTO promoCodes (id, code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active, createdAt, updatedAt)
       VALUES (?, ?, 5, NULL, 0, NULL, ?, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(id, id.toUpperCase(), expiresAt)
}

function promoEmail(
  promoCodeId: string,
  emailHash: string,
  kind = 'claim',
): void {
  sqlite
    .prepare(
      "INSERT INTO promoEmailClaims (promoCodeId, kind, emailHash, createdAt) VALUES (?, ?, ?, '2026-06-01T00:00:00.000Z')",
    )
    .run(promoCodeId, kind, emailHash)
}

function promoEmailsOf(promoCodeId: string): number {
  return (
    sqlite
      .prepare(
        'SELECT COUNT(*) AS n FROM promoEmailClaims WHERE promoCodeId = ?',
      )
      .get(promoCodeId) as { n: number }
  ).n
}

function eventIds(): string[] {
  return (
    sqlite.prepare('SELECT id FROM mirrorEvents ORDER BY id').all() as Array<{
      id: string
    }>
  ).map((row) => row.id)
}

function acquisitions(): Array<{
  clientId: string
  gclid: string | null
  utmSource: string | null
  utmCampaign: string | null
}> {
  return sqlite
    .prepare(
      'SELECT clientId, gclid, utmSource, utmCampaign FROM funnelAcquisition ORDER BY clientId',
    )
    .all() as Array<{
    clientId: string
    gclid: string | null
    utmSource: string | null
    utmCampaign: string | null
  }>
}

function rateLimitIps(): string[] {
  return (
    sqlite.prepare('SELECT ip FROM auth_ratelimit ORDER BY ip').all() as Array<{
      ip: string
    }>
  ).map((row) => row.ip)
}

function count(table: string): number {
  return (
    sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  ).n
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  applyMigrations(sqlite)
  db = new SqliteD1Database(sqlite) as unknown as D1Database
  env = { DB: db } as Env
  eventSeq = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  sqlite.close()
})

describe('funnel rows after 13 months', () => {
  it('deletes the old rows and keeps the fresh ones', async () => {
    const tooOld = event(FUNNEL_CUTOFF - 1)
    const muchTooOld = event(FUNNEL_CUTOFF - 200 * DAY)
    const onTheLine = event(FUNNEL_CUTOFF)
    const justInside = event(FUNNEL_CUTOFF + 1)
    const fresh = event(NOW - DAY)
    acquisition('client-old', FUNNEL_CUTOFF - 1)
    acquisition('client-on-the-line', FUNNEL_CUTOFF, null)
    acquisition('client-fresh', NOW - DAY)

    const result = await sweepFunnelRetention(db, DEFAULTS, NOW)

    expect(eventIds()).toEqual([onTheLine, justInside, fresh].sort())
    expect(eventIds()).not.toContain(tooOld)
    expect(eventIds()).not.toContain(muchTooOld)
    expect(acquisitions().map((row) => row.clientId)).toEqual([
      'client-fresh',
      'client-on-the-line',
    ])
    expect(result.mirrorEventsDeleted).toBe(2)
    expect(result.acquisitionsDeleted).toBe(1)
    expect(result.drained).toBe(true)
  })

  it('keeps a row the worker itself wrote today', async () => {
    // The ingest route's own timestamp format, not one this test invented.
    const response = await worker.fetch(
      new Request('https://api.test/api/mirror/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.7',
        },
        body: JSON.stringify({
          clientId: 'route-written-client',
          event: 'mirror_view',
          acq: { gclid: 'route-click', utmSource: 'google' },
        }),
      }),
      env,
      {} as ExecutionContext,
    )
    expect(response.status).toBe(201)
    event(Date.now() - 500 * DAY)

    await sweepFunnelRetention(db, DEFAULTS, Date.now())

    expect(count('mirrorEvents')).toBe(1)
    expect(acquisitions()).toEqual([
      {
        clientId: 'route-written-client',
        gclid: 'route-click',
        utmSource: 'google',
        utmCampaign: null,
      },
    ])
  })
})

describe('click ids after 90 days', () => {
  it('clears the gclid and keeps the row and its campaign', async () => {
    acquisition('client-91-days', NOW - 91 * DAY)
    acquisition('client-89-days', NOW - 89 * DAY)
    acquisition('client-no-click', NOW - 200 * DAY, null)

    const result = await sweepFunnelRetention(db, DEFAULTS, NOW)

    expect(acquisitions()).toEqual([
      {
        clientId: 'client-89-days',
        gclid: 'CjwKCA-test',
        utmSource: 'google',
        utmCampaign: 'E',
      },
      {
        clientId: 'client-91-days',
        gclid: null,
        utmSource: 'google',
        utmCampaign: 'E',
      },
      {
        clientId: 'client-no-click',
        gclid: null,
        utmSource: 'google',
        utmCampaign: 'E',
      },
    ])
    expect(result.clickIdsCleared).toBe(1)
  })

  it('clears nothing twice', async () => {
    acquisition('client-91-days', NOW - 91 * DAY)

    await sweepFunnelRetention(db, DEFAULTS, NOW)
    const again = await sweepFunnelRetention(db, DEFAULTS, NOW)

    expect(again.clickIdsCleared).toBe(0)
  })
})

describe('rate-limit rows after 2 days', () => {
  it('deletes rows whose window started more than 2 days ago', async () => {
    rateLimit('198.51.100.1', NOW - 2 * DAY - 1)
    rateLimit('198.51.100.2', NOW - 40 * DAY)
    rateLimit('198.51.100.3', NOW - 2 * DAY)
    rateLimit('198.51.100.4', NOW - 2 * DAY + 1)
    rateLimit('198.51.100.5', NOW - 60_000)

    const result = await sweepFunnelRetention(db, DEFAULTS, NOW)

    expect(rateLimitIps()).toEqual([
      '198.51.100.3',
      '198.51.100.4',
      '198.51.100.5',
    ])
    expect(result.rateLimitsDeleted).toBe(2)
  })
})

describe('promo email records 30 days after the code closes', () => {
  it("deletes a closed code's records and keeps an open code's", async () => {
    // Closed 31 days ago, closed 29 days ago, closing next year, and a
    // code with no end at all, which never closes.
    promoCode('promo-closed-31', iso(NOW - 31 * DAY))
    promoCode('promo-closed-29', iso(NOW - 29 * DAY))
    promoCode('promo-open', '2027-01-01T23:59:59.000Z')
    promoCode('promo-forever', null)
    for (const id of [
      'promo-closed-31',
      'promo-closed-29',
      'promo-open',
      'promo-forever',
    ]) {
      promoEmail(id, `${id}-hash-a`)
      promoEmail(id, `${id}-hash-b`, 'offer-bonus')
    }

    const result = await sweepFunnelRetention(db, DEFAULTS, NOW)

    expect(promoEmailsOf('promo-closed-31')).toBe(0)
    expect(promoEmailsOf('promo-closed-29')).toBe(2)
    expect(promoEmailsOf('promo-open')).toBe(2)
    expect(promoEmailsOf('promo-forever')).toBe(2)
    expect(result.promoEmailsDeleted).toBe(2)
  })

  it('keeps the records of a code whose end date does not parse', async () => {
    // Unreadable is not "closed": a bad value never widens a delete.
    promoCode('promo-garbled', 'some time in 2025')
    promoEmail('promo-garbled', 'garbled-hash')

    await sweepFunnelRetention(db, DEFAULTS, NOW)

    expect(promoEmailsOf('promo-garbled')).toBe(1)
  })

  it('caps the deletes like every other rule', async () => {
    promoCode('promo-closed', iso(NOW - 60 * DAY))
    for (let i = 0; i < 7; i += 1) promoEmail('promo-closed', `hash-${i}`)
    const limits = { batchRows: 3, maxBatches: 1 }

    const first = await sweepFunnelRetention(db, DEFAULTS, NOW, limits)
    expect(first.promoEmailsDeleted).toBe(3)
    expect(first.drained).toBe(false)
    expect(promoEmailsOf('promo-closed')).toBe(4)
  })

  it('follows RETENTION_PROMO_EMAIL_DAYS through the cron', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    promoCode('promo-closed-10', iso(NOW - 10 * DAY))
    promoEmail('promo-closed-10', 'hash-10')

    await worker.scheduled(
      {} as ScheduledController,
      { ...env, RETENTION_PROMO_EMAIL_DAYS: '7' },
      {} as ExecutionContext,
    )

    expect(promoEmailsOf('promo-closed-10')).toBe(0)
  })
})

describe('a bounded tick', () => {
  it('deletes at most batchRows x maxBatches per rule and leaves the rest', async () => {
    const old: string[] = []
    for (let i = 0; i < 25; i += 1) {
      old.push(event(FUNNEL_CUTOFF - (i + 1) * DAY))
      rateLimit(`192.0.2.${i}`, NOW - (10 + i) * DAY)
    }
    const fresh = event(NOW - DAY)
    rateLimit('192.0.2.200', NOW)
    const limits = { batchRows: 5, maxBatches: 2 }

    const first = await sweepFunnelRetention(db, DEFAULTS, NOW, limits)

    expect(first.mirrorEventsDeleted).toBe(10)
    expect(first.rateLimitsDeleted).toBe(10)
    expect(first.drained).toBe(false)
    expect(count('mirrorEvents')).toBe(16)
    expect(count('auth_ratelimit')).toBe(16)
    // Oldest first: the ten that went are the ten oldest.
    expect(eventIds()).not.toContain(old[24])
    expect(eventIds()).toContain(old[0])

    const second = await sweepFunnelRetention(db, DEFAULTS, NOW, limits)
    expect(second.mirrorEventsDeleted).toBe(10)
    expect(second.drained).toBe(false)

    const third = await sweepFunnelRetention(db, DEFAULTS, NOW, limits)
    expect(third.mirrorEventsDeleted).toBe(5)
    expect(third.rateLimitsDeleted).toBe(5)
    expect(third.drained).toBe(true)

    expect(eventIds()).toEqual([fresh])
    expect(rateLimitIps()).toEqual(['192.0.2.200'])
  })

  it('caps the click-id update the same way', async () => {
    for (let i = 0; i < 7; i += 1) {
      acquisition(`client-${i}`, NOW - (100 + i) * DAY)
    }
    const limits = { batchRows: 3, maxBatches: 1 }

    const first = await sweepFunnelRetention(db, DEFAULTS, NOW, limits)
    expect(first.clickIdsCleared).toBe(3)
    expect(first.drained).toBe(false)

    await sweepFunnelRetention(db, DEFAULTS, NOW, limits)
    const third = await sweepFunnelRetention(db, DEFAULTS, NOW, limits)
    expect(third.clickIdsCleared).toBe(1)
    expect(third.drained).toBe(true)
    expect(acquisitions().every((row) => row.gclid === null)).toBe(true)
  })
})

describe('one rule failing', () => {
  it('does not stop the others', async () => {
    rateLimit('198.51.100.1', NOW - 40 * DAY)
    event(FUNNEL_CUTOFF - DAY)
    // A database where the acquisition table is missing, as on a worker
    // deployed ahead of its migration.
    sqlite.exec('DROP TABLE funnelAcquisition')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await sweepFunnelRetention(db, DEFAULTS, NOW)

    expect(result.failed).toEqual(['acquisitions', 'clickIds'])
    expect(count('mirrorEvents')).toBe(0)
    expect(count('auth_ratelimit')).toBe(0)
  })
})

describe('the cron', () => {
  it('runs the sweep with the periods from the env', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const twoMonthsOld = event(NOW - 62 * DAY)
    const fresh = event(NOW - DAY)
    acquisition('client-20-days', NOW - 20 * DAY)
    rateLimit('198.51.100.1', NOW - 3 * DAY)

    await worker.scheduled(
      {} as ScheduledController,
      { ...env, RETENTION_FUNNEL_MONTHS: '1', RETENTION_CLICK_ID_DAYS: '10' },
      {} as ExecutionContext,
    )

    expect(eventIds()).toEqual([fresh])
    expect(eventIds()).not.toContain(twoMonthsOld)
    expect(acquisitions()).toHaveLength(1)
    expect(acquisitions()[0]?.gclid).toBeNull()
    expect(count('auth_ratelimit')).toBe(0)
  })

  it('keeps the default when the env holds a bad period', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const twoMonthsOld = event(NOW - 62 * DAY)
    acquisition('client-30-days', NOW - 30 * DAY)
    rateLimit('198.51.100.1', NOW - 1.5 * DAY)

    await worker.scheduled(
      {} as ScheduledController,
      {
        ...env,
        RETENTION_FUNNEL_MONTHS: '0',
        RETENTION_CLICK_ID_DAYS: '-90',
        RETENTION_RATE_LIMIT_DAYS: '1.5',
      },
      {} as ExecutionContext,
    )

    expect(eventIds()).toEqual([twoMonthsOld])
    expect(acquisitions()[0]?.gclid).toBe('CjwKCA-test')
    expect(count('auth_ratelimit')).toBe(1)
    expect(warn).toHaveBeenCalled()
  })
})

describe('migration 0063', () => {
  it('gives each sweep an index on its date column', () => {
    const plan = (sql: string): string =>
      (
        sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{
          detail: string
        }>
      )
        .map((row) => row.detail)
        .join(' | ')

    expect(
      plan(
        "SELECT rowid FROM mirrorEvents WHERE createdAt < '2025' ORDER BY createdAt LIMIT 5",
      ),
    ).toContain('idx_mirrorEvents_createdAt')
    expect(
      plan(
        "SELECT rowid FROM funnelAcquisition WHERE createdAt < '2025' ORDER BY createdAt LIMIT 5",
      ),
    ).toContain('idx_funnelAcquisition_createdAt')
    expect(
      plan(
        'SELECT rowid FROM auth_ratelimit WHERE windowStart < 5 ORDER BY windowStart LIMIT 5',
      ),
    ).toContain('idx_auth_ratelimit_windowStart')
  })

  it('applies again on a database that already has it, rows and all', () => {
    // The dev D1 is shared with sibling preview branches: it may already
    // hold these indexes, and certainly holds their rows.
    event(NOW)
    acquisition('client-a', NOW)
    rateLimit('198.51.100.1', NOW)

    expect(() =>
      applyMigration(sqlite, '0063_retention_sweep_indexes.sql'),
    ).not.toThrow()
    expect(count('mirrorEvents')).toBe(1)
  })
})

describe('the deployed config', () => {
  // Wrangler's env blocks do not inherit vars from the top level, so a
  // period missing from one block silently runs on the default there.
  it('sets every period, valid and the same, in all three wrangler blocks', () => {
    const config = readFileSync(
      join(import.meta.dirname, '../wrangler.jsonc'),
      'utf8',
    )
    const env: Record<string, string> = {}
    for (const name of [
      'RETENTION_CLICK_ID_DAYS',
      'RETENTION_FUNNEL_MONTHS',
      'RETENTION_RATE_LIMIT_DAYS',
      'RETENTION_PROMO_EMAIL_DAYS',
    ]) {
      const values = [
        ...config.matchAll(new RegExp(`"${name}":\\s*"([^"]*)"`, 'g')),
      ].map((match) => match[1] ?? '')
      expect(values, name).toHaveLength(3)
      expect(new Set(values).size, name).toBe(1)
      env[name] = values[0] ?? ''
    }
    expect(retentionConfig(env).problems).toEqual([])
  })

  it('sets both browser periods, valid, in both build env files', () => {
    for (const file of ['.env.production', '.env.development']) {
      const text = readFileSync(
        join(import.meta.dirname, '../../..', file),
        'utf8',
      )
      for (const name of [
        'VITE_RETENTION_CLICK_ID_DAYS',
        'VITE_RETENTION_FUNNEL_ID_MONTHS',
      ]) {
        expect(text, `${file} ${name}`).toMatch(
          new RegExp(`^${name}=[1-9][0-9]*$`, 'm'),
        )
      }
    }
  })
})
