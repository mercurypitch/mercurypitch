// Lyrical anchor evidence — require heard landings without counting detector gaps.

export interface MelodyAnchorEvidenceBoundary {
  id: string
  completedAtSeconds: number
}

export interface MelodyAnchorEvidenceOptions {
  minimumSeconds: number
  maximumSampleGapSeconds: number
  alignmentResolutionSeconds: number
}

export interface MelodyAnchorEvidenceGuard {
  clearContinuity(): void
  constrain(
    candidateTimes: number[],
    anchors: readonly MelodyAnchorEvidenceBoundary[],
  ): number[]
  hasRequired(anchorId: string): boolean
  record(anchorId: string | null, capturedAtSeconds: number): void
  reset(anchorIds: readonly string[]): void
}

const EPSILON = 1e-9

/**
 * Count only consecutive aligned observations for one landing. Candidate
 * progress stops immediately before the first landing without enough evidence.
 */
export function createMelodyAnchorEvidenceGuard(
  options: MelodyAnchorEvidenceOptions,
): MelodyAnchorEvidenceGuard {
  const evidenceSeconds = new Map<string, number>()
  let continuousAnchorId: string | null = null
  let lastCaptureSeconds: number | null = null

  const clearContinuity = (): void => {
    continuousAnchorId = null
    lastCaptureSeconds = null
  }

  const hasRequired = (anchorId: string): boolean =>
    (evidenceSeconds.get(anchorId) ?? 0) + EPSILON >= options.minimumSeconds

  return {
    clearContinuity,
    constrain(candidateTimes, anchors) {
      if (options.minimumSeconds <= 0 || candidateTimes.length === 0)
        return candidateTimes
      const furthestTime = Math.max(...candidateTimes)
      const blocker = anchors.find(
        (anchor) =>
          !hasRequired(anchor.id) &&
          furthestTime + options.alignmentResolutionSeconds / 2 >=
            anchor.completedAtSeconds,
      )
      if (!blocker) return candidateTimes
      const maximum =
        blocker.completedAtSeconds -
        options.alignmentResolutionSeconds / 2 -
        EPSILON
      return candidateTimes.filter((timeSeconds) => timeSeconds <= maximum)
    },
    hasRequired,
    record(anchorId, capturedAtSeconds) {
      if (options.minimumSeconds <= 0) return
      if (anchorId === null) {
        clearContinuity()
        return
      }
      let contribution = 0
      if (continuousAnchorId === anchorId && lastCaptureSeconds !== null) {
        const elapsed = capturedAtSeconds - lastCaptureSeconds
        if (elapsed > 0 && elapsed <= options.maximumSampleGapSeconds + EPSILON)
          contribution = Math.min(elapsed, options.maximumSampleGapSeconds)
      }
      evidenceSeconds.set(
        anchorId,
        (evidenceSeconds.get(anchorId) ?? 0) + contribution,
      )
      continuousAnchorId = anchorId
      lastCaptureSeconds = capturedAtSeconds
    },
    reset(anchorIds) {
      for (const anchorId of anchorIds) evidenceSeconds.delete(anchorId)
      clearContinuity()
    },
  }
}
