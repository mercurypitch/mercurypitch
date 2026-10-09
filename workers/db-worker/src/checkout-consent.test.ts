// ============================================================
// checkout-consent — the settings a purchase is sold and confirmed under
// ============================================================
//
// Who the mails name as the seller (TRADER_*), how many weekdays the
// withdrawal function stays open past the 14th day
// (WITHDRAWAL_GRACE_WEEKDAYS), and the terms a purchase's consent row
// records.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './auth'
import { purchaseTerms, traderDetails, withdrawalGraceWeekdays, } from './checkout-consent'

const env = (vars: Partial<Env>): Env => vars as Env

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the seller the mails name', () => {
  it('reads the TRADER_* vars', () => {
    expect(
      traderDetails(
        env({
          TRADER_NAME: ' Sample Trader ',
          TRADER_ADDRESS: '1 Sample Street, 00000 Sampletown',
          TRADER_EMAIL: 'sales@example.test',
          TRADER_VAT_ID: 'XX000000000',
        }),
      ),
    ).toEqual({
      name: 'Sample Trader',
      address: '1 Sample Street, 00000 Sampletown',
      email: 'sales@example.test',
      vatId: 'XX000000000',
    })
  })

  it('leaves the VAT ID empty without a placeholder or a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const trader = traderDetails(
      env({
        TRADER_NAME: 'Sample Trader',
        TRADER_ADDRESS: '1 Sample Street, 00000 Sampletown',
        TRADER_EMAIL: 'sales@example.test',
        TRADER_VAT_ID: '',
      }),
    )

    expect(trader.vatId).toBe('')
    expect(warn).not.toHaveBeenCalled()
  })

  it('shows an unset name, address or email as a placeholder, and logs which', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(traderDetails(env({}))).toEqual({
      name: '[TRADER_NAME]',
      address: '[TRADER_ADDRESS]',
      email: '[TRADER_EMAIL]',
      vatId: '',
    })
    expect(warn).toHaveBeenCalledWith(
      '[billing] trader details not set: TRADER_NAME, TRADER_ADDRESS, TRADER_EMAIL',
    )
  })
})

describe('WITHDRAWAL_GRACE_WEEKDAYS', () => {
  it('is 3 unless set', () => {
    expect(withdrawalGraceWeekdays(env({}))).toBe(3)
    expect(
      withdrawalGraceWeekdays(env({ WITHDRAWAL_GRACE_WEEKDAYS: ' ' })),
    ).toBe(3)
  })

  it('takes a whole number from 0 to 20', () => {
    expect(
      withdrawalGraceWeekdays(env({ WITHDRAWAL_GRACE_WEEKDAYS: '0' })),
    ).toBe(0)
    expect(
      withdrawalGraceWeekdays(env({ WITHDRAWAL_GRACE_WEEKDAYS: '5' })),
    ).toBe(5)
  })

  it('keeps 3 for anything else, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    for (const value of ['-1', '2.5', 'three', '21']) {
      expect(
        withdrawalGraceWeekdays(env({ WITHDRAWAL_GRACE_WEEKDAYS: value })),
      ).toBe(3)
    }
    expect(warn).toHaveBeenCalledTimes(4)
  })
})

describe('the terms a purchase keeps', () => {
  it('is the mode of the box its buyer ticked', () => {
    expect(
      purchaseTerms({ mode: 'refund_unused', termsOfService: 'accepted' }),
    ).toBe('refund_unused')
    expect(purchaseTerms({ mode: 'waiver', termsOfService: 'accepted' })).toBe(
      'waiver',
    )
  })

  it('is no_consent without a ticked box on record', () => {
    expect(purchaseTerms(undefined)).toBe('no_consent')
    expect(purchaseTerms(null)).toBe('no_consent')
    expect(purchaseTerms({ mode: 'waiver', termsOfService: null })).toBe(
      'no_consent',
    )
    expect(purchaseTerms({ mode: null, termsOfService: 'accepted' })).toBe(
      'no_consent',
    )
  })
})
