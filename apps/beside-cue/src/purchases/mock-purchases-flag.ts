// ============================================================
// Mock purchases flag — the one check that decides on the fake store
// ============================================================
//
// Deliberately separate from `mock-purchases.ts`: this module is imported
// statically, the mock itself only ever through an `await import()` sitting
// inside a development or explicit internal-TestFlight branch. This keeps fake
// plans, prices and entitlement state machine out of a store-release bundle —
// verified by grepping `dist` for the mock product identifiers.

export interface MockPurchasesEnvironment {
  readonly DEV?: boolean
  readonly VITE_MOCK_PURCHASES?: string
  readonly VITE_BESIDE_CUE_DISTRIBUTION?: string
}

/**
 * A development build opts in with `VITE_MOCK_PURCHASES=1`, or with a
 * `?mockPurchases` query parameter so no restart is needed. Any other build
 * refuses. Internal TestFlight artifacts need both compile-time flags; a URL
 * can never turn their mock on. CI exports these as internal-testing-only.
 */
export function isMockPurchasesEnabled(
  env: MockPurchasesEnvironment,
  search: string,
): boolean {
  if (env.VITE_BESIDE_CUE_DISTRIBUTION === 'store') return false
  if (env.VITE_BESIDE_CUE_DISTRIBUTION === 'testflight-internal') {
    return env.VITE_MOCK_PURCHASES === '1'
  }
  if (env.DEV !== true) return false
  if (env.VITE_MOCK_PURCHASES === '1') return true
  return new URLSearchParams(search).has('mockPurchases')
}
