// Solid activation — one saved-completion predicate owns physics and presentation state.

import type { CourseSolid, LevelDefinition, PlatformDefinition, SolidActivation, } from '../contracts'
import { requirementsMet } from './progress'

export function solidActivationMet(
  activation: SolidActivation | undefined,
  completed: ReadonlySet<string>,
): boolean {
  return (
    requirementsMet(activation?.allCompleted, completed) &&
    (activation?.noneCompleted ?? []).every((id) => !completed.has(id))
  )
}

function platformActive(
  platform: PlatformDefinition,
  completed: ReadonlySet<string>,
): boolean {
  return (
    (platform.unlockAfter === undefined ||
      completed.has(platform.unlockAfter)) &&
    solidActivationMet(platform.activation, completed)
  )
}

/** The exact collision set consumed by simulation and exposed to presentation. */
export function getActiveCourseSolids(
  level: LevelDefinition,
  completed: ReadonlySet<string>,
): CourseSolid[] {
  const platforms = level.platforms.filter((platform) =>
    platformActive(platform, completed),
  )
  const platformIds = new Set(platforms.map((platform) => platform.id))
  const props = (level.solids ?? []).filter(
    (solid) =>
      solidActivationMet(solid.activation, completed) &&
      (solid.platformId === undefined || platformIds.has(solid.platformId)),
  )
  return [...platforms, ...props]
}

export function getActiveSolidIds(
  level: LevelDefinition,
  completed: ReadonlySet<string>,
): string[] {
  return getActiveCourseSolids(level, completed).map((solid) => solid.id)
}
