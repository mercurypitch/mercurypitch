// ============================================================
// Voice Mirror — client-side baseline persistence.
//
// The latest result is always stored in localStorage so anonymous
// return visits get a delta ("▲ +2 semitones since 12 May"). Only
// derived numbers are stored — never audio (privacy stance §8).
// Email save / server baseline is out of scope for the demo.
// ============================================================

import type { MirrorDelta, MirrorSummary } from './metrics'
import { computeDelta } from './metrics'

const STORAGE_KEY = 'mirror.baseline.v1'

export interface StoredBaseline {
  summary: MirrorSummary
  /** Epoch milliseconds of the run that produced the baseline. */
  savedAt: number
}

export function loadBaseline(storage: Storage): StoredBaseline | null {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as StoredBaseline).savedAt !== 'number' ||
      typeof (parsed as StoredBaseline).summary !== 'object'
    ) {
      return null
    }
    return parsed as StoredBaseline
  } catch {
    return null
  }
}

export function saveBaseline(
  storage: Storage,
  summary: MirrorSummary,
  savedAt: number = Date.now(),
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ summary, savedAt }))
  } catch {
    // Storage full or blocked (private mode) — the run still shows results.
  }
}

/** Delta of the current run vs. the stored baseline, or null on first visit. */
export function deltaVsBaseline(
  storage: Storage,
  current: MirrorSummary,
): { delta: MirrorDelta; since: Date } | null {
  const baseline = loadBaseline(storage)
  if (baseline === null) return null
  return {
    delta: computeDelta(baseline.summary, current),
    since: new Date(baseline.savedAt),
  }
}
