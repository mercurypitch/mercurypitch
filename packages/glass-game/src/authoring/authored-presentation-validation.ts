// Authored presentation validation — compile route copy and keep visual proxy activation coherent.

import type { LevelDefinition, LevelGuidanceDefinition } from '../contracts'
import type { AuthoredLevelSource, LevelAuthoringDiagnostic } from './contracts'
import { diagnostic } from './internal'

export function compileGuidance(
  source: AuthoredLevelSource,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  diagnostics: LevelAuthoringDiagnostic[],
): LevelGuidanceDefinition | undefined {
  const guidance = source.guidance
  if (guidance === undefined) return undefined
  if (guidance.tutorial !== undefined) {
    if (guidance.tutorial.pages.length !== 2)
      diagnostic(
        diagnostics,
        'invalid-guidance',
        'guidance.tutorial.pages',
        'A tutorial needs a movement page and a voice page.',
      )
    guidance.tutorial.pages.forEach((page, index) => {
      for (const field of ['title', 'body', 'aside'] as const)
        if (typeof page[field] !== 'string' || page[field].trim().length === 0)
          diagnostic(
            diagnostics,
            'invalid-guidance',
            `guidance.tutorial.pages.${index}.${field}`,
            'Tutorial copy must contain visible text.',
          )
    })
  }
  for (const [field, value] of [
    ['subtitle', guidance.subtitle],
    ['openingNotice', guidance.openingNotice],
    ['completionTitle', guidance.completionTitle],
    ['completionNext', guidance.completionNext],
  ] as const)
    if (value !== undefined && value.trim().length === 0)
      diagnostic(
        diagnostics,
        'invalid-guidance',
        `guidance.${field}`,
        'Guidance copy must contain visible text.',
      )

  const seen = new Set<string>()
  const encounterSuccessNotices = (
    guidance.encounterSuccessNotices ?? []
  ).flatMap((item, index) => {
    const path = `guidance.encounterSuccessNotices.${index}`
    if (seen.has(item.encounterId))
      diagnostic(
        diagnostics,
        'duplicate-reference',
        `${path}.encounterId`,
        `Encounter "${item.encounterId}" has more than one success notice.`,
      )
    seen.add(item.encounterId)
    if (item.notice.trim().length === 0)
      diagnostic(
        diagnostics,
        'invalid-guidance',
        `${path}.notice`,
        'Success notice must contain visible text.',
      )
    const encounterId = runtimeEncounterIds.get(item.encounterId)
    if (encounterId === undefined) {
      diagnostic(
        diagnostics,
        'missing-reference',
        `${path}.encounterId`,
        `Unknown encounter "${item.encounterId}".`,
      )
      return []
    }
    return [{ encounterId, notice: item.notice }]
  })
  const tutorial =
    guidance.tutorial === undefined
      ? undefined
      : {
          pages: [
            { ...guidance.tutorial.pages[0] },
            { ...guidance.tutorial.pages[1] },
          ] as const,
        }
  return {
    tutorial,
    subtitle: guidance.subtitle,
    openingNotice: guidance.openingNotice,
    encounterSuccessNotices,
    completionTitle: guidance.completionTitle,
    completionNext: guidance.completionNext,
  }
}

export function validateVisualCoverage(
  level: LevelDefinition,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const solids = new Map((level.solids ?? []).map((solid) => [solid.id, solid]))
  const activationKey = (solidId: string): string | undefined => {
    const solid = solids.get(solidId)
    if (solid === undefined) return undefined
    return JSON.stringify({
      platformId: solid.platformId ?? null,
      allCompleted: [...(solid.activation?.allCompleted ?? [])].sort(),
      noneCompleted: [...(solid.activation?.noneCompleted ?? [])].sort(),
    })
  }
  for (const visual of level.presentation?.visuals ?? []) {
    const coveredSolidIds = visual.coveredSolidIds ?? []
    for (const solidId of coveredSolidIds)
      if (!solids.has(solidId))
        diagnostic(
          diagnostics,
          'missing-reference',
          `presentation.visuals.${visual.id}.coveredSolidIds`,
          `Covered solid "${solidId}" is absent from the compiled level.`,
        )
    const activationKeys = new Set(
      coveredSolidIds.flatMap((solidId) => {
        const key = activationKey(solidId)
        return key === undefined ? [] : [key]
      }),
    )
    if (activationKeys.size > 1)
      diagnostic(
        diagnostics,
        'mismatched-visual-activation',
        `presentation.visuals.${visual.id}.coveredSolidIds`,
        'One visual cannot cover solids with different activation rules.',
      )
  }
}
