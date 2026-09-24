// ============================================================
// Loading progress — a fixed logical-unit ledger for honest install readiness.
// ============================================================

export interface LoadingProgress {
  readonly completedUnits: number
  readonly totalUnits: number
}

export interface LoadingProgressLedger {
  readonly unitIds: readonly string[]
  progress(): LoadingProgress
  complete(unitId: string): boolean
  freeze(): void
}

/**
 * The plan is frozen before any work starts. Completion is idempotent so a
 * preferred request and its fallback can share one logical install unit.
 */
export function createLoadingProgressLedger(
  plannedUnitIds: readonly string[],
  onProgress: (progress: LoadingProgress) => void,
): LoadingProgressLedger {
  const unitIds = [...new Set(plannedUnitIds)]
  if (unitIds.some((unitId) => unitId.length === 0))
    throw new Error('Loading progress unit IDs must not be empty.')
  const planned = new Set(unitIds)
  const completed = new Set<string>()
  let frozen = false

  const progress = (): LoadingProgress => ({
    completedUnits: completed.size,
    totalUnits: unitIds.length,
  })
  onProgress(progress())

  return {
    unitIds,
    progress,
    complete(unitId): boolean {
      if (frozen || completed.has(unitId)) return false
      if (!planned.has(unitId))
        throw new Error(`Unknown loading progress unit: ${unitId}`)
      completed.add(unitId)
      onProgress(progress())
      return true
    },
    freeze(): void {
      frozen = true
    },
  }
}
