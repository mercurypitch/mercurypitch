// Sandbox events on production, bounded (store review): the switch, the
// day's budget, the UTC day, and the one grant a day an account may have.
// node-tests/revenuecat-sandbox-integration.test.ts runs them through the
// webhook, with every migration applied.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { SANDBOX_DAILY_SONGS_DEFAULT, sandboxDailySongs, sandboxDay, sandboxGrantedOn, sandboxOnProduction, } from './revenuecat-sandbox'
import type { LedgerRow } from './songs-allowance'

describe('the switch', () => {
  it('is off while unset', () => {
    expect(sandboxOnProduction({})).toBe(false)
  })

  it('is on for the one word, whatever its case or spacing', () => {
    for (const on of ['bounded', 'BOUNDED', ' Bounded ']) {
      expect(
        sandboxOnProduction({ REVENUECAT_SANDBOX_ON_PRODUCTION: on }),
        on,
      ).toBe(true)
    }
  })

  it('is off for anything else', () => {
    for (const off of [
      '',
      ' ',
      'true',
      '1',
      'on',
      'yes',
      'unbounded',
      'bound',
    ]) {
      expect(
        sandboxOnProduction({ REVENUECAT_SANDBOX_ON_PRODUCTION: off }),
        off,
      ).toBe(false)
    }
  })
})

describe('the day’s budget of sandbox songs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is 200 unless config says, and says nothing about it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(SANDBOX_DAILY_SONGS_DEFAULT).toBe(200)
    expect(sandboxDailySongs({})).toBe(200)
    expect(sandboxDailySongs({ REVENUECAT_SANDBOX_DAILY_SONGS: '60' })).toBe(60)
    expect(warn).not.toHaveBeenCalled()
  })

  it('may be none at all', () => {
    expect(sandboxDailySongs({ REVENUECAT_SANDBOX_DAILY_SONGS: '0' })).toBe(0)
  })

  it('is a plain number of up to four digits, spaces around it ignored', () => {
    expect(sandboxDailySongs({ REVENUECAT_SANDBOX_DAILY_SONGS: '9999' })).toBe(
      9999,
    )
    expect(sandboxDailySongs({ REVENUECAT_SANDBOX_DAILY_SONGS: ' 30\n' })).toBe(
      30,
    )
  })

  it('is 200 for anything else, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const bad = [
      '',
      ' ',
      'twenty',
      '1e3',
      '0x10',
      '99999999999999999999',
      '10000',
      '-20',
      '-0',
      '+5',
      '2.5',
      '200.0',
      'NaN',
      'Infinity',
    ]
    for (const value of bad) {
      expect(
        sandboxDailySongs({ REVENUECAT_SANDBOX_DAILY_SONGS: value }),
        value,
      ).toBe(200)
    }
    expect(warn).toHaveBeenCalledTimes(bad.length)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('REVENUECAT_SANDBOX_DAILY_SONGS'),
    )
  })
})

describe('the day a grant falls on', () => {
  it('is the UTC day, whatever the hour', () => {
    expect(sandboxDay(Date.parse('2026-10-01T00:00:00.000Z'))).toBe(
      '2026-10-01',
    )
    expect(sandboxDay(Date.parse('2026-10-01T23:59:59.999Z'))).toBe(
      '2026-10-01',
    )
    expect(sandboxDay(Date.parse('2026-10-02T00:00:00.000Z'))).toBe(
      '2026-10-02',
    )
  })
})

describe('an account’s one sandbox grant a day', () => {
  const row = (
    reason: string,
    delta: number,
    createdAt: string | undefined,
  ): LedgerRow => ({
    delta,
    reason,
    jobRef: null,
    idempotencyKey: `${reason}:${createdAt ?? 'no date'}:${delta}`,
    createdAt,
  })

  it('is had once a sandbox grant gave songs that day', () => {
    expect(
      sandboxGrantedOn(
        [row('subscription-sandbox', 20, '2026-10-01T08:00:00.000Z')],
        '2026-10-01',
      ),
    ).toBe(true)
  })

  it('is still to be had the next day', () => {
    expect(
      sandboxGrantedOn(
        [row('subscription-sandbox', 20, '2026-10-01T23:59:59.999Z')],
        '2026-10-02',
      ),
    ).toBe(false)
  })

  it('is not used by a grant that gave none, a paid grant, or songs moved in', () => {
    expect(
      sandboxGrantedOn(
        [
          row('subscription-sandbox', 0, '2026-10-01T08:00:00.000Z'),
          row('subscription', 20, '2026-10-01T08:00:00.000Z'),
          row(
            'subscription-sandbox-transfer-in',
            20,
            '2026-10-01T08:00:00.000Z',
          ),
          row('review-access', 3, '2026-10-01T08:00:00.000Z'),
        ],
        '2026-10-01',
      ),
    ).toBe(false)
  })

  it('is not used by a row with no date', () => {
    expect(
      sandboxGrantedOn(
        [row('subscription-sandbox', 20, undefined)],
        '2026-10-01',
      ),
    ).toBe(false)
  })
})
