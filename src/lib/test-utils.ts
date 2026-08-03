import { IS_TEST } from '@/lib/defaults'

export function isE2ETestMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>)['E2E_TEST_MODE'] === true
  )
}

/**
 * Expose values to the global window object ONLY during e2e testing.
 * This prevents cluttering the global namespace in production while
 * maintaining testability.
 */
export function exposeForE2E(key: string, value: unknown): void {
  const win =
    typeof window !== 'undefined'
      ? (window as unknown as Record<string, unknown>)
      : null
  const isE2E = isE2ETestMode()
  if ((IS_TEST || isE2E) && win !== null) {
    win[key] = value
  }
}
