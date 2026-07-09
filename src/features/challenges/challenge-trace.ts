// ============================================================
// Challenge trace — persist each challenge's BEST sung contour
// ============================================================
//
// The pitch-race share video and duet-with-past-self both need the pitch
// contour of a take, not just its score. The attempt return path stores the
// best run's trace per challenge here (localStorage, compact positional
// arrays, ~600 points max — a few KB per challenge). Local-only for now;
// cloud sync can layer on once shared takes exist server-side.

import type { RunTrace, TracePoint } from '@/features/exercises/last-run-trace'

const KEY_PREFIX = 'mp_challenge_trace_v1_'

export interface StoredChallengeTrace {
  score: number
  at: number
  durationMs: number
  /** [tSeconds, hz] pairs — positional to keep the JSON small. */
  samples: Array<[number, number]>
  targets: Array<[number, number]>
}

/** A new take replaces the stored one when it scores at least as well. */
export function shouldReplaceTrace(
  existing: Pick<StoredChallengeTrace, 'score'> | null,
  score: number,
): boolean {
  return existing === null || score >= existing.score
}

const compact = (points: TracePoint[]): Array<[number, number]> =>
  points.map((p) => [Math.round(p.t * 100) / 100, Math.round(p.f * 10) / 10])

export function saveChallengeTrace(
  challengeId: string,
  score: number,
  trace: RunTrace,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): void {
  try {
    const existing = loadChallengeTrace(challengeId, storage)
    if (!shouldReplaceTrace(existing, score)) return
    const stored: StoredChallengeTrace = {
      score,
      at: trace.completedAt,
      durationMs: trace.durationMs,
      samples: compact(trace.samples),
      targets: compact(trace.targets),
    }
    storage.setItem(KEY_PREFIX + challengeId, JSON.stringify(stored))
  } catch {
    // Storage full or blocked — the attempt itself is unaffected.
  }
}

export function loadChallengeTrace(
  challengeId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): StoredChallengeTrace | null {
  try {
    const raw = storage.getItem(KEY_PREFIX + challengeId)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as StoredChallengeTrace).score !== 'number' ||
      !Array.isArray((parsed as StoredChallengeTrace).samples)
    ) {
      return null
    }
    return parsed as StoredChallengeTrace
  } catch {
    return null
  }
}
