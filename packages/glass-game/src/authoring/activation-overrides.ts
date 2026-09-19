// Authored solid activation — resolve encounter references onto placed room solids.

import type { AuthoredLevelSource, LevelAuthoringDiagnostic } from './contracts'
import type { CompiledRoom } from './internal'
import { diagnostic, mapActivation, splitMemberRef } from './internal'

export function applyActivationOverrides(
  source: AuthoredLevelSource,
  rooms: ReadonlyMap<string, CompiledRoom>,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  optionalEncounterIds: ReadonlySet<string>,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const seen = new Set<string>()
  for (const [index, override] of (source.solidActivations ?? []).entries()) {
    const path = `solidActivations.${index}`
    const member = splitMemberRef(override.solid, `${path}.solid`, diagnostics)
    if (member === undefined) continue
    const room = rooms.get(member[0])
    const runtimeId =
      room?.platformIds.get(member[1]) ?? room?.solidIds.get(member[1])
    if (room === undefined || runtimeId === undefined) {
      diagnostic(
        diagnostics,
        'missing-reference',
        `${path}.solid`,
        `Unknown platform or solid "${override.solid}".`,
      )
      continue
    }
    if (seen.has(runtimeId))
      diagnostic(
        diagnostics,
        'duplicate-override',
        `${path}.solid`,
        `Solid "${override.solid}" has more than one activation override.`,
      )
    seen.add(runtimeId)
    const activation = mapActivation(
      override.activation,
      runtimeEncounterIds,
      `${path}.activation`,
      diagnostics,
    )
    const platform = room.platforms.find((item) => item.id === runtimeId)
    const solid = room.solids.find((item) => item.id === runtimeId)
    if (
      platform !== undefined &&
      (override.activation.noneCompleted?.length ?? 0) > 0
    )
      diagnostic(
        diagnostics,
        'non-monotonic-platform',
        `${path}.activation.noneCompleted`,
        'Platforms may only enable permanently after completion; disappearing floors are unsupported.',
      )
    if (platform !== undefined) platform.activation = activation
    if (solid !== undefined) solid.activation = activation
    if (override.requiredForRoute !== true) continue
    for (const ref of [
      ...(override.activation.allCompleted ?? []),
      ...(override.activation.noneCompleted ?? []),
    ])
      if (optionalEncounterIds.has(ref))
        diagnostic(
          diagnostics,
          'optional-required',
          `${path}.activation`,
          `Required route solid cannot depend on optional encounter "${ref}".`,
        )
  }
}
