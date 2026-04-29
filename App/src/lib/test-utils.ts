/**
 * Expose values to the global window object ONLY during e2e testing.
 * This prevents cluttering the global namespace in production while
 * maintaining testability.
 */
export function exposeForE2E(key: string, value: unknown): void {
  // @ts-ignore - Vite injects import.meta.env
  const isTestMode = typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test'
  const isE2E = typeof window !== 'undefined' && (window as any).E2E_TEST_MODE

  if (isTestMode || isE2E) {
    if (typeof window !== 'undefined') {
      ;(window as any)[key] = value
    }
  }
}
