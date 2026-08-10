// ============================================================
// Mock purchases flag — the one check that decides on the fake store
// ============================================================
//
// Deliberately separate from `mock-purchases.ts`: this module is imported
// statically, the mock itself only ever through an `await import()` sitting
// inside an `import.meta.env.DEV` branch. That split is what keeps the fake
// plans, prices and entitlement state machine out of a production bundle —
// verified by grepping `dist` for the mock product identifiers.

export interface MockPurchasesEnvironment {
  readonly DEV?: boolean
  readonly VITE_MOCK_PURCHASES?: string
}

/**
 * A development build opts in with `VITE_MOCK_PURCHASES=1`, or with a
 * `?mockPurchases` query parameter so no restart is needed. Any other build
 * refuses, which is why the DEV check comes first and has no escape hatch.
 */
export function isMockPurchasesEnabled(
  env: MockPurchasesEnvironment,
  search: string,
): boolean {
  if (env.DEV !== true) return false
  if (env.VITE_MOCK_PURCHASES === '1') return true
  return new URLSearchParams(search).has('mockPurchases')
}
