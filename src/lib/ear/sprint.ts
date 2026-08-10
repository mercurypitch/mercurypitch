// ============================================================
// Ear Lab — the Daily Sprint.
//
// Five minutes with a reason. Two slots go to whatever the
// readings say is neediest, and one rotates by the calendar so a
// faculty you are already good at never goes stale.
//
// Every segment carries the reason it was picked. Other trainers
// hide their scheduler behind "recommended for you"; this one is
// meant to be shown, because a user who can see *why* today is
// Stack can also see that the choice will change once Stack stops
// being the weak one. That is the same auditability the Mercury
// Index is built on.
//
// Pure: no dates, no storage, no randomness. The caller passes
// today's key and the current sub-scores, and the same inputs
// always produce the same sprint — which is what makes a "daily"
// plan stable across a reload and testable at all.
// ============================================================

/** Why a drill earned its slot. Rendered to the user verbatim. */
export type SprintReason = 'unmeasured' | 'weakest' | 'rotation'

export const SPRINT_REASON_LABEL: Record<SprintReason, string> = {
  unmeasured: 'Never measured',
  weakest: 'Your weakest',
  rotation: 'Keeping it fresh',
}

/** Segments in one sprint. Three keeps it near five minutes: two
 *  needs plus a rotation is enough variety to feel like a session
 *  without becoming a second Calibration. */
export const SPRINT_SEGMENTS = 3

/** Questions per identification segment. Shorter than a full run
 *  (12) — a sprint is a habit, not a measurement. */
export const SPRINT_IDENTIFICATION_ROUNDS = 8

/** Reversals per threshold segment. A full practice track collects
 *  more; a sprint stops early and the reading lands as provisional,
 *  which is honest rather than a shortcut. */
export const SPRINT_THRESHOLD_REVERSALS = 4

export type SprintDrillKind = 'threshold' | 'identification'

/** A drill the sprint may schedule, with its current standing.
 *  `score` is the 0–1000 sub-score; null means never measured. */
export interface SprintCandidate {
  drillId: string
  kind: SprintDrillKind
  score: number | null
}

export type SprintSegment =
  | {
      kind: 'identification'
      drillId: string
      reason: SprintReason
      rounds: number
    }
  | {
      kind: 'threshold'
      drillId: string
      reason: SprintReason
      reversals: number
    }

/** Drills the Ear Lab can actually run today. The catalogue in
 *  `drills.ts` is deliberately larger than what has a view — the
 *  sprint must only schedule what a user can finish, so this list
 *  grows when a drill ships, not when it is designed. */
export const SPRINT_DRILL_IDS: readonly string[] = [
  'hairline',
  'home',
  'the-grid',
  'leap',
  'stack',
  'contour',
]

/**
 * Days since the epoch for a `YYYY-MM-DD` key.
 *
 * Pinned to UTC so the number only changes when the date string
 * does. The caller decides what "today" means (the streak service
 * owns that); this just needs a stable integer to rotate on.
 */
export function dayIndex(dayKey: string): number {
  const ms = Date.parse(`${dayKey}T00:00:00Z`)
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 86_400_000)
}

function segmentFor(
  candidate: SprintCandidate,
  reason: SprintReason,
): SprintSegment {
  return candidate.kind === 'identification'
    ? {
        kind: 'identification',
        drillId: candidate.drillId,
        reason,
        rounds: SPRINT_IDENTIFICATION_ROUNDS,
      }
    : {
        kind: 'threshold',
        drillId: candidate.drillId,
        reason,
        reversals: SPRINT_THRESHOLD_REVERSALS,
      }
}

/**
 * Today's sprint: the neediest drills, plus one on rotation.
 *
 * Need order is unmeasured first (you cannot improve what has never
 * been read), then weakest sub-score. The last slot rotates on the
 * day index so that over a week every drill comes round even while
 * one faculty stays stubbornly bottom of the table — otherwise a
 * single weak spot would monopolise the sprint forever and the rest
 * of the ear would quietly decay.
 *
 * Never schedules the same drill twice, and returns fewer than
 * `SPRINT_SEGMENTS` segments only when there are fewer candidates.
 */
export function planDailySprint(
  candidates: readonly SprintCandidate[],
  dayKey: string,
): SprintSegment[] {
  if (candidates.length === 0) return []

  // Stable sort: unmeasured (-1) before any real score, ties keeping
  // catalogue order so the plan never churns between equal drills.
  const byNeed = candidates
    .map((candidate, order) => ({ candidate, order }))
    .sort((a, b) => {
      const aNeed = a.candidate.score ?? -1
      const bNeed = b.candidate.score ?? -1
      return aNeed === bNeed ? a.order - b.order : aNeed - bNeed
    })

  const picked: SprintSegment[] = []
  const taken = new Set<string>()

  for (const { candidate } of byNeed) {
    if (picked.length >= SPRINT_SEGMENTS - 1) break
    picked.push(
      segmentFor(
        candidate,
        candidate.score === null ? 'unmeasured' : 'weakest',
      ),
    )
    taken.add(candidate.drillId)
  }

  // Rotation slot: walk forward from today's offset to the first
  // drill the need pass did not already claim.
  const start =
    ((dayIndex(dayKey) % candidates.length) + candidates.length) %
    candidates.length
  for (let step = 0; step < candidates.length; step++) {
    const candidate = candidates[(start + step) % candidates.length]
    if (candidate === undefined || taken.has(candidate.drillId)) continue
    picked.push(segmentFor(candidate, 'rotation'))
    break
  }

  return picked
}
