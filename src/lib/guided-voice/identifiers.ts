// ============================================================
// Guided Voice identifiers — shared reviewed-ID syntax
// ============================================================

/** True for a nonblank machine identifier, never free-form product copy. */
export function isGuidedIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-z0-9](?:[a-z0-9._:/-]*[a-z0-9])?$/iu.test(value)
  )
}
