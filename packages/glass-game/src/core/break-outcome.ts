// ============================================================
// Break outcome — classify the access change caused by one completed exhibit.
// ============================================================
//
// Narration must describe a physical transition, never infer one from an
// exhibit being required. Only a newly active platform, an explicitly
// presented gate disappearing, or a locked exit opening changes the wording.

import type { BreakOutcome, CourseSolid, LevelDefinition } from '../contracts'
import { requirementsMet } from './progress'
import { getActiveCourseSolids } from './solid-activation'

function solidIds(solids: readonly CourseSolid[]): ReadonlySet<string> {
  return new Set(solids.map((solid) => solid.id))
}

export function deriveBreakOutcome(
  level: LevelDefinition,
  completedBefore: ReadonlySet<string>,
  completedAfter: ReadonlySet<string>,
): BreakOutcome {
  const before = getActiveCourseSolids(level, completedBefore)
  const after = getActiveCourseSolids(level, completedAfter)
  const beforeIds = solidIds(before)
  const afterIds = solidIds(after)
  const openedPlatform = after.some(
    (solid) => solid.kind !== 'prop' && !beforeIds.has(solid.id),
  )
  const openedGate = before.some(
    (solid) =>
      solid.kind === 'prop' &&
      solid.presentation?.role === 'gate' &&
      !afterIds.has(solid.id),
  )
  if (openedPlatform || openedGate) return 'path-opened'

  const exitWasLocked = !requirementsMet(
    level.exit.requiresCompleted,
    completedBefore,
  )
  const exitIsOpen = requirementsMet(
    level.exit.requiresCompleted,
    completedAfter,
  )
  return exitWasLocked && exitIsOpen ? 'exit-opened' : 'celebration'
}
