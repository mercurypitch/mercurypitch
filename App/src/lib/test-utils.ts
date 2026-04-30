/**
 * Expose values to the global window object ONLY during e2e testing.
 * This prevents cluttering the global namespace in production while
 * maintaining testability.
 */
export function exposeForE2E(key: string, value: unknown): void {
  const isTestMode = import.meta.env.MODE === 'test'
  const win =
    typeof window !== 'undefined'
      ? (window as unknown as Record<string, unknown>)
      : null
  const isE2E = win !== null && win['E2E_TEST_MODE'] === true
  const isPlaywright = win !== null && win['__playwrightTest'] === true
  const isWebDriver = win !== null && navigator.webdriver

  if ((isTestMode || isE2E || isPlaywright || isWebDriver) && win !== null) {
    win[key] = value
  }
}
