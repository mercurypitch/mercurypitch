// ============================================================
// Retention sweep — config from the env, and the cutoffs
// ============================================================
//
// The sweep itself runs against real SQLite in
// node-tests/funnel-retention-integration.test.ts. These pin the decisions
// before any SQL: which period each var gives, that a bad var never makes a
// period shorter, and where each cutoff falls.

import { describe, expect, it } from 'vitest'
import { LONGEST_RATE_LIMIT_WINDOW_MS } from './auth'
import { retentionConfig, retentionCutoffs } from './funnel-retention'

const DAY = 86_400_000
const NOW = Date.parse('2026-10-11T06:17:00.000Z')

describe('retentionConfig', () => {
  it('uses the recommended defaults when nothing is set', () => {
    expect(retentionConfig({})).toEqual({
      config: {
        clickIdDays: 90,
        funnelMonths: 13,
        rateLimitDays: 2,
        promoEmailDays: 30,
      },
      problems: [],
    })
  })

  it('reads each var', () => {
    expect(
      retentionConfig({
        RETENTION_CLICK_ID_DAYS: '30',
        RETENTION_FUNNEL_MONTHS: '25',
        RETENTION_RATE_LIMIT_DAYS: '7',
        RETENTION_PROMO_EMAIL_DAYS: '60',
      }).config,
    ).toEqual({
      clickIdDays: 30,
      funnelMonths: 25,
      rateLimitDays: 7,
      promoEmailDays: 60,
    })
  })

  it.each([['0'], ['-13'], ['1.5'], ['13 months'], ['1e2'], ['soon']])(
    'falls back to the default for %j and names the var',
    (raw) => {
      const { config, problems } = retentionConfig({
        RETENTION_CLICK_ID_DAYS: raw,
        RETENTION_FUNNEL_MONTHS: raw,
        RETENTION_RATE_LIMIT_DAYS: raw,
        RETENTION_PROMO_EMAIL_DAYS: raw,
      })
      expect(config).toEqual({
        clickIdDays: 90,
        funnelMonths: 13,
        rateLimitDays: 2,
        promoEmailDays: 30,
      })
      expect(problems).toHaveLength(4)
      expect(problems[0]).toMatch(/^RETENTION_CLICK_ID_DAYS: /)
      expect(problems[1]).toMatch(/^RETENTION_FUNNEL_MONTHS: /)
      expect(problems[2]).toMatch(/^RETENTION_RATE_LIMIT_DAYS: /)
      expect(problems[3]).toMatch(/^RETENTION_PROMO_EMAIL_DAYS: /)
    },
  )

  it('caps a huge period instead of falling back to a shorter one', () => {
    const { config } = retentionConfig({ RETENTION_FUNNEL_MONTHS: '999999' })
    expect(config.funnelMonths).toBe(1200)
  })
})

describe('retentionCutoffs', () => {
  const defaults = retentionConfig({}).config

  it('counts the click id in days and the funnel in calendar months', () => {
    expect(retentionCutoffs(defaults, NOW)).toEqual({
      clickIdBefore: '2026-07-13T06:17:00.000Z',
      funnelBefore: '2025-09-11T06:17:00.000Z',
      rateLimitBefore: NOW - 2 * DAY,
      promoClosedBefore: NOW - 30 * DAY,
    })
  })

  it('gives ISO text that compares with stored createdAt as dates do', () => {
    const { funnelBefore } = retentionCutoffs(defaults, NOW)
    expect('2025-09-11T06:16:59.999Z' < funnelBefore).toBe(true)
    expect('2025-09-11T06:17:00.000Z' < funnelBefore).toBe(false)
  })

  it('never cuts into a live rate-limit window', () => {
    // Today's longest window is a day (anonymous-day), so a whole-day
    // period cannot reach a live counter. If a longer window is ever
    // added, the cutoff follows it.
    expect(LONGEST_RATE_LIMIT_WINDOW_MS).toBe(DAY)
    const shortest = retentionCutoffs({ ...defaults, rateLimitDays: 1 }, NOW)
    expect(shortest.rateLimitBefore).toBeLessThanOrEqual(
      NOW - LONGEST_RATE_LIMIT_WINDOW_MS,
    )
  })
})
