// Resonance exhibit layout — validate unique per-encounter presentation overrides against capable recipes.

import type { LevelDefinition, ResonanceExhibitPresentationDefinition, } from '../contracts'
import { getBreakableRenderRecipe } from './catalog'

function fail(detail: string): never {
  throw new Error(`Resonance exhibit presentation: ${detail}`)
}

export function resolveResonanceExhibitPresentations(
  level: LevelDefinition,
): ReadonlyMap<string, ResonanceExhibitPresentationDefinition> {
  const targets = new Map(
    level.breakables.map((target) => [target.id, target] as const),
  )
  const resolved = new Map<string, ResonanceExhibitPresentationDefinition>()
  for (const presentation of level.presentation?.resonanceExhibits ?? []) {
    if (resolved.has(presentation.encounterId))
      fail(`encounter "${presentation.encounterId}" has duplicate tuning.`)
    const target = targets.get(presentation.encounterId)
    if (target === undefined)
      fail(`encounter "${presentation.encounterId}" does not exist.`)
    const recipe = getBreakableRenderRecipe(target.variant)
    if (
      recipe.resonancePresentation === undefined ||
      (recipe.resonanceGlassMaterials?.length ?? 0) === 0
    )
      fail(
        `encounter "${presentation.encounterId}" recipe "${target.variant}" does not support Resonance.`,
      )
    resolved.set(presentation.encounterId, presentation)
  }
  return resolved
}
