import { describe, expect, it } from 'vitest'
import { isMockPurchasesEnabled } from './mock-purchases-flag'

describe('mock purchases flag', () => {
  it('stays off in a build that is not development', () => {
    // The only rule that really matters: no shipped build may fake a purchase.
    expect(isMockPurchasesEnabled({ DEV: false }, '?mockPurchases')).toBe(false)
    expect(
      isMockPurchasesEnabled({ VITE_MOCK_PURCHASES: '1' }, '?mockPurchases'),
    ).toBe(false)
  })

  it('stays off in development until it is asked for', () => {
    expect(isMockPurchasesEnabled({ DEV: true }, '')).toBe(false)
    expect(isMockPurchasesEnabled({ DEV: true }, '?other=1')).toBe(false)
  })

  it('turns on for the environment variable', () => {
    expect(
      isMockPurchasesEnabled({ DEV: true, VITE_MOCK_PURCHASES: '1' }, ''),
    ).toBe(true)
  })

  it('turns on for the query parameter, whatever its value', () => {
    expect(isMockPurchasesEnabled({ DEV: true }, '?mockPurchases')).toBe(true)
    expect(isMockPurchasesEnabled({ DEV: true }, '?mockPurchases=0')).toBe(true)
  })
})
