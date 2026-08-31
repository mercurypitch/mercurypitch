// ============================================================
// Dev seed flag — the one check that decides on a pre-set app
// ============================================================
//
// Same split as `mock-purchases-flag.ts`: this module is imported
// statically, the seeder itself only through an `await import()` inside an
// `import.meta.env.DEV` branch, so no fixture plan text can reach a
// production bundle.

export interface DevSeedEnvironment {
  readonly DEV?: boolean
  readonly VITE_DEV_SEED?: string
}

/**
 * A development build skips the cinematic intro and the setup walk with
 * `VITE_DEV_SEED=1`, or with a `?devSeed` query parameter so no restart is
 * needed. Any other build refuses — the DEV check comes first and has no
 * escape hatch.
 */
export function isDevSeedEnabled(
  env: DevSeedEnvironment,
  search: string,
): boolean {
  if (env.DEV !== true) return false
  if (env.VITE_DEV_SEED === '1') return true
  return new URLSearchParams(search).has('devSeed')
}
